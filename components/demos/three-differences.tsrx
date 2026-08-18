import { state } from '@markless/core';

export default function ThreeDifferences() @{
	let picked = state('body');

	<section class="explorer">
		<div class="playground-controls">
			<button class={picked === 'body' ? 'pick is-picked' : 'pick'} onClick={() => picked = 'body'}>
				The body
			</button>
			<button class={picked === 'markup' ? 'pick is-picked' : 'pick'} onClick={() => picked = 'markup'}>
				The markup
			</button>
			<button
				class={picked === 'fragment' ? 'pick is-picked' : 'pick'}
				onClick={() => picked = 'fragment'}
			>
				The fragment
			</button>
		</div>
		<pre class="file-lines">
			<span class="file-line">{"import { state } from '@markless/core';"}</span>
			<span class="file-line">{' '}</span>
			<span class={picked === 'body' ? 'file-line is-lit' : 'file-line'}>
				{'export default function Counter() @{'}
			</span>
			<span class="file-line">{'  let count = state(0);'}</span>
			<span class={picked === 'fragment' ? 'file-line is-lit' : 'file-line'}>{'  <>'}</span>
			<span class={picked === 'markup' ? 'file-line is-lit' : 'file-line'}>
				{'    <button onClick={() => count++}>Clicked {count} times</button>'}
			</span>
			<span class={picked === 'fragment' ? 'file-line is-lit' : 'file-line'}>{'  </>'}</span>
			<span class={picked === 'body' ? 'file-line is-lit' : 'file-line'}>{'}'}</span>
		</pre>
		<p class="explorer-note">
			{picked === 'body'
				? 'The body is written @{ } rather than { }. Ordinary statements live inside it, and so does the markup.'
				: picked === 'markup'
					? 'The markup is a statement. You write the element on its own line and the compiler takes it as the output. Nothing is returned.'
					: 'A fragment is <> and </>. It is how a component renders more than one thing side by side without inventing a wrapper element.'}
		</p>
	</section>
}
