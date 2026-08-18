import Sprite from '../sprite.tsrx';

export default function Collapsible({
	summary,
	text,
	sprite,
}: {
	readonly summary: string;
	readonly text: string;
	readonly sprite?: string;
}) @{
	<details class="collapsible">
		<summary>
			<Sprite name={sprite ?? 'thought-bubble'} size="1.4em" />
			{summary}
		</summary>
		<p>{text}</p>
	</details>
}
