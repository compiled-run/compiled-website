// Turns the plain `<pre><code class="language-…">` blocks that the router's MDX
// plugin renders into shiki-highlighted markup, and wraps the TSRX tokens
// inside them in hover targets.
//
// Colours are not baked in. The theme is shiki's CSS-variable theme with a
// `--code-` prefix, so every colour resolves against the variables declared in
// styles/global.css, which are themselves derived from the site's paper tokens.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCssVariablesTheme, createHighlighter, type HighlighterGeneric } from 'shiki';
import { docForToken, knownTokens, tooltipLabel, tooltipTitle } from './tsrx-docs.ts';

/** Fence language -> the language shiki is asked for. */
const FENCE_ALIASES: Readonly<Record<string, string>> = {
	bash: 'shellscript',
	js: 'javascript',
	jsx: 'jsx',
	mjs: 'javascript',
	sh: 'shellscript',
	shell: 'shellscript',
	ts: 'typescript',
	zsh: 'shellscript',
};

const THEME_NAME = 'paper';

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | undefined;

export function getHighlighter(): Promise<HighlighterGeneric<string, string>> {
	highlighterPromise ??= (async () => {
		const grammar = JSON.parse(
			await readFile(fileURLToPath(new URL('./tsrx.tmLanguage.json', import.meta.url)), 'utf8'),
		) as Record<string, unknown>;
		return createHighlighter({
			themes: [
				createCssVariablesTheme({ name: THEME_NAME, variablePrefix: '--code-', fontStyle: true }),
			],
			langs: [
				'javascript',
				'typescript',
				'jsx',
				'tsx',
				'css',
				'html',
				'json',
				'shellscript',
				{ ...grammar, embeddedLangs: ['jsx', 'tsx', 'css'], name: 'tsrx' },
			],
		}) as Promise<HighlighterGeneric<string, string>>;
	})();
	return highlighterPromise;
}

/** Every `<pre><code class="language-x">` block in one chunk of static HTML. */
const FENCE = /<pre><code class="language-([\w+#-]+)">([\s\S]*?)<\/code><\/pre>/g;

/**
 * Counts elements the way the router's MDX plugin counts them: one per element,
 * descendants included. The router uses that number to work out where the
 * islands on the page start, so it has to stay exact.
 */
export function countElements(html: string): number {
	return (html.match(/<[a-zA-Z][^\s/>]*/g) ?? []).length;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
	amp: '&',
	apos: "'",
	gt: '>',
	lt: '<',
	nbsp: '\u00a0',
	quot: '"',
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, body: string) => {
		if (body.startsWith('#x') || body.startsWith('#X'))
			return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
		if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

function escapeAttribute(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function escapeText(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function hoverSpan(token: string, rendered: string): string {
	const doc = docForToken(token);
	if (!doc) return rendered;
	const title = tooltipTitle(token, doc);
	return [
		'<span class="tsrx-hover" tabindex="0" role="img"',
		` aria-label="${escapeAttribute(tooltipLabel(token, doc))}"`,
		` data-doc-title="${escapeAttribute(title)}" data-doc="${escapeAttribute(doc.doc)}">`,
		rendered,
		'<span class="tsrx-tip" aria-hidden="true">',
		`<span class="tsrx-tip-title">${escapeText(title)}</span>`,
		`<span class="tsrx-tip-body">${escapeText(doc.doc)}</span>`,
		'</span></span>',
	].join('');
}

/** Alternation of every documented token, longest first, ready to embed in a regex. */
const TOKEN_PATTERN = knownTokens()
	.map((token) => token.replace(/[.*+?^${}()|[\]\\{]/g, '\\$&'))
	.join('|');

/**
 * Wraps the TSRX tokens shiki produced in `.tsrx-hover` spans. A token only
 * qualifies when it is the entire text of one shiki span, so a word that merely
 * appears inside a longer run of code is left alone.
 */
export function addTsrxHovers(html: string): string {
	// `@else if` is scoped as two adjacent spans with identical styling. Fuse
	// them so the hover target is the whole phrase rather than half of it.
	const fused = html.replace(
		/(<span style="([^"]*)">)([ \t]*)@else<\/span><span style="\2">([ \t]*)(if\b)/g,
		(_match, open: string, _style: string, lead: string, gap: string, ifWord: string) =>
			`${open}${lead}${hoverSpan('@else if', `@else${gap}${ifWord}`)}`,
	);
	return fused.replace(
		new RegExp(
			`(<span style="[^"]*">)([ \\t]*)(${TOKEN_PATTERN}|on[A-Z][A-Za-z]*)(</span>)`,
			'g',
		),
		(match, open: string, lead: string, token: string, close: string) => {
			const rendered = hoverSpan(token, escapeText(token));
			return rendered === escapeText(token) ? match : `${open}${lead}${rendered}${close}`;
		},
	);
}

/**
 * Replaces every fenced block in one static-HTML chunk. Fences whose language
 * shiki does not know are left exactly as the MDX plugin wrote them.
 */
export async function highlightFences(html: string): Promise<string> {
	if (!FENCE.test(html)) return html;
	FENCE.lastIndex = 0;
	const highlighter = await getHighlighter();
	const loaded = new Set(highlighter.getLoadedLanguages());
	return html.replace(FENCE, (match, fenceLanguage: string, encoded: string) => {
		const language = FENCE_ALIASES[fenceLanguage] ?? fenceLanguage;
		if (!loaded.has(language)) return match;
		const code = decodeEntities(encoded).replace(/\n$/, '');
		const rendered = highlighter.codeToHtml(code, { lang: language, theme: THEME_NAME });
		return addTsrxHovers(rendered).replace('<pre class="shiki', `<pre data-lang="${fenceLanguage}" class="shiki`);
	});
}
