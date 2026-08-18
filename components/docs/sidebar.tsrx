// nav.ts is the single source for these links: the sidebar loops it, and the
// header's breadcrumb and the pager read the same file.
//
// Each entry carries three columns: a sprite, its number inside the section,
// and the title, so the icons and numbers line up down the column.
//
// The list is inside a <details> so a phone gets one line of navigation instead
// of nineteen. It has no `open` attribute, so it is shut by default and the
// stylesheet opens it again above 70rem, where the column is beside the prose
// rather than on top of it.
import Mascot from '../mascot.tsrx';
import Sprite from '../sprite.tsrx';
import { nav } from '../../nav.ts';

export default function Sidebar({ pathname }: { readonly pathname: string }) @{
	<nav class="sidebar" aria-label="Documentation">
		<a class="site-mark" href="/markless">
			<Mascot name="markless" size="3.4rem" variant="mark" />
			<span class="site-name">Markless</span>
		</a>
		<details class="sidebar-disclosure">
			<summary class="sidebar-summary">All pages</summary>
			@for (const section of nav; key section.title) {
				<div class="sidebar-section">
					<p class="sidebar-title">
						<Sprite name={section.sprite} size="1.15em" />
						{section.title}
					</p>
					<ul class="sidebar-list">
						@for (const entry of section.entries; key entry.href) {
							<li>
								<a
									class={pathname === entry.href ? 'sidebar-link is-active' : 'sidebar-link'}
									href={entry.href}
								>
									<Sprite name={entry.sprite ?? 'sparkle'} size="1.1em" />
									<span class="sidebar-num">{entry.number ?? ''}</span>
									<span class="sidebar-text">{entry.title}</span>
								</a>
							</li>
						}
					</ul>
				</div>
			}
		</details>
	</nav>
}
