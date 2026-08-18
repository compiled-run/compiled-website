import { markless } from '@markless/core/vite';
import { router } from '@markless/router/vite';
import { defineConfig } from 'vite-plus';
import { highlightMdx } from './tooling/highlight-mdx.ts';

export default defineConfig({
	base: '/markless/',
	nitro: { baseURL: '/markless/' },
	// highlightMdx runs after router(): it rewrites the module router() emits.
	plugins: [markless(), router(), highlightMdx()],
});
