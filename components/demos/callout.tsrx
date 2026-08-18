export default function Callout({ title, text }: { readonly title: string; readonly text: string }) @{
	<aside class="callout">
		<p class="callout-title">{title}</p>
		<p class="callout-body">{text}</p>
	</aside>
}
