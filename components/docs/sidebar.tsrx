// nav.ts is the intended single source for these links, but @for renders nothing
// in the document shell on published 0.2.2 (see NOTES.md), so they are written out.
// Keep this list and nav.ts in step: the witness visits every entry in nav.ts.
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
						What is Markless
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/start/reading-tsrx' ? 'sidebar-link is-active' : 'sidebar-link'
						}
						href="/markless/start/reading-tsrx"
					>
						Reading a .tsrx file
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
						State
					</a>
				</li>
				<li>
					<a
						class={
							pathname === '/markless/concepts/computed' ? 'sidebar-link is-active' : 'sidebar-link'
						}
						href="/markless/concepts/computed"
					>
						Computed
					</a>
				</li>
			</ul>
		</div>
	</nav>
}
