import { accordion } from '@markless/ui';
import Preview from '../../../ui/preview.tsrx';

export default function AccordionLocked({ shows }: { readonly shows: string }) @{
	<Preview shows={shows}>
		<accordion.root class="demo-accordion" value="ship" collapsible={false}>
			<accordion.item value="ship">
				<accordion.itemlabel>
					<accordion.itemtrigger>Standard delivery</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Two working days, no charge over twenty pounds.</accordion.itemcontent>
			</accordion.item>
			<accordion.item value="express">
				<accordion.itemlabel>
					<accordion.itemtrigger>Express delivery</accordion.itemtrigger>
				</accordion.itemlabel>
				<accordion.itemcontent>Next working day if you order before noon.</accordion.itemcontent>
			</accordion.item>
		</accordion.root>
	</Preview>
}
