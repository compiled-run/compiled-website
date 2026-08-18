// Highlights the fenced code blocks in every .mdx route.
//
// Why a plugin over the emitted module rather than over the .mdx source: the
// router's MDX plugin renders markdown to HTML at build time and rejects any
// raw HTML in the source, so highlighted markup cannot be written into the page
// itself. It can only be swapped into the module the router emits.
//
// That module carries the page's static HTML in `marklessMdxParts`, and each
// html part carries an `elementCount`. The runtime adds those counts up to work
// out where each island's elements start, so replacing a part's HTML means
// recounting its elements in the same way. This plugin checks its own counter
// against the count the router wrote before it changes anything, and throws if
// the two disagree, so a future change to the emit shape fails the build instead
// of quietly moving every island by a few elements.
import type { Plugin } from 'vite';
import { countElements, highlightFences } from './highlight-code.ts';

type MdxRoutePart =
	| { readonly kind: 'html'; readonly html: string; readonly elementCount: number }
	| { readonly kind: 'component'; readonly componentIndex: number };

const PARTS_LINE = /^const marklessMdxParts = (\[.*\]);$/m;
const SOLO_HTML = /return \{ html: ("(?:[^"\\]|\\.)*") \};/;
// The emit carries the page HTML as JS string literals, so the quotes around
// the class are escaped there and only this much of the tag is verbatim.
const FENCE_MARKER = '<pre><code class=';

function isMdxRoute(id: string): boolean {
	return id.split('?', 1)[0].endsWith('.mdx');
}

async function highlightParts(code: string, id: string): Promise<string> {
	const partsLine = PARTS_LINE.exec(code);
	if (!partsLine) return code;
	const parts = JSON.parse(partsLine[1]) as MdxRoutePart[];
	const rewrites = new Map<string, string>();
	const nextParts: MdxRoutePart[] = [];
	for (const part of parts) {
		if (part.kind !== 'html') {
			nextParts.push(part);
			continue;
		}
		const counted = countElements(part.html);
		if (counted !== part.elementCount)
			throw new Error(
				`highlight-mdx: element counter disagrees with @markless/router for ${id} ` +
					`(counted ${counted}, part says ${part.elementCount}). Island offsets would move; refusing to rewrite.`,
			);
		const html = await highlightFences(part.html);
		if (html === part.html) {
			nextParts.push(part);
			continue;
		}
		rewrites.set(part.html, html);
		nextParts.push({ kind: 'html', html, elementCount: countElements(html) });
	}
	if (rewrites.size === 0) return code;
	let next = code.replace(
		partsLine[0],
		() => `const marklessMdxParts = ${JSON.stringify(nextParts)};`,
	);
	// The same HTML literal is emitted again inside renderSsr and renderCsr.
	for (const [before, after] of rewrites)
		next = next.split(JSON.stringify(before)).join(JSON.stringify(after));
	return next;
}

async function highlightSoloHtml(code: string): Promise<string> {
	// A page with no components emits one `return { html: "…" };` and no parts.
	const solo = SOLO_HTML.exec(code);
	if (!solo) return code;
	const html = await highlightFences(JSON.parse(solo[1]) as string);
	return code.replace(solo[0], () => `return { html: ${JSON.stringify(html)} };`);
}

export function highlightMdx(): Plugin {
	return {
		name: 'compiled-website:highlight-mdx',
		// Object form with a handler: vite-plus does not call a bare `transform`
		// function on this plugin, and a hook that silently never runs is the one
		// failure this whole file cannot detect from the inside.
		transform: {
			async handler(code: string, id: string) {
				if (!isMdxRoute(id) || !code.includes(FENCE_MARKER)) return;
				const known = PARTS_LINE.test(code) || SOLO_HTML.test(code);
				if (!known)
					throw new Error(
						`highlight-mdx: ${id} carries a code fence but neither emit shape this plugin knows. ` +
							'The @markless/router MDX emit changed; update tooling/highlight-mdx.ts before shipping.',
					);
				const next = PARTS_LINE.test(code)
					? await highlightParts(code, id)
					: await highlightSoloHtml(code);
				return next === code ? undefined : { code: next, map: null };
			},
		},
	};
}
