// Witness: serves the production build, curls the base-path URLs, then in system
// Chrome checks that the code blocks are really highlighted, that a TSRX token
// shows its hover doc, and that the Counter island still resumes on a page whose
// first code block sits above it.
// Run: node --experimental-strip-types scripts/witness.ts
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator, type Page } from 'playwright-core';
import { nav } from '../nav.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir =
	process.env.WITNESS_SHOTS_DIR ??
	'/Users/jacksm5pro/dev/open-source/markless/goals/compiled-website/notes/shots';

const failures: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
	if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const freePort = () =>
	new Promise<number>((done, fail) => {
		const probe = createServer();
		probe.on('error', fail);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			probe.close(() => done(port));
		});
	});

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
	cwd: root,
	env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
	stdio: ['ignore', 'pipe', 'pipe'],
});
const serverLog: string[] = [];
server.stdout.on('data', (chunk) => serverLog.push(String(chunk)));
server.stderr.on('data', (chunk) => serverLog.push(String(chunk)));

const stop = () => {
	if (!server.killed) server.kill('SIGKILL');
};
process.on('exit', stop);

const waitFor = async (url: string, attempts = 60) => {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			const response = await fetch(url);
			if (response.status < 500) return response;
		} catch {}
		await new Promise((done) => setTimeout(done, 250));
	}
	throw new Error(`server never answered ${url}\n${serverLog.join('')}`);
};

/** The tooltip is a CSS box, so "showing" means what the browser actually paints. */
const tooltipIsVisible = (tip: Locator) =>
	tip.evaluate((node) => {
		const style = getComputedStyle(node as Element);
		const box = (node as Element).getBoundingClientRect();
		return (
			style.visibility === 'visible' &&
			Number(style.opacity) > 0.9 &&
			box.width > 0 &&
			box.height > 0
		);
	});

/** A page's screenshot name: /markless/concepts/state -> concepts-state. */
const slugFor = (href: string) => href.replace(/^\/markless\/?/, '').replace(/\//g, '-') || 'index';

/** Waits until one element's text satisfies a predicate, then returns it. */
const settleText = async (locator: Locator, wanted: (text: string) => boolean, label: string) => {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		const text = ((await locator.textContent()) ?? '').trim();
		if (wanted(text)) return text;
		await new Promise((done) => setTimeout(done, 100));
	}
	const text = ((await locator.textContent()) ?? '').trim();
	check(false, label, `never settled, last read "${text}"`);
	return text;
};

const settleOn = (page: Page, text: string) =>
	page
		.waitForFunction(
			(expected) =>
				[...document.querySelectorAll('button')].some(
					(node) => node.textContent?.trim() === expected,
				),
			text,
			{ timeout: 5000 },
		)
		.catch(() => {});

