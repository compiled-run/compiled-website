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
const knownFailing: string[] = [];
const themeShots: Record<string, unknown>[] = [];
/**
 * While this is set, a failed check is reported as `known-failing` against the
 * NOTES.md finding it belongs to instead of failing the run. The site keeps the
 * widget, because it is what the page teaches with, and the witness keeps
 * checking it so the day the framework fix lands the run goes green on its own.
 *
 * One thing is under it now: a `class={ternary}` binding, which the compiler
 * writes no dom update for (finding 18). The two widgets that were under
 * finding 14 are real assertions again.
 */
let knownFailingReason: string | undefined;
const check = (ok: boolean, label: string, detail = '') => {
	const line = `${label}${detail ? ` — ${detail}` : ''}`;
	if (ok) {
		console.log(`ok            ${line}`);
		return;
	}
	if (knownFailingReason) {
		knownFailing.push(`${line} (${knownFailingReason})`);
		console.log(`known-failing ${line} — ${knownFailingReason}`);
		return;
	}
	failures.push(line);
	console.log(`FAIL          ${line}`);
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
			const code = element.querySelector('code');
			const token = element.querySelector('code span');
			return {
				gap: last ? box.bottom - last.bottom : Number.NaN,
				padding: Number.parseFloat(style.paddingBottom),
				font: style.fontFamily,
				codeFont: code ? getComputedStyle(code).fontFamily : '',
				tokenFont: token ? getComputedStyle(token).fontFamily : '',
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
			'the code block is set in the monospace stack',
			hug.font,
		);
		// `* { font-family }` matches the token spans directly, and a direct match
		// beats an inherited family, so `pre` being monospace proves nothing about
		// the text a reader actually sees.
		check(
			/mono|Menlo|Consolas/i.test(hug.codeFont),
			'the computed font-family of `pre code` names a monospace family',
			hug.codeFont,
		);
		check(
			/mono|Menlo|Consolas/i.test(hug.tokenFont),
			'a highlighted token span is painted in the monospace stack',
			hug.tokenFont,
		);

		// --- hover docs --------------------------------------------------------
		const hover = page.locator('pre.shiki .tsrx-hover').first();
		await hover.waitFor();
		const expectedTitle = await hover.getAttribute('data-doc-title');
		const expectedDoc = await hover.getAttribute('data-doc');
		check(Boolean(expectedTitle && expectedDoc), 'the token declares a title and a doc', String(expectedTitle));
		const tip = hover.locator('.tsrx-tip');
		check(!(await tooltipIsVisible(tip)), 'the tooltip is hidden before anything points at it');
		const preHeightAtRest = await block.evaluate((node) => (node as HTMLElement).getBoundingClientRect().height);
		await hover.hover();
		await page.waitForTimeout(120);
		check(await tooltipIsVisible(tip), 'the tooltip shows on hover');
		const preHeightOnHover = await block.evaluate((node) => (node as HTMLElement).getBoundingClientRect().height);
		check(
			Math.abs(preHeightOnHover - preHeightAtRest) < 0.5,
			'the code block does not change height while a token is pointed at',
			`${preHeightAtRest.toFixed(1)}px then ${preHeightOnHover.toFixed(1)}px`,
		);
		// The doc is a popover above the token, so its foot sits above the token's head.
		const anchored = await hover.evaluate((node) => {
			const token = (node as HTMLElement).getBoundingClientRect();
			const doc = (node as HTMLElement).querySelector('.tsrx-tip')?.getBoundingClientRect();
			return doc ? { above: doc.bottom <= token.top + 1, width: doc.width } : undefined;
		});
		check(Boolean(anchored?.above), 'the tooltip is anchored above the token it explains');
		check((anchored?.width ?? 0) > 0, 'the tooltip has a painted box', `${anchored?.width ?? 0}px wide`);
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
		// This was NOTES.md finding 14 and is a real assertion again: the router
		// fix that prefixes deriveSymbolId through composeMdxState landed, so an
		// island whose update derives a value resumes.
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
		// The sentence under the file is a text binding and moves. The highlight is
		// `class={ternary}`, and the compiler writes no dom update for a class
		// binding at all, so it cannot move (NOTES.md finding 18).
		knownFailingReason = 'NOTES.md finding 18';
		await page.getByRole('button', { name: 'The markup' }).click();
		await settleText(
			explorerNote,
			(text) => text.includes('The markup is a statement'),
			'three-differences explains the markup after a click',
		);
		knownFailingReason = undefined;
		check(
			((await explorerNote.textContent()) ?? '').includes('The markup is a statement'),
			'clicking a label swaps the sentence under the file',
		);
		knownFailingReason = 'NOTES.md finding 18';
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
		knownFailingReason = undefined;

		// --- the theme toggle --------------------------------------------------
		// The toggle is a `storage()` island each page renders, not part of the
		// document (NOTES.md finding 19). What has to be true: the seed script
		// reaches the head so there is no flash, the control lands on the hole the
		// header reserves for it, a click actually repaints the page, and the
		// choice survives a reload.
		await page.goto(`${origin}/markless/concepts/state`, { waitUntil: 'load' });
		const headSeed = await page.evaluate(() =>
			[...document.head.querySelectorAll('script:not([src])')].some((node) =>
				node.textContent?.includes('tsrx.storage/1'),
			),
		);
		check(headSeed, 'the storage seed script is in the head, so the theme cannot flash');

		const themeState = () =>
			page.evaluate(() => {
				const slot = document.querySelector('.theme-toggle-slot')?.getBoundingClientRect();
				const island = document.querySelector('.theme-toggle-island')?.getBoundingClientRect();
				return {
					attr: document.documentElement.getAttribute('data-theme'),
					stored: localStorage.getItem('theme'),
					paper: getComputedStyle(document.body).backgroundColor,
					offered: [...document.querySelectorAll('.theme-toggle')]
						.filter((node) => getComputedStyle(node as Element).display !== 'none')
						.map((node) => (node as HTMLElement).dataset.themeToggle)
						.join(),
					onSlot:
						Boolean(slot && island) &&
						Math.abs(slot!.left - island!.left) < 2 &&
						Math.abs(slot!.right - island!.right) < 2,
				};
			});

		const atRest = await themeState();
		check(atRest.attr === 'system', 'an untouched reader is on the system theme', String(atRest.attr));
		check(atRest.onSlot, 'the toggle lands on the hole the header reserves for it');
		check(
			atRest.offered === 'dark',
			'exactly one button is offered, and on a light page it is the dark one',
			atRest.offered,
		);

		await page.locator('.theme-toggle-to-dark').click();
		for (let attempt = 0; attempt < 40; attempt += 1) {
			if ((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark') break;
			await new Promise((done) => setTimeout(done, 100));
		}
		const dark = await themeState();
		check(dark.attr === 'dark', 'clicking the toggle puts data-theme="dark" on <html>', String(dark.attr));
		check(dark.stored === 'dark', 'the choice is written to localStorage', String(dark.stored));
		check(
			dark.paper !== atRest.paper,
			'the page is actually repainted, not just re-labelled',
			`${atRest.paper} then ${dark.paper}`,
		);
		check(dark.offered === 'light', 'the dark page offers the light button', dark.offered);

		await page.reload({ waitUntil: 'load' });
		const reloaded = await themeState();
		check(reloaded.attr === 'dark', 'the choice survives a reload', String(reloaded.attr));
		check(
			reloaded.paper === dark.paper,
			'the reloaded page paints dark from the first frame',
			reloaded.paper,
		);
		await page.screenshot({ path: `${shotsDir}/T019-theme-toggle-dark.png`, fullPage: false });

		await page.locator('.theme-toggle-to-light').click();
		for (let attempt = 0; attempt < 40; attempt += 1) {
			if ((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light') break;
			await new Promise((done) => setTimeout(done, 100));
		}
		const back = await themeState();
		check(back.attr === 'light', 'the toggle goes back to light', String(back.attr));
		check(back.paper === atRest.paper, 'light is the light it started on', back.paper);
		await page.evaluate(() => localStorage.removeItem('theme'));

		// --- sprites and mascots ------------------------------------------------
		await page.goto(`${origin}/markless`, { waitUntil: 'load' });
		const heroMascot = page.locator('.prose img.mascot').first();
		await heroMascot.waitFor();
		const heroSrc = await heroMascot.getAttribute('src');
		check(
			heroSrc === '/markless/mascots/markless.png',
			'the landing hero is the markless mascot',
			String(heroSrc),
		);
		const heroWidth = await heroMascot.evaluate((node) => (node as HTMLImageElement).naturalWidth);
		check(heroWidth > 0, 'the markless mascot on the landing decodes', `naturalWidth ${heroWidth}`);
		const siblingMascots = await page
			.locator('.more-from img.mascot')
			.evaluateAll((nodes) =>
				nodes.map((node) => ({
					src: (node as HTMLImageElement).getAttribute('src'),
					width: (node as HTMLImageElement).naturalWidth,
				})),
			);
		check(
			siblingMascots.length === 4 && siblingMascots.every((one) => one.width > 0),
			'the More from compiled.run strip shows four mascots that decode',
			siblingMascots.map((one) => `${one.src}:${one.width}`).join(' '),
		);
		const sprites = await page
			.locator('.sprite img.sprite-ink-light')
			.evaluateAll((nodes) =>
				nodes.map((node) => (node as HTMLImageElement).naturalWidth),
			);
		check(sprites.length > 0, 'the landing paints sprites', `${sprites.length} sprites`);
		check(
			sprites.length > 0 && sprites.every((width) => width > 0),
			'every sprite on the landing decodes',
			sprites.join(' '),
		);

		// --- both themes --------------------------------------------------------
		// The theme is `data-theme` on <html>, which is what the toggle will write
		// when `storage()` can resume (NOTES.md finding 15). Setting it here is the
		// same switch, so these shots are the two themes as a reader would see them.
		for (const [label, href] of [
			['index', '/markless'],
			['state', '/markless/concepts/state'],
		] as const) {
			for (const theme of ['light', 'dark'] as const) {
				await page.goto(`${origin}${href}`, { waitUntil: 'load' });
				await page.evaluate((wanted) => {
					document.documentElement.setAttribute('data-theme', wanted);
				}, theme);
				await page.waitForTimeout(150);
				const painted = await page.evaluate(() => {
					const body = getComputedStyle(document.body);
					const token = document.querySelector('pre.shiki code span[style*="color"]');
					const sprite = document.querySelector('.sprite img.sprite-ink-dark');
					return {
						attr: document.documentElement.getAttribute('data-theme'),
						ground: body.backgroundColor,
						ink: body.color,
						token: token ? getComputedStyle(token).color : '',
						darkSpriteShown: sprite ? getComputedStyle(sprite).display !== 'none' : false,
					};
				});
				check(painted.attr === theme, `${href} takes data-theme="${theme}"`, String(painted.attr));
				check(
					painted.darkSpriteShown === (theme === 'dark'),
					`${href} paints the ${theme} cut of its sprites`,
					`dark cut shown: ${painted.darkSpriteShown}`,
				);
				themeShots.push({ page: label, theme, ...painted });
				await page.screenshot({
					path: `${shotsDir}/T016-${label}-${theme}.png`,
					fullPage: true,
				});
			}
		}
		const groundsDiffer = new Set(themeShots.map((shot) => shot.ground)).size > 1;
		check(groundsDiffer, 'the two themes paint different grounds', [...new Set(themeShots.map((shot) => shot.ground))].join(' vs '));
		const inksDiffer = new Set(themeShots.map((shot) => shot.ink)).size > 1;
		check(inksDiffer, 'the two themes paint different ink', [...new Set(themeShots.map((shot) => shot.ink))].join(' vs '));
		const tokensDiffer = new Set(themeShots.map((shot) => shot.token)).size > 1;
		check(
			tokensDiffer,
			'the code block paints different token colours in the two themes',
			[...new Set(themeShots.map((shot) => shot.token))].join(' vs '),
		);
		await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

		// --- T017: header, outline rail, and the page at 390 --------------------
		// Two pages, both themes, both widths. The desktop pass checks the chrome
		// the reader sees beside the prose; the 390 pass checks that nothing of it
		// lands on top of the prose or pushes the document wider than the phone.
		for (const [label, href] of [
			['index', '/markless'],
			['state', '/markless/concepts/state'],
		] as const) {
			const entry = nav.flatMap((section) => section.entries).find((one) => one.href === href);
			const section = nav.find((one) => one.entries.some((one) => one.href === href));
			for (const theme of ['light', 'dark'] as const) {
				for (const width of [1440, 390] as const) {
					await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
					await page.goto(`${origin}${href}`, { waitUntil: 'load' });
					await page.evaluate((wanted) => {
						document.documentElement.setAttribute('data-theme', wanted);
					}, theme);
					await page.waitForTimeout(150);

					const chrome = await page.evaluate(() => {
						const header = document.querySelector('.site-header');
						const rail = document.querySelector('.on-this-page');
						const railVisible = rail ? getComputedStyle(rail).display !== 'none' : false;
						const nav = document.querySelector('.sidebar');
						const h1 = document.querySelector('.prose h1');
						const navBox = nav?.getBoundingClientRect();
						const h1Box = h1?.getBoundingClientRect();
						return {
							header: Boolean(header),
							headerSticky: header ? getComputedStyle(header).position : '',
							crumbSection: document.querySelector('.crumb-section')?.textContent?.trim() ?? '',
							crumbPage: document.querySelector('.crumb-page')?.textContent?.trim() ?? '',
							search: Boolean(document.querySelector('.site-search')),
							themeToggle: Boolean(document.querySelector('[data-theme-toggle]')),
							github: Boolean(
								document.querySelector('a.header-link[href*="github.com/compiled-run/markless"]'),
							),
							railVisible,
							railItems: [...document.querySelectorAll('.on-this-page-item-h2 .on-this-page-link')].map(
								(node) => (node.textContent ?? '').trim(),
							),
							railTargets: [...document.querySelectorAll('.on-this-page-link')].every((node) => {
								const id = (node.getAttribute('href') ?? '').slice(1);
								return id !== '' && document.getElementById(id) !== null;
							}),
							pageH2s: [...document.querySelectorAll('.prose h2')].map((node) =>
								(node.textContent ?? '').trim(),
							),
							navPosition: nav ? getComputedStyle(nav).position : '',
							overlap: Boolean(
								navBox &&
									h1Box &&
									navBox.right > h1Box.left &&
									navBox.left < h1Box.right &&
									navBox.bottom > h1Box.top &&
									navBox.top < h1Box.bottom,
							),
							scrollX: document.documentElement.scrollWidth > window.innerWidth + 1,
							bodyFont: Number.parseFloat(getComputedStyle(document.body).fontSize),
							prosePosition: document.querySelector('.prose')?.getBoundingClientRect().width ?? 0,
							pager: Boolean(document.querySelector('.pager .pager-title')),
						};
					});

					const at = `${label} ${theme} ${width}`;
					check(chrome.header, `${at}: the header is on the page`);
					check(chrome.headerSticky === 'sticky', `${at}: the header is sticky`, chrome.headerSticky);
					check(
						chrome.crumbPage === (entry?.title ?? ''),
						`${at}: the breadcrumb names this page`,
						`${chrome.crumbSection} > ${chrome.crumbPage}`,
					);
					check(
						chrome.crumbSection === (section?.title ?? ''),
						`${at}: the breadcrumb names this section`,
						chrome.crumbSection,
					);
					check(chrome.search, `${at}: the header carries a search slot`);
					check(chrome.themeToggle, `${at}: the header carries a theme-toggle slot`);
					check(chrome.github, `${at}: the header links the repo`);
					check(chrome.pager, `${at}: the page ends with a prev/next pager`);
					check(!chrome.scrollX, `${at}: the document is no wider than the viewport`);
					check(
						!chrome.overlap,
						`${at}: the nav does not sit on top of the h1`,
						`nav is ${chrome.navPosition}`,
					);
					if (width === 1440) {
						check(chrome.railVisible, `${at}: the On this page rail is shown`);
						check(
							chrome.railItems.length === chrome.pageH2s.length && chrome.railItems.length > 1,
							`${at}: the rail lists every h2 on the page`,
							`${chrome.railItems.length} rail items, ${chrome.pageH2s.length} h2s`,
						);
						check(
							chrome.railItems.every((title, index) => title === chrome.pageH2s[index]),
							`${at}: the rail's titles are this page's h2 titles`,
							chrome.railItems.join(' | '),
						);
						check(chrome.railTargets, `${at}: every rail link lands on a heading id`);
						check(
							chrome.bodyFont >= 19 && chrome.bodyFont <= 22,
							`${at}: body copy is set around 20px`,
							`${chrome.bodyFont}px`,
						);
					} else {
						check(!chrome.railVisible, `${at}: the rail is hidden on a phone`);
						check(
							chrome.navPosition === 'static',
							`${at}: the sidebar stacks instead of being pinned`,
							chrome.navPosition,
						);
					}

					await page.screenshot({
						path: `${shotsDir}/T017-${label}-${theme}-${width}.png`,
						fullPage: true,
					});
				}
			}
		}
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

		// --- the assumes line links the pages it names -------------------------
		for (const href of ['/markless', '/markless/concepts/state', '/markless/concepts/computed']) {
			await page.goto(`${origin}${href}`, { waitUntil: 'load' });
			const assumed = await page
				.locator('.page-meta a.page-meta-assume-link:not(.is-hidden)')
				.evaluateAll((nodes) =>
					nodes.map((node) => ({
						href: node.getAttribute('href') ?? '',
						title: (node.textContent ?? '').trim(),
					})),
				);
			for (const link of assumed) {
				const target = await fetch(`${origin}${link.href}`);
				check(
					target.status === 200,
					`${href}: "Assumes: ${link.title}" links a page that answers`,
					`${link.href} -> ${target.status}`,
				);
			}
			check(
				href === '/markless' ? assumed.length === 0 : assumed.length > 0,
				`${href}: the assumes line has the links it should`,
				`${assumed.length} links`,
			);
		}

		// --- the footer doodles react to the pointer ----------------------------
		await page.goto(`${origin}/markless/concepts/state`, { waitUntil: 'load' });
		const doodles = page.locator('.pager-doodles .sprite');
		await doodles.first().waitFor();
		check((await doodles.count()) === 6, 'the pager carries its six doodles', String(await doodles.count()));
		const doodleImage = (index: number) => doodles.nth(index).locator('img.sprite-ink-light');
		const doodleMotion = (index: number) =>
			doodleImage(index).evaluate((node) => {
				const style = getComputedStyle(node as Element);
				return { transform: style.transform, animation: style.animationName };
			});
		const restingCrown = await doodleMotion(0);
		await doodles.first().hover();
		await page.waitForTimeout(450);
		const hoveredCrown = await doodleMotion(0);
		check(
			hoveredCrown.transform !== restingCrown.transform && hoveredCrown.transform !== 'none',
			'the first pager doodle moves when it is pointed at',
			`${restingCrown.transform} then ${hoveredCrown.transform}`,
		);
		// The star and the smiley are keyframed rather than swapped for another
		// drawing: what proves the reaction is that an animation is running on the
		// image the reader is looking at, not that its src changed.
		for (const [index, name] of [
			[4, 'doodle-dart'],
			[5, 'doodle-roll'],
		] as const) {
			await page.mouse.move(0, 0);
			await page.waitForTimeout(80);
			const resting = await doodleMotion(index);
			check(resting.animation === 'none', `doodle ${index + 1} is still at rest`, resting.animation);
			await doodles.nth(index).hover();
			await page.waitForTimeout(60);
			const hovered = await doodleMotion(index);
			check(
				hovered.animation === name,
				`doodle ${index + 1} runs its ${name} reaction on hover`,
				hovered.animation,
			);
		}
		await page.mouse.move(0, 0);

		await writeFile(
			`${shotsDir}/T016-witness.json`,
			`${JSON.stringify({ origin, tokenCount, expectedTitle, before, after, assetPath, hug, themeShots, knownFailing, failures }, undefined, '\t')}\n`,
		);
	} finally {
		await browser.close();
	}
} finally {
	stop();
}

if (knownFailing.length > 0)
	console.log(
		`\nknown-failing (not a witness failure):\n${knownFailing.map((line) => `  - ${line}`).join('\n')}`,
	);

if (failures.length > 0) {
	console.error(`\nwitness FAILED:\n${failures.map((line) => `  - ${line}`).join('\n')}`);
	process.exit(1);
}
console.log('\nwitness passed');
