// The per-part props table a family page carries. The page passes rows as data;
// this file decides that a prop's type belongs in a hover doc rather than a third
// column, so the table stays narrow enough to read on a phone.
//
// The hover doc is the markup `tooling/highlight-code.ts` builds for a TSRX token
// (`.tsrx-hover` plus `.tsrx-tip`), reused deliberately: the dashed underline, the
// keyboard focus and the screen-reader label are then the site's one idiom rather
// than a second one that has to be kept in step.
//
// NOT WIRED INTO A PAGE YET, and it renders correctly: see the note in
// keyboard-table.tsrx. Two of these on accordion.mdx left the page's accordion
// demos dead (NOTES.md findings 11, 14 and 25).
export type ApiRow = {
	/** The prop, written as the consumer writes it. */
	readonly name: string;
	/** Its type, copied verbatim from the family's own types file. */
	readonly type: string;
	/** What it buys you. Text between backticks is drawn as inline code. */
	readonly does: string;
	/** Required props are drawn bold and should open `does` with "Required." */
	readonly required?: boolean;
};

export default function ApiTable({ rows }: { readonly rows: readonly ApiRow[] }) @{
	// `@if` hangs this build (see components/demos/callout.tsrx), so every choice
	// here is a class picked in TypeScript rather than an element left out.
	const painted = rows.map((row) => ({
		name: row.name,
		type: row.type,
		label: row.name + ': ' + row.type,
		nameClass: row.required === true ? 'api-prop is-required' : 'api-prop',
		parts: row.does.split('`').map((piece, index) => ({
			piece,
			id: row.name + ':' + index,
			partClass: index % 2 === 1 ? 'api-code' : 'api-text',
		})),
	}));

	<table class="api-table">
		<thead>
			<tr>
				<th>Prop</th>
				<th>What it does</th>
			</tr>
		</thead>
		<tbody>
			@for (const row of painted; key row.name) {
				<tr>
					<td>
						<span class="tsrx-hover prop-name" tabindex="0" role="img" aria-label={row.label}>
							<code class={row.nameClass}>{row.name}</code>
							<span class="tsrx-tip" aria-hidden="true">
								<span class="tsrx-tip-title">{row.name}</span>
								<span class="tsrx-tip-body">{row.type}</span>
							</span>
						</span>
					</td>
					<td>
						@for (const part of row.parts; key part.id) {
							<code class={part.partClass}>{part.piece}</code>
						}
					</td>
				</tr>
			}
		</tbody>
	</table>
}
