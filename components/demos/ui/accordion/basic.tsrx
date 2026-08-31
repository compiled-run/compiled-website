// The page renders this, not the frame: the MDX route lowering turns a
// component's children into static HTML, so an imported component written
// between <Preview> tags in an .mdx file is refused outright. The frame is
// composed here instead, where children projection is ordinary Markless.
import Preview from '../../../ui/preview.tsrx';
import Faq from './faq.tsrx';

export default function AccordionDemo({ shows }: { readonly shows: string }) @{
	<Preview shows={shows}>
		<Faq />
	</Preview>
}
