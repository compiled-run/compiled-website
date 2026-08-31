import { accordion } from '@markless/ui';
import Preview from '../../ui/preview.tsrx';

export default function AccordionMultiple({ shows }: { readonly shows: string }) @{
	<Preview shows={shows}>
		<accordion.root class="demo-accordion" multiple value={['ship', 'returns']}>
			<accordion.item value="ship">
				<accordion.itemlabel>
					<accordion.itemtrigger>When does my order ship?</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Orders leave within two working days.</accordion.itemcontent>
			</accordion.item>
			<accordion.item value="returns">
				<accordion.itemlabel>
					<accordion.itemtrigger>How do I return something?</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Start a return from your orders page.</accordion.itemcontent>
			</accordion.item>
			<accordion.item value="overseas">
				<accordion.itemlabel>
					<accordion.itemtrigger>Do you ship overseas?</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Everywhere but Antarctica.</accordion.itemcontent>
			</accordion.item>
		</accordion.root>
	</Preview>
}
