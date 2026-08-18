// nav.ts is the single source for these links: the sidebar loops it, and the
// header's breadcrumb and the pager read the same file.
//
// Each entry carries three columns: the entry's own hand-drawn icon, its number
// inside the section, and the title, so the icons and numbers line up down the
// column. The icon is in the markup twice, light variant and dark variant, and
// CSS shows the one that matches the theme, because CSS cannot swap an `src`.
// The reference page is the one entry with no icon of its own on the sheet, so
// it keeps the crayon doodle it always had, in the same two-cut shape.
//
// The list is inside a <details> so a phone gets one line of navigation instead
// of nineteen. It has no `open` attribute, so it is shut by default and the
// stylesheet opens it again above 70rem, where the column is beside the prose
// rather than on top of it.
import Mascot from '../mascot.tsrx';
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
					<p class={section.stroke ? 'sidebar-title has-stroke stroke-' + section.stroke : 'sidebar-title'}>
						{section.title}
					</p>
					<ul class="sidebar-list">
						@for (const entry of section.entries; key entry.href) {
							<li>
								<a
									class={pathname === entry.href ? 'sidebar-link is-active' : 'sidebar-link'}
									href={entry.href}
								>
									<span class="nav-icon">
										<img
											class="nav-icon-ink nav-icon-light"
											src={
												entry.icon
													? '/markless/sidebar/' + entry.icon + '-light.png'
													: '/markless/sprites/' + (entry.sprite ?? 'sparkle') + '.png'
											}
											alt=""
											aria-hidden="true"
											decoding="async"
										/>
										<img
											class="nav-icon-ink nav-icon-dark"
											src={
												entry.icon
													? '/markless/sidebar/' + entry.icon + '-dark.png'
													: '/markless/sprites/' + (entry.sprite ?? 'sparkle') + '.dark.png'
											}
											alt=""
											aria-hidden="true"
											decoding="async"
										/>
									</span>
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
