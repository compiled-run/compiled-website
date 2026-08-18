// Witness: serves the production build, curls the base-path URLs, then clicks the
// Counter demo in system Chrome and screenshots before/after.
// Run: node scripts/witness.mjs
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir =
	process.env.WITNESS_SHOTS_DIR ??
	'/Users/jacksm5pro/dev/open-source/markless/goals/compiled-website/notes/shots';

const failures = [];
const check = (ok, label, detail = '') => {
	if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const freePort = () =>
	new Promise((done, fail) => {
		const probe = createServer();
		probe.on('error', fail);
		probe.listen(0, '127.0.0.1', () => {
			const { port } = probe.address();
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
const serverLog = [];
server.stdout.on('data', (chunk) => serverLog.push(String(chunk)));
server.stderr.on('data', (chunk) => serverLog.push(String(chunk)));

const stop = () => {
	if (!server.killed) server.kill('SIGKILL');
};
process.on('exit', stop);

const waitFor = async (url, attempts = 60) => {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			const response = await fetch(url);
			if (response.status < 500) return response;
		} catch {}
		await new Promise((done) => setTimeout(done, 250));
	}
	throw new Error(`server never answered ${url}\n${serverLog.join('')}`);
};

try {
	await waitFor(`${origin}/markless`);

	const landing = await fetch(`${origin}/markless`);
	check(landing.status === 200, 'GET /markless', String(landing.status));
	const landingHtml = await landing.text();

	const statePage = await fetch(`${origin}/markless/concepts/state`);
	check(statePage.status === 200, 'GET /markless/concepts/state', String(statePage.status));
	const stateHtml = await statePage.text();
	check(
		stateHtml.includes('State: a variable the UI watches'),
		'state page carries its prose',
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
		const button = page.getByRole('button', { name: /Clicked/ }).first();
		await button.waitFor();
		await mkdir(shotsDir, { recursive: true });
		await page.screenshot({ path: `${shotsDir}/T004-state-before.png`, fullPage: true });

		const readCount = async () => (await button.textContent())?.trim();
		const before = await readCount();
		check(before === 'Clicked 0 times', 'counter renders its zero state from the server', String(before));

		const clickUntil = async (expected) => {
			await button.click();
			await page
				.waitForFunction(
					(text) =>
						[...document.querySelectorAll('button')].some(
							(node) => node.textContent?.trim() === text,
						),
					expected,
					{ timeout: 5000 },
				)
				.catch(() => {});
		};
		// First click both wakes the island and increments; wait for the text to
		// settle before the second click (a click sent mid-resume is dropped).
		await clickUntil('Clicked 1 times');
		await clickUntil('Clicked 2 times');
		await page
			.waitForFunction(
				() =>
					[...document.querySelectorAll('button')].some(
						(node) => node.textContent?.trim() === 'Clicked 2 times',
					),
				undefined,
				{ timeout: 5000 },
			)
			.catch(() => {});
		const after = await readCount();
		check(
			after === 'Clicked 2 times',
			'counter reaches 2 after two clicks (island resumed)',
			String(after),
		);
		await page.screenshot({ path: `${shotsDir}/T004-state-after.png`, fullPage: true });
		await writeFile(
			`${shotsDir}/T004-witness.json`,
			`${JSON.stringify({ origin, before, after, assetPath, failures }, undefined, '\t')}\n`,
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
