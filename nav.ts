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

export type AssumesSlot = {
	readonly lead: string;
	readonly title: string;
	readonly href: string;
	readonly linkClass: string;
	readonly textClass: string;
};

export type AssumesLine = {
	/** Printed as written: "nothing", or the tail of a list longer than three. */
	readonly plain: string;
	readonly one: AssumesSlot;
	readonly two: AssumesSlot;
	readonly three: AssumesSlot;
};

const HIDDEN = 'is-hidden';
const emptySlot: AssumesSlot = {
	lead: '',
	title: '',
	href: '/markless',
	linkClass: `page-meta-assume-link ${HIDDEN}`,
	textClass: `page-meta-assume-plain ${HIDDEN}`,
};

function slotFor(item: AssumesItem | undefined): AssumesSlot {
	if (!item) return emptySlot;
	return {
		lead: item.lead,
		title: item.title,
		href: item.known ? item.href : '/markless',
		linkClass: item.known ? 'page-meta-assume-link' : `page-meta-assume-link ${HIDDEN}`,
		textClass: item.known ? `page-meta-assume-plain ${HIDDEN}` : 'page-meta-assume-plain',
	};
}

/**
 * The `assumes` line as three fixed slots rather than a list, because neither
 * `@for` nor `@if` renders anything on 0.3.0 — not in the document shell
 * (NOTES.md finding 3) and, as this page-meta line proved, not inside a page
 * component either. Three is what the pages need; a fourth key onwards is
 * printed as plain text so nothing is silently dropped.
 */
export function assumesLine(assumes: string): AssumesLine {
	const items = assumesFor(assumes);
	const overflow = items.slice(3);
	if (overflow.length > 0)
		console.warn(
			`page-meta: "assumes" names ${items.length} concepts and the line has three link slots; ` +
				`${overflow.map((one) => one.key).join(', ')} will be printed as plain text.`,
		);
	return {
		plain:
			items.length === 0
				? assumes
				: overflow.map((one) => `${one.lead}${one.title}`).join(''),
		one: slotFor(items[0]),
		two: slotFor(items[1]),
		three: slotFor(items[2]),
	};
}
