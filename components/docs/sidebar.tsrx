// nav.ts is the intended single source for these links, but @for renders nothing
// in the document shell on published 0.3.0 (see NOTES.md finding 3), so they are
// written out. Keep this list and nav.ts in step: the witness visits every entry
// in nav.ts, and the header's breadcrumb and the pager read nav.ts directly.
//
// Each entry carries three columns — a sprite, its number inside the section,
// and the title — so the icons and numbers line up down the column.
import Mascot from '../mascot.tsrx';
import Sprite from '../sprite.tsrx';

export default function Sidebar({ pathname }: { readonly pathname: string }) @{
	<nav class="sidebar" aria-label="Documentation">
		<a class="site-mark" href="/markless">
			<Mascot name="markless" size="3.4rem" variant="mark" />
			<span class="site-name">Markless</span>
		</a>
		<div class="sidebar-section">
			<p class="sidebar-title">
				<Sprite name="star-face" size="1.15em" />
				Start here
			</p>
			<ul class="sidebar-list">
				<li>
					<a class={pathname === '/markless' ? 'sidebar-link is-active' : 'sidebar-link'} href="/markless">
						<Sprite name="crown" size="1.1em" />
						<span class="sidebar-num">1</span>
						<span class="sidebar-text">What is Markless</span>
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/start/reading-tsrx' ? 'sidebar-link is-active' : 'sidebar-link'
						}
						href="/markless/start/reading-tsrx"
					>
						<Sprite name="bookmark" size="1.1em" />
						<span class="sidebar-num">2</span>
						<span class="sidebar-text">Reading a .tsrx file</span>
					</a>
				</li>
			</ul>
		</div>
		<div class="sidebar-section">
			<p class="sidebar-title">
				<Sprite name="bolt" size="1.15em" />
				Core concepts
			</p>
			<ul class="sidebar-list">
				<li>
					<a
						class={pathname === '/markless/concepts/state' ? 'sidebar-link is-active' : 'sidebar-link'}
						href="/markless/concepts/state"
					>
						<Sprite name="sparkle" size="1.1em" />
						<span class="sidebar-num">1</span>
						<span class="sidebar-text">State</span>
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/concepts/computed' ? 'sidebar-link is-active' : 'sidebar-link'
						}
						href="/markless/concepts/computed"
					>
						<Sprite name="spiral" size="1.1em" />
						<span class="sidebar-num">2</span>
						<span class="sidebar-text">Computed</span>
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/concepts/events' ? 'sidebar-link is-active' : 'sidebar-link'
						}
						href="/markless/concepts/events"
					>
						<Sprite name="bolt" size="1.1em" />
						<span class="sidebar-num">3</span>
						<span class="sidebar-text">Events</span>
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/concepts/conditionals'
								? 'sidebar-link is-active'
								: 'sidebar-link'
						}
						href="/markless/concepts/conditionals"
					>
						<Sprite name="corner-bracket" size="1.1em" />
						<span class="sidebar-num">4</span>
						<span class="sidebar-text">Conditionals</span>
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/concepts/lists' ? 'sidebar-link is-active' : 'sidebar-link'
						}
						href="/markless/concepts/lists"
					>
						<Sprite name="dashes" size="1.1em" />
						<span class="sidebar-num">5</span>
						<span class="sidebar-text">Lists</span>
					</a>
				</li>
			</ul>
		</div>
	</nav>
}
