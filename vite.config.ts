import { markless } from '@markless/core/vite';
import { router } from '@markless/router/vite';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	base: '/markless/',
	nitro: { baseURL: '/markless/' },
	plugins: [markless(), router()],
});
