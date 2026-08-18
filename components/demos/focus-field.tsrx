import { element, state } from '@markless/core';

export default function FocusField() @{
	let field = element<HTMLInputElement>();
	let status = state('The cursor is somewhere else');

	<section>
		<label class="echo-field">
			Your favourite word
			<input el={field} />
		</label>
		<button
			type="button"
			onClick={() => {
				field?.focus();
				status = 'The cursor is in the field';
			}}
		>
			Put the cursor in the field
		</button>
		<p class="playground-output">{status}</p>
	</section>
}
