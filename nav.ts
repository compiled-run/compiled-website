/**
 * One page. `sprite` and `number` are what the sidebar paints beside the title;
 * they are optional because the `concepts` map below reuses this type for links
 * that never appear in the sidebar.
 */
export type NavEntry = {
	readonly title: string;
	readonly href: string;
	readonly sprite?: string;
	readonly number?: string;
};
export type NavSection = {
	readonly title: string;
	readonly sprite: string;
	readonly entries: readonly NavEntry[];
};

export const siteName = 'Markless';

export const nav: readonly NavSection[] = [
	{
		title: 'Start here',
		sprite: 'star-face',
		entries: [
			{ title: 'What is Markless', href: '/markless', sprite: 'crown', number: '1' },
			{
				title: 'Reading a .tsrx file',
				href: '/markless/start/reading-tsrx',
				sprite: 'bookmark',
				number: '2',
			},
		],
	},
	{
		title: 'Core concepts',
		sprite: 'bolt',
		entries: [
			{ title: 'State', href: '/markless/concepts/state', sprite: 'sparkle', number: '1' },
			{ title: 'Computed', href: '/markless/concepts/computed', sprite: 'spiral', number: '2' },
			{ title: 'Events', href: '/markless/concepts/events', sprite: 'bolt', number: '3' },
			{
				title: 'Conditionals',
				href: '/markless/concepts/conditionals',
				sprite: 'corner-bracket',
				number: '4',
			},
			{ title: 'Lists', href: '/markless/concepts/lists', sprite: 'dashes', number: '5' },
		],
	},
];

/** Every entry in reading order, which is what the prev/next pager walks. */
export const flatNav: readonly NavEntry[] = nav.flatMap((section) => section.entries);

export type Crumb = { readonly section: string; readonly page: string };

/**
 * The header's trail for one pathname: the section it belongs to and its own
 * title. An unknown path (a 404, say) gets two empty strings rather than a
 * throw, and the header renders the mug on its own.
 */
export function breadcrumbFor(pathname: string): Crumb {
	for (const section of nav)
		for (const entry of section.entries)
			if (entry.href === pathname) return { section: section.title, page: entry.title };
	return { section: '', page: '' };
}

export type Pager = {
	readonly prevTitle: string;
	readonly prevHref: string;
	readonly nextTitle: string;
	readonly nextHref: string;
};

/** The neighbours of one pathname in `flatNav`. Missing ends are empty strings. */
export function pagerFor(pathname: string): Pager {
	const at = flatNav.findIndex((entry) => entry.href === pathname);
	const previous = at > 0 ? flatNav[at - 1] : undefined;
	const next = at >= 0 && at + 1 < flatNav.length ? flatNav[at + 1] : undefined;
	return {
		prevTitle: previous ? previous.title : '',
		prevHref: previous ? previous.href : '',
		nextTitle: next ? next.title : '',
		nextHref: next ? next.href : '',
	};
}

/**
 * The concepts a page can say it assumes, keyed by the short name a page writes
 * in its `assumes` prop. Keys are what an author types; titles and hrefs are
 * what the reader sees and follows, so a page never spells a URL itself.
 */
export const concepts: Readonly<Record<string, NavEntry>> = {
	'reading-tsrx': { title: 'reading a .tsrx file', href: '/markless/start/reading-tsrx' },
	computed: { title: 'computed', href: '/markless/concepts/computed' },
	conditionals: { title: 'conditionals', href: '/markless/concepts/conditionals' },
	events: { title: 'events', href: '/markless/concepts/events' },
	lists: { title: 'lists', href: '/markless/concepts/lists' },
	state: { title: 'state', href: '/markless/concepts/state' },
};

export type AssumesItem = {
	readonly key: string;
	readonly title: string;
	readonly href: string;
	readonly known: boolean;
	/** The separator printed before this item: nothing for the first, a comma after. */
	readonly lead: string;
};

/**
 * Resolves a page's comma-separated `assumes` keys against `concepts`.
 * `nothing` (or an empty string) resolves to no items at all, which is how the
 * page-meta line keeps printing the word plainly. A key with no concept behind
 * it is returned unknown, so the caller prints it as text rather than a dead
 * link, and a warning names it while the page is being built.
 */
export function assumesFor(assumes: string): readonly AssumesItem[] {
	const trimmed = assumes.trim();
	if (trimmed === '' || trimmed.toLowerCase() === 'nothing') return [];
	return trimmed
		.split(',')
		.map((one) => one.trim())
		.filter((one) => one !== '')
		.map((key, index) => {
			const concept = concepts[key];
			if (!concept)
				console.warn(
					`page-meta: "assumes" names "${key}", which is not a key in the concepts map in nav.ts. ` +
						'Printing it as plain text; add it to the map to make it a link.',
				);
			return {
				key,
				title: concept ? concept.title : key,
				href: concept ? concept.href : '',
				known: Boolean(concept),
				lead: index === 0 ? '' : ', ',
			};
		});
}
