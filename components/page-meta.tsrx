// The level / reading time / prerequisite line under every H1, plus the sprite
// that sits beside the title. MDX cannot nest a component inside a markdown
// heading, so the sprite rides here and CSS lifts it up next to the H1.
import Sprite from './sprite.tsrx';

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
	<p class="page-meta">
		<span class="page-meta-sprite">
			<Sprite name={sprite ?? 'sparkle'} size="2.6em" />
		</span>
		<span class="page-meta-level">{level}</span>
		<span class="page-meta-sep">·</span>
		<span>{time}</span>
		<span class="page-meta-sep">·</span>
		<span>Assumes: {assumes}</span>
	</p>
}
