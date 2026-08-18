export default function PageMeta({
	level,
	time,
	assumes,
}: {
	readonly level: string;
	readonly time: string;
	readonly assumes: string;
}) @{
	<p class="page-meta">
		<span class="page-meta-level">{level}</span>
		<span class="page-meta-sep">·</span>
		<span>{time}</span>
		<span class="page-meta-sep">·</span>
		<span>Assumes: {assumes}</span>
	</p>
}
