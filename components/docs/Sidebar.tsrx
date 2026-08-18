// nav.ts is the intended single source for these links, but @for renders nothing
// in the document shell on published 0.2.2 (see NOTES.md), so they are written out.
export default function Sidebar({ pathname }: { readonly pathname: string }) @{
	<nav class="sidebar" aria-label="Documentation">
		<div class="sidebar-section">
			<p class="sidebar-title">Start here</p>
			<ul class="sidebar-list">
				<li>
					<a class={pathname === '/markless' ? 'sidebar-link is-active' : 'sidebar-link'} href="/markless">
						What is Markless
					</a>
				</li>
			</ul>
		</div>
		<div class="sidebar-section">
			<p class="sidebar-title">Core concepts</p>
			<ul class="sidebar-list">
				<li>
					<a
						class={pathname === '/markless/concepts/state' ? 'sidebar-link is-active' : 'sidebar-link'}
						href="/markless/concepts/state"
					>
						State
					</a>
				</li>
			</ul>
		</div>
	</nav>
}
