// The bar across the top of every page: where you are, a search slot, a theme
// slot, and the repo. The trail and the titles come from `nav.ts` through
// `breadcrumbFor`, which is plain TypeScript, so the component itself carries no
// loop — `@for` still renders nothing on the document path (NOTES.md finding 3).
//
// Search and the theme toggle are deliberately inert: there is no index to
// search yet, and a theme toggle needs a store the framework cannot resume on
// 0.3.0 (NOTES.md finding 15). Both carry the markup a working control needs.
import Mascot from '../mascot.tsrx';
import Sprite from '../sprite.tsrx';
import { breadcrumbFor } from '../../nav.ts';

export default function SiteHeader({ pathname }: { readonly pathname: string }) @{
	const crumb = breadcrumbFor(pathname);

	<header class="site-header">
		<a class="crumb crumb-home" href="/markless">
			<Mascot name="markless" size="1.7rem" variant="crumb" />
			<span>Markless</span>
		</a>
		<span class="crumb-sep crumb-sep-section" aria-hidden="true">▸</span>
		<span class="crumb crumb-section">{crumb.section}</span>
		<span class="crumb-sep" aria-hidden="true">▸</span>
		<span class="crumb crumb-page">{crumb.page}</span>
		<div class="header-tools">
			<input
				class="site-search"
				type="search"
				placeholder="Search"
				aria-label="Search"
				title="Search is coming"
				disabled="disabled"
			/>
			<button
				class="theme-toggle"
				type="button"
				data-theme-toggle="true"
				aria-label="Switch theme"
				title="The theme toggle is coming"
			>
				<Sprite name="sun" size="1.15em" />
			</button>
			<a class="header-link" href="https://github.com/compiled-run/markless">GitHub</a>
		</div>
	</header>
}
