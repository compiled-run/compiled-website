/**
 * One page. `sprite` and `number` are what the sidebar paints beside the title;
 * they are optional because the `concepts` map below reuses this type for links
 * that never appear in the sidebar.
 */
export type NavEntry = {
	readonly title: string;
	readonly href: string;
	readonly sprite?: string;
	/**
	 * The hand-drawn icon the sidebar paints for this entry, cut in a light and a
	 * dark variant into `public/sidebar/<icon>-{light,dark}.png`. It is the href's
	 * last segment for every sidebar page; entries that never reach the sidebar
	 * leave it out.
	 */
	readonly icon?: string;
	readonly number?: string;
	/**
	 * One sentence about the page, for the document head, `sitemap.xml` and
	 * `llms.txt`. Every sidebar page carries one; the `concepts` map below
	 * reuses this type for links that are not pages of their own, and those
	 * leave it out.
	 */
	readonly description?: string;
};
export type NavSection = {
	readonly title: string;
	readonly sprite: string;
	/** The colour of the hand-drawn underline under this section's title. */
	readonly stroke?: string;
	readonly entries: readonly NavEntry[];
};

export const siteName = 'Markless';

export const nav: readonly NavSection[] = [
	{
		title: 'Start here',
		stroke: 'pink',
		sprite: 'star-face',
		entries: [
			{
				title: 'What is Markless',
				href: '/markless',
				sprite: 'crown',
				icon: 'what-is-markless',
				number: '1',
				description:
					'What Markless is: the reliable way to build software with AI agents. Plain TypeScript functions, a compiler that checks the whole interface before anything ships, and nothing hidden to trip over.',
			},
			{
				title: 'Your first app',
				href: '/markless/start/first-app',
				sprite: 'plus',
				icon: 'first-app',
				number: '2',
				description:
					'Scaffold a Markless app with one command, then live in the dev, build and preview scripts, with the npm override a clean install needs today.',
			},
			{
				title: 'Reading a .tsrx file',
				href: '/markless/start/reading-tsrx',
				sprite: 'bookmark',
				icon: 'reading-tsrx',
				number: '3',
				description:
					'A .tsrx file is TypeScript with three unfamiliar things in it: the at-sign body, markup written as a statement, and the fragment. That is the whole list.',
			},
		],
	},
	{
		title: 'Core concepts',
		stroke: 'purple',
		sprite: 'bolt',
		entries: [
			{
				title: 'State',
				href: '/markless/concepts/state',
				sprite: 'sparkle',
				icon: 'state',
				number: '1',
				description:
					'state() is how you tell the page to watch a variable. No wrapper, no setter and no .value: you read it and assign to it like any other let.',
			},
			{
				title: 'Computed',
				href: '/markless/concepts/computed',
				sprite: 'spiral',
				icon: 'computed',
				number: '2',
				description:
					'A value you work out is never out of date. computed() derives one value from others and works it out again when one of them changes.',
			},
			{
				title: 'Events',
				href: '/markless/concepts/events',
				sprite: 'bolt',
				icon: 'events',
				number: '3',
				description:
					'An event prop is on plus the DOM event name, and the browser hands your handler its own typed event object.',
			},
			{
				title: 'Conditionals',
				href: '/markless/concepts/conditionals',
				sprite: 'corner-bracket',
				icon: 'conditionals',
				number: '4',
				description:
					'@if puts real elements into the page and takes them out again, and anything declared inside the branch is disposed along with it.',
			},
			{
				title: 'Lists',
				href: '/markless/concepts/lists',
				sprite: 'dashes',
				icon: 'lists',
				number: '5',
				description:
					'A key answers the question of which row is which. Once a row has one, its state, its DOM and its event wiring move with it through a sort.',
			},
			{
				title: 'Async',
				href: '/markless/concepts/async',
				sprite: 'arrow-loop',
				icon: 'async',
				number: '6',
				description:
					'Waiting is a block, not a flag: @try, @pending and @catch are the whole status vocabulary, so there is no loading boolean to forget.',
			},
			{
				title: 'Styling',
				href: '/markless/concepts/styling',
				sprite: 'flower',
				icon: 'styling',
				number: '7',
				description:
					'A style block written inside a component styles that component and nothing else, so two components can both call something .card.',
			},
		],
	},
	{
		title: 'Building an app',
		stroke: 'yellow',
		sprite: 'crown',
		entries: [
			{
				title: 'Components',
				href: '/markless/build/components',
				sprite: 'crown',
				icon: 'components',
				number: '1',
				description:
					'A component is a function and props are its parameters, callbacks and children included, with the parent value read through live.',
			},
			{
				title: 'Elements',
				href: '/markless/build/elements',
				sprite: 'bolt',
				icon: 'elements',
				number: '2',
				description:
					'A DOM node is not state. element() hands you a claim ticket for one node, bound with el, that you cash in inside a handler.',
			},
			{
				title: 'Storage',
				href: '/markless/build/storage',
				sprite: 'bookmark',
				icon: 'storage',
				number: '3',
				description:
					'storage() is a variable you read and write like any other, saved in the browser and applied before the first paint.',
			},
			{
				title: 'Shared',
				href: '/markless/build/shared',
				sprite: 'spiral',
				icon: 'shared',
				number: '4',
				description:
					'shared() gives a piece of data a name, so a component that wants it calls the name instead of having it threaded down through props.',
			},
		],
	},
	{
		title: 'Router',
		stroke: 'green',
		sprite: 'arrow-straight',
		entries: [
			{
				title: 'Pages',
				href: '/markless/router/pages',
				sprite: 'square',
				icon: 'pages',
				number: '1',
				description:
					'A file under pages/ is a URL, brackets in the file name are parameters, and the path on disk is the path in the address bar.',
			},
			{
				title: 'Links',
				href: '/markless/router/links',
				sprite: 'arrow-curve',
				icon: 'links',
				number: '2',
				description:
					'A link is a route plus its parts rather than a string you build, so a renamed folder is a type error instead of a 404.',
			},
			{
				title: 'Page data',
				href: '/markless/router/data',
				sprite: 'drops',
				icon: 'data',
				number: '3',
				description:
					'There is no loader: a page receives the request in its props, and an async computed that reads them is the load.',
			},
		],
	},
	{
		title: 'How it works',
		stroke: 'yellow',
		sprite: 'rays',
		entries: [
			{
				title: 'How it works',
				href: '/markless/how-it-works',
				sprite: 'rays',
				icon: 'how-it-works',
				number: '1',
				description:
					'Follow one click from the compiled artifact down to the DOM update, through the five tiers of the arm rendering ladder.',
			},
		],
	},
	{
		title: 'Reference',
		sprite: 'hash',
		entries: [
			{
				title: 'Reference',
				href: '/markless/reference',
				sprite: 'hash',
				number: '1',
				description:
					'Every authoring call, TSRX construct, router export and MARKLESS_ diagnostic on published 0.3.1, in the order you reach for them.',
			},
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

export const siteDescription =
	'The Markless documentation: a framework whose compiler works out what changes while it builds your file, so the browser ships the update rather than the machinery for finding it.';

/** Where this site is served, which is what an absolute URL in `sitemap.xml` needs. */
export const siteOrigin = 'https://compiled.run';

export type Head = { readonly title: string; readonly description: string };

/**
 * The document head for one pathname. Every page's title is its own, because
 * nineteen identical tabs and nineteen identical search results are nineteen
 * pages a reader cannot tell apart. An unknown path (a 404, say) falls back to
 * the site's own name and sentence rather than throwing.
 */
export function headFor(pathname: string): Head {
	const entry = flatNav.find((one) => one.href === pathname);
	if (!entry) return { title: `${siteName} docs`, description: siteDescription };
	return {
		title: `${entry.title} | ${siteName} docs`,
		description: entry.description ?? siteDescription,
	};
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
	'first-app': { title: 'your first app', href: '/markless/start/first-app' },
	'reading-tsrx': { title: 'reading a .tsrx file', href: '/markless/start/reading-tsrx' },
	async: { title: 'async', href: '/markless/concepts/async' },
	computed: { title: 'computed', href: '/markless/concepts/computed' },
	conditionals: { title: 'conditionals', href: '/markless/concepts/conditionals' },
	events: { title: 'events', href: '/markless/concepts/events' },
	lists: { title: 'lists', href: '/markless/concepts/lists' },
	state: { title: 'state', href: '/markless/concepts/state' },
	styling: { title: 'styling', href: '/markless/concepts/styling' },
	components: { title: 'components', href: '/markless/build/components' },
	elements: { title: 'elements', href: '/markless/build/elements' },
	storage: { title: 'storage', href: '/markless/build/storage' },
	shared: { title: 'shared', href: '/markless/build/shared' },
	routes: { title: 'routes are files', href: '/markless/router/pages' },
	links: { title: 'links', href: '/markless/router/links' },
	data: { title: 'page data', href: '/markless/router/data' },
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
