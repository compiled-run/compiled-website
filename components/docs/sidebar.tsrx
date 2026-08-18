// nav.ts is the single source for these links: the sidebar loops it, and the
// header's breadcrumb and the pager read the same file.
//
// Each entry carries three columns — a sprite, its number inside the section,
// and the title — so the icons and numbers line up down the column.
import Mascot from '../mascot.tsrx';
import Sprite from '../sprite.tsrx';
import { nav } from '../../nav.ts';

export default function Sidebar({ pathname }: { readonly pathname: string }) @{
	<nav class="sidebar" aria-label="Documentation">
		<a class="site-mark" href="/markless">
			<Mascot name="markless" size="3.4rem" variant="mark" />
			<span class="site-name">Markless</span>
		</a>
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
	</nav>
}
