// One import line per family instead of one per demo.
//
// `components/demos/ui/<family>/<example>.tsrx` is the whole convention:
// `basic.tsrx` is the hero, every other file is a named example, and the
// exported name is the file name in PascalCase (`find` -> `Find`,
// `until-found` -> `UntilFound`).
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

const PREFIX = 'ui-demos:';
const VIRTUAL = '\0ui-demos:';
const DEMOS_DIR = 'components/demos/ui';
const FAMILY = /^[a-z][a-z0-9-]*$/;

/** `basic` -> `Basic`, `until-found` -> `UntilFound`. */
function exportName(stem: string): string {
	return stem
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
}

type Demo = { readonly stem: string; readonly name: string; readonly file: string };

function readFamily(root: string, family: string): Demo[] {
	const dir = join(root, DEMOS_DIR, family);
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		throw new Error(
			`ui-demos: no demo folder for '${family}'. Expected ${DEMOS_DIR}/${family}/ with one .tsrx per example.`,
		);
	}
	const demos = entries
		.filter((entry) => entry.endsWith('.tsrx'))
		.sort()
		.map((entry) => {
			const stem = basename(entry, '.tsrx');
			return { stem, name: exportName(stem), file: join(dir, entry) };
		});
	if (demos.length === 0) throw new Error(`ui-demos: ${DEMOS_DIR}/${family}/ holds no .tsrx demos.`);
	return demos;
}

/**
 * Static imports and re-exports only. Each demo stays an ordinary .tsrx module
 * the Markless compiler sees on its own, and the family module is nothing but
 * bindings pointing at them.
 */
function moduleSource(demos: readonly Demo[]): string {
	const lines = demos.map(
		(demo, index) => `import demo${index} from ${JSON.stringify(demo.file)};`,
	);
	lines.push(
		`export { ${demos.map((demo, index) => `demo${index} as ${demo.name}`).join(', ')} };`,
	);
	// Inlined rather than imported with ?raw: the source text is what a page puts
	// in a code fence, and reading it here keeps the demo a single .tsrx module in
	// the graph instead of two.
	lines.push(
		`export const source = {${demos
			.map((demo) => `${JSON.stringify(demo.stem)}: ${JSON.stringify(readFileSync(demo.file, 'utf8'))}`)
			.join(', ')}};`,
	);
	return `${lines.join('\n')}\n`;
}

/**
 * Rewrites `import { Basic, Find } from 'ui-demos:accordion'` in an .mdx page
 * into the default imports the page would otherwise spell out by hand.
 *
 * This is a source rewrite and not virtual-module resolution because
 * @markless/router's MDX transform parses the page's own import statements and
 * accepts default imports from `.tsrx` specifiers only — a named import from a
 * bare specifier is refused before Vite resolution is ever reached.
 */
function expandMdxImports(code: string, id: string, root: string, watch: (file: string) => void): string | undefined {
	const pattern = /^import\s*\{([^}]*)\}\s*from\s*['"]ui-demos:([^'"]+)['"];?[ \t]*$/gm;
	let changed = false;
	const next = code.replace(pattern, (whole, names: string, family: string) => {
		if (!FAMILY.test(family))
			throw new Error(`ui-demos: '${family}' is not a family folder name (${id}).`);
		const demos = readFamily(root, family);
		const byName = new Map(demos.map((demo) => [demo.name, demo]));
		const from = dirname(id.split('?', 1)[0]);
		const wanted = names
			.split(',')
			.map((name) => name.trim())
			.filter((name) => name !== '');
		if (wanted.length === 0) return whole;
		changed = true;
		for (const demo of demos) watch(demo.file);
		return wanted
			.map((name) => {
				if (/\s/.test(name))
					throw new Error(
						`ui-demos: '${name}' renames a demo import, which ${id} cannot do; use the file's own name.`,
					);
				const demo = byName.get(name);
				if (!demo)
					throw new Error(
						`ui-demos: ${DEMOS_DIR}/${family}/ has no demo exporting '${name}'. It holds ${demos
							.map((entry) => entry.name)
							.join(', ')}.`,
					);
				let specifier = relative(from, demo.file);
				if (!specifier.startsWith('.')) specifier = `./${specifier}`;
				return `import ${name} from ${JSON.stringify(specifier)};`;
			})
			.join('\n');
	});
	return changed ? next : undefined;
}

export function uiDemos(): Plugin {
	let root = process.cwd();
	return {
		name: 'compiled-website:ui-demos',
		// Ahead of @markless/router's MDX transform, which reads the page's import
		// statements out of the .mdx source before anything else runs.
		enforce: 'pre',
		configResolved(config) {
			root = config.root;
		},
		configureServer(server) {
			const dir = resolve(root, DEMOS_DIR);
			server.watcher.add(dir);
			const invalidate = (file: string) => {
				if (!file.startsWith(dir) || !file.endsWith('.tsrx')) return;
				const family = relative(dir, file).split('/')[0];
				const virtual = server.moduleGraph.getModuleById(VIRTUAL + family);
				if (virtual) server.moduleGraph.invalidateModule(virtual);
				// A page's expanded import list is baked into its transform result,
				// so adding or removing a demo has to re-run that transform too.
				for (const module of server.moduleGraph.getModulesByFile(file) ?? [])
					for (const importer of module.importers) server.moduleGraph.invalidateModule(importer);
			};
			server.watcher.on('add', invalidate);
			server.watcher.on('unlink', invalidate);
		},
		resolveId(source) {
			if (!source.startsWith(PREFIX)) return;
			const family = source.slice(PREFIX.length);
			if (!FAMILY.test(family)) throw new Error(`ui-demos: '${family}' is not a family folder name.`);
			return VIRTUAL + family;
		},
		load(id) {
			if (!id.startsWith(VIRTUAL)) return;
			const demos = readFamily(root, id.slice(VIRTUAL.length));
			for (const demo of demos) this.addWatchFile(demo.file);
			return moduleSource(demos);
		},
		transform: {
			order: 'pre',
			handler(code: string, id: string) {
				if (!id.split('?', 1)[0].endsWith('.mdx') || !code.includes(PREFIX)) return;
				const next = expandMdxImports(code, id, root, (file) => this.addWatchFile(file));
				return next === undefined ? undefined : { code: next, map: null };
			},
		},
	};
}
