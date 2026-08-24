// The stage at the top of every UI family page. It is deliberately empty: the
// package is not vendored into this site yet, so nothing in here pretends to be
// a running component. `shows` is one phrase naming what the example under the
// frame builds, so twenty pages do not carry twenty identical boxes.
//
// Props only, no state and no construct: a page's islands are located by
// counting the elements before them, and every cell or arm this component added
// would move the ones after it (NOTES.md findings 25 and 29).
export default function Preview({ shows }: { readonly shows: string }) @{
	<div class="ui-preview">
		<p class="ui-preview-shows">{shows}</p>
		<p class="ui-preview-note">
			Not running yet — the package lands in this site next. The code under the frame is the whole
			of it.
		</p>
	</div>
}
