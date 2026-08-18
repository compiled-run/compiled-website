export default function Collapsible({ summary, text }: { readonly summary: string; readonly text: string }) @{
	<details class="collapsible">
		<summary>{summary}</summary>
		<p>{text}</p>
	</details>
}
