import Sprite from '../sprite.tsrx';

export default function Callout({
	title,
	text,
	sprite,
}: {
	readonly title: string;
	readonly text: string;
	readonly sprite?: string;
}) @{
	<aside class="callout">
		<p class="callout-title">
			<Sprite name={sprite ?? 'speech-bubble'} size="1.5em" />
			{title}
		</p>
		<p class="callout-body">{text}</p>
	</aside>
}
