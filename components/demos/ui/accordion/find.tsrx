import { accordion } from '@markless/ui';
import Preview from '../../../ui/preview.tsrx';

export default function AccordionFind({ shows }: { readonly shows: string }) @{
	<Preview shows={shows}>
		<accordion.root class="demo-accordion" value="ship">
			<accordion.item value="ship">
				<accordion.itemlabel>
					<accordion.itemtrigger>When does my order ship?</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Orders leave within two working days.</accordion.itemcontent>
			</accordion.item>
			<accordion.item value="overseas">
				<accordion.itemlabel>
					<accordion.itemtrigger>Do you ship overseas?</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Everywhere but Antarctica, which keeps losing our parcels.</accordion.itemcontent>
			</accordion.item>
		</accordion.root>
	</Preview>
}
