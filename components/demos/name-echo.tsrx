import { state } from '@markless/core';

export default function NameEcho() @{
	let name = state('');

	<form class="echo" onSubmit={(event) => event.preventDefault()}>
		<label class="echo-field">
			Your name
			<input value={name} onInput={(event) => (name = event.currentTarget.value)} />
		</label>
		<p class="playground-output">Hello, {name}</p>
		<button type="submit">Say hello</button>
	</form>
}
