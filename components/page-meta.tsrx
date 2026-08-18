// The level / reading time / prerequisite line under every H1, plus the sprite
// that sits beside the title. MDX cannot nest a component inside a markdown
// heading, so the sprite rides here and CSS lifts it up next to the H1.
import Sprite from './sprite.tsrx';
import { assumesLine } from '../nav.ts';

export default function PageMeta({
	level,
	time,
	assumes,
	sprite,
}: {
	readonly level: string;
	readonly time: string;
	readonly assumes: string;
	readonly sprite?: string;
}) @{
	// `assumes` stays a plain comma-separated string of concept keys, so an MDX
	// page passes a literal, and nav.ts turns the keys into titles and hrefs. The
	// line is three fixed slots rather than a loop because neither `@for` nor
	// `@if` renders anything on 0.3.0 (NOTES.md finding 3), so an unused slot is
	// present and hidden. "nothing" resolves to no slots and prints as written.
	const assumed = assumesLine(assumes);

	<p class="page-meta">
		<span class="page-meta-sprite">
			<Sprite name={sprite ?? 'sparkle'} size="2.6em" />
		</span>
		<span class="page-meta-level">{level}</span>
		<span class="page-meta-sep">·</span>
		<span>{time}</span>
		<span class="page-meta-sep">·</span>
		<span>
			Assumes: {assumed.plain}
			<a class={assumed.one.linkClass} href={assumed.one.href}>{assumed.one.title}</a>
			<span class={assumed.one.textClass}>{assumed.one.title}</span>
			<span class="page-meta-assume-lead">{assumed.two.lead}</span>
			<a class={assumed.two.linkClass} href={assumed.two.href}>{assumed.two.title}</a>
			<span class={assumed.two.textClass}>{assumed.two.title}</span>
			<span class="page-meta-assume-lead">{assumed.three.lead}</span>
			<a class={assumed.three.linkClass} href={assumed.three.href}>{assumed.three.title}</a>
			<span class={assumed.three.textClass}>{assumed.three.title}</span>
		</span>
	</p>
}
