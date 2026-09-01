// The keyboard table a family page carries. The page passes rows as data and this
// file owns every presentation decision, so a keycap is drawn the same way on every
// page in the fleet. Keycap styling lives in styles/global.css, not in a block here:
// a component whose only styling is its own style block renders unstyled on this
// build (NOTES.md finding 26).
//
// NOT WIRED INTO A PAGE YET, and it renders correctly: putting this and api-table
// on accordion.mdx left the page's accordion demos dead, because MDX composition
// drops part of a second island's payload (NOTES.md findings 11, 14 and 25). The
// same trusted click opened the demo with the tables written as markdown and did
// nothing with these two components on the page. Wire it up when that is fixed.
export type KeyboardRow = {
	/** One keycap per entry: `['Enter', 'Space']` draws two. */
	readonly keys: readonly string[];
	/** The word drawn between two keycaps. `or` for alternatives, `+` for a chord. */
	readonly join?: string;
	/** What pressing them does. */
	readonly does: string;
};

export default function KeyboardTable({ rows }: { readonly rows: readonly KeyboardRow[] }) @{
	// The separator is folded into each keycap as the thing drawn before it, because
	// a loop cannot interleave a second element between its own iterations.
	const painted = rows.map((row) => ({
		does: row.does,
		caps: row.keys.map((key, index) => ({
			key,
			lead: index === 0 ? '' : (row.join ?? 'or'),
		})),
	}));

	<table class="keyboard-table">
		<thead>
			<tr>
				<th>Key</th>
				<th>What it does</th>
			</tr>
		</thead>
		<tbody>
			@for (const row of painted; key row.does) {
				<tr>
					<td class="keyboard-keys">
						@for (const cap of row.caps; key cap.key) {
							<span class="kbd-cap">
								<span class="kbd-join">{cap.lead}</span>
								<kbd class="kbd">{cap.key}</kbd>
							</span>
						}
					</td>
					<td>{row.does}</td>
				</tr>
			}
		</tbody>
	</table>
}
