export type NavEntry = { readonly title: string; readonly href: string };
export type NavSection = { readonly title: string; readonly entries: readonly NavEntry[] };

export const siteName = 'Markless';

export const nav: readonly NavSection[] = [
	{
		title: 'Start here',
		entries: [
			{ title: 'What is Markless', href: '/markless' },
			{ title: 'Reading a .tsrx file', href: '/markless/start/reading-tsrx' },
		],
	},
	{
		title: 'Core concepts',
		entries: [
			{ title: 'State', href: '/markless/concepts/state' },
			{ title: 'Computed', href: '/markless/concepts/computed' },
		],
	},
];
