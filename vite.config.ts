import { markless } from '@markless/core/vite';
import { router } from '@markless/router/vite';
import { defineConfig } from 'vite-plus';
import { highlightMdx } from './tooling/highlight-mdx.ts';
import { uiDemos } from './tooling/ui-demos.ts';

export default defineConfig({
	base: '/markless/',
	nitro: { baseURL: '/markless/' },
	// uiDemos runs before router(): it rewrites the .mdx source router() parses.
	// highlightMdx runs after router(): it rewrites the module router() emits.
	plugins: [uiDemos(), markless(), router(), highlightMdx()],
});