try {
	await waitFor(`${origin}/markless`);

	const landing = await fetch(`${origin}/markless`);
	check(landing.status === 200, 'GET /markless', String(landing.status));
	const landingHtml = await landing.text();

	const statePage = await fetch(`${origin}/markless/concepts/state`);
	check(statePage.status === 200, 'GET /markless/concepts/state', String(statePage.status));
	const stateHtml = await statePage.text();
	check(stateHtml.includes('State is a variable the page is watching'), 'state page carries its prose');
	check(
		!stateHtml.includes('<pre><code class="language-tsrx">'),
		'no code fence was left unhighlighted in the served HTML',
	);

	const assetPath = landingHtml.match(/(?:href|src)="(\/markless\/(?:assets|build)\/[^"]+)"/)?.[1];
	check(Boolean(assetPath), 'built asset URL found in served HTML', assetPath ?? 'none');
	if (assetPath) {
		const asset = await fetch(`${origin}${assetPath}`);
		const contentType = asset.headers.get('content-type') ?? '';
		check(asset.status === 200, `GET ${assetPath}`, String(asset.status));
		check(
			/javascript|css/.test(contentType),
			'asset content-type is script or stylesheet',
			contentType,
		);
	}

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
		await page.goto(`${origin}/markless/concepts/state`, { waitUntil: 'load' });
		await mkdir(shotsDir, { recursive: true });

		// --- highlighting ------------------------------------------------------
		const tokens = page.locator('pre.shiki code span[style*="color"]');
		const tokenCount = await tokens.count();
		check(tokenCount > 0, 'code block carries highlighted token spans', `${tokenCount} spans`);
		const paletteSize = new Set(
			await tokens.evaluateAll((nodes) =>
				nodes.map((node) => getComputedStyle(node as Element).color),
			),
		).size;
		check(paletteSize >= 4, 'the block paints at least four token colours', `${paletteSize} colours`);
		const tokenColour = await tokens
			.first()
			.evaluate((node) => getComputedStyle(node as Element).color);
		const codeColour = await page
			.locator('pre.shiki')
			.first()
			.evaluate((node) => getComputedStyle(node as Element).color);
		check(
			tokenColour !== codeColour && tokenColour !== '',
			'a highlighted token is painted a different colour from the code body',
			`${tokenColour} vs ${codeColour}`,
		);
		await page.screenshot({ path: `${shotsDir}/T010-highlight.png`, fullPage: true });

		// One block on its own, so the owner can judge the theme and the font.
		const block = page.locator('pre.shiki').first();
		await block.screenshot({ path: `${shotsDir}/T005-codeblock.png` });

		// A block at rest ends at its last line: no reserved strip, no empty band.
		const hug = await block.evaluate((node) => {
			const element = node as HTMLElement;
			const lines = [...element.querySelectorAll('.line')];
			const last = lines.at(-1)?.getBoundingClientRect();
			const box = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return {
				gap: last ? box.bottom - last.bottom : Number.NaN,
				padding: Number.parseFloat(style.paddingBottom),
				font: style.fontFamily,
			};
		});
		check(
			// The slack is the half-leading under the last line box, not a reserved strip.
			Number.isFinite(hug.gap) && hug.gap <= hug.padding + 8,
			'a code block at rest ends at its last line',
			`${hug.gap.toFixed(1)}px below the last line, padding ${hug.padding}px`,
		);
		check(
			/mono|Menlo|Consolas/i.test(hug.font),
			'fenced code is set in the monospace stack',
			hug.font,
		);

		// --- hover docs --------------------------------------------------------
		const hover = page.locator('pre.shiki .tsrx-hover').first();
		await hover.waitFor();
		const expectedTitle = await hover.getAttribute('data-doc-title');
		const expectedDoc = await hover.getAttribute('data-doc');
		check(Boolean(expectedTitle && expectedDoc), 'the token declares a title and a doc', String(expectedTitle));
		const tip = hover.locator('.tsrx-tip');
		check(!(await tooltipIsVisible(tip)), 'the tooltip is hidden before anything points at it');
		await hover.hover();
		await page.waitForTimeout(120);
		check(await tooltipIsVisible(tip), 'the tooltip shows on hover');
		check(
			(await tip.locator('.tsrx-tip-title').textContent())?.trim() === expectedTitle,
			'the tooltip shows the expected title',
			String(await tip.locator('.tsrx-tip-title').textContent()),
		);
		check(
			(await tip.locator('.tsrx-tip-body').textContent())?.trim() === expectedDoc,
			'the tooltip shows the expected sentence',
		);
		await page.screenshot({ path: `${shotsDir}/T010-tooltip.png`, fullPage: true });

		// Keyboard reach: focusing the token has to do what hovering it does.
		await page.mouse.move(0, 0);
		await page.waitForTimeout(120);
		check(!(await tooltipIsVisible(tip)), 'the tooltip hides again when the pointer leaves');
		await hover.focus();
		await page.waitForTimeout(120);
		check(await tooltipIsVisible(tip), 'the tooltip shows on keyboard focus');
		await hover.blur();

		// --- the island still resumes -----------------------------------------
		const button = page.getByRole('button', { name: /Clicked/ }).first();
		await button.waitFor();
		await page.screenshot({ path: `${shotsDir}/T004-state-before.png`, fullPage: true });

		const readCount = async () => (await button.textContent())?.trim();
		const before = await readCount();
		check(
			before === 'Clicked 0 times',
			'counter renders its zero state from the server',
			String(before),
		);

		// First click both wakes the island and increments; wait for the text to
		// settle before the second click (a click sent mid-resume is dropped).
		await button.click();
		await settleOn(page, 'Clicked 1 times');
		await button.click();
		await settleOn(page, 'Clicked 2 times');
		const after = await readCount();
		check(
			after === 'Clicked 2 times',
			'counter reaches 2 after two clicks (island resumed)',
			String(after),
		);
		await page.screenshot({ path: `${shotsDir}/T004-state-after.png`, fullPage: true });

		// --- every page in the nav: 200, an h1, and a screenshot ---------------
		for (const section of nav) {
			for (const entry of section.entries) {
				const response = await fetch(`${origin}${entry.href}`);
				check(response.status === 200, `GET ${entry.href}`, String(response.status));
				const html = await response.text();
				check(/<h1[^>]*>[^<]/.test(html), `${entry.href} serves an h1`);
				check(
					html.includes('class="page-meta"'),
					`${entry.href} carries its level, reading time and prerequisite line`,
				);
				await page.goto(`${origin}${entry.href}`, { waitUntil: 'load' });
				const heading = ((await page.locator('h1').first().textContent()) ?? '').trim();
				check(heading.length > 0, `${entry.href} renders its h1 in the browser`, heading);
				await page.screenshot({
					path: `${shotsDir}/T005-${slugFor(entry.href)}.png`,
					fullPage: true,
				});
			}
		}

		// --- widget: the counter on the landing page ---------------------------
		await page.goto(`${origin}/markless`, { waitUntil: 'load' });
		const landingCounter = page.getByRole('button', { name: /Clicked/ }).first();
		await landingCounter.waitFor();
		check(
			((await landingCounter.textContent()) ?? '').trim() === 'Clicked 0 times',
			'landing counter renders its zero state from the server',
		);
		await landingCounter.click();
		const landingAfter = await settleText(
			landingCounter,
			(text) => text === 'Clicked 1 times',
			'landing counter reaches 1 after one click',
		);
		check(landingAfter === 'Clicked 1 times', 'landing counter reaches 1 after one click');

		// --- widget: two variables on the state page ---------------------------
		await page.goto(`${origin}/markless/concepts/state`, { waitUntil: 'load' });
		const twoNumbers = async () =>
			(await page.locator('.playground p').allTextContents()).map((text) =>
				Number(text.replace(/[^0-9]+/g, '')),
			);
		const addWatched = page.getByRole('button', { name: 'Add one to the watched variable' });
		await addWatched.waitFor();
		const [watchedBefore, drawnBefore] = await twoNumbers();
		check(watchedBefore === 0, 'two-variables watched number starts at 0', String(watchedBefore));
		check(
			Number.isFinite(drawnBefore) && drawnBefore >= 100,
			'two-variables drew a number during render',
			String(drawnBefore),
		);
		await addWatched.click();
		await settleText(
			page.locator('.playground p').first(),
			(text) => text.endsWith('1'),
			'two-variables watched number reaches 1',
		);
		const [watchedAfter, drawnAfter] = await twoNumbers();
		check(watchedAfter === 1, 'two-variables watched number moved on click', String(watchedAfter));
		check(
			drawnAfter === drawnBefore,
			'two-variables drawn number did not move, so the component did not run again',
			`${drawnBefore} then ${drawnAfter}`,
		);
		await page.screenshot({ path: `${shotsDir}/T005-two-variables-after.png`, fullPage: true });

		// --- widget: the cart total on the computed page -----------------------
		await page.goto(`${origin}/markless/concepts/computed`, { waitUntil: 'load' });
		const totalLine = page.locator('.playground p').nth(2);
		const addShirt = page.getByRole('button', { name: 'Add a shirt' });
		const addMug = page.getByRole('button', { name: 'Add a mug' });
		await addShirt.waitFor();
		check(
			((await totalLine.textContent()) ?? '').trim() === 'Total: 20',
			'cart total renders 20 from the server',
			((await totalLine.textContent()) ?? '').trim(),
		);
		await addShirt.click();
		await settleText(totalLine, (text) => text === 'Total: 40', 'cart total reaches 40');
		check(
			((await totalLine.textContent()) ?? '').trim() === 'Total: 40',
			'adding a shirt re-derives the total with no line updating it',
		);
		await addMug.click();
		await settleText(totalLine, (text) => text === 'Total: 48', 'cart total reaches 48');
		check(
			((await totalLine.textContent()) ?? '').trim() === 'Total: 48',
			'adding a mug re-derives the same total',
		);
		await page.screenshot({ path: `${shotsDir}/T005-cart-total-after.png`, fullPage: true });

		// --- widget: three differences on the reading-tsrx page ----------------
		await page.goto(`${origin}/markless/start/reading-tsrx`, { waitUntil: 'load' });
		const explorerNote = page.locator('.explorer-note');
		const litLines = page.locator('.file-line.is-lit');
		await explorerNote.waitFor();
		check(
			((await explorerNote.textContent()) ?? '').includes('statement container') ||
				((await explorerNote.textContent()) ?? '').includes('body is written'),
			'three-differences opens on the body explanation',
			((await explorerNote.textContent()) ?? '').slice(0, 60),
		);
		check(
			(await litLines.count()) === 2,
			'three-differences lights the two body lines to start with',
			String(await litLines.count()),
		);
		await page.getByRole('button', { name: 'The markup' }).click();
		await settleText(
			explorerNote,
			(text) => text.includes('The markup is a statement'),
			'three-differences explains the markup after a click',
		);
		check(
			((await explorerNote.textContent()) ?? '').includes('The markup is a statement'),
			'clicking a label swaps the sentence under the file',
		);
		check(
			(await litLines.count()) === 1,
			'clicking a label moves the highlight to one line',
			String(await litLines.count()),
		);
		await page.getByRole('button', { name: 'The fragment' }).click();
		await settleText(
			explorerNote,
			(text) => text.includes('A fragment is'),
			'three-differences explains the fragment after a second click',
		);
		check(
			(await litLines.count()) === 2,
			'the fragment highlight covers both fragment lines',
			String(await litLines.count()),
		);
		await page.screenshot({
			path: `${shotsDir}/T005-three-differences-after.png`,
			fullPage: true,
		});

		await writeFile(
			`${shotsDir}/T010-witness.json`,
			`${JSON.stringify({ origin, tokenCount, expectedTitle, before, after, assetPath, failures }, undefined, '\t')}\n`,
		);
	} finally {
		await browser.close();
	}
} finally {
	stop();
}

if (failures.length > 0) {
	console.error(`\nwitness FAILED:\n${failures.map((line) => `  - ${line}`).join('\n')}`);
	process.exit(1);
}
console.log('\nwitness passed');
