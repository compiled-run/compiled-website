import Pager from './components/docs/pager.tsrx';
import Sidebar from './components/docs/sidebar.tsrx';
import SiteHeader from './components/docs/site-header.tsrx';
import stylesheet from './styles/global.css?url';

export default function Document({
	url,
	children,
}: {
	readonly url?: { readonly pathname: string };
	readonly children?: unknown;
}) @{
	const pathname = (url?.pathname ?? '/').replace(/\/+$/, '') || '/';

	<html>
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>Markless docs</title>
			<link rel="stylesheet" href={stylesheet} />
		</head>
		<body>
			<SiteHeader pathname={pathname} />
			<div class="site-shell">
				<Sidebar pathname={pathname} />
				<main class="prose">
					{children}
					<Pager pathname={pathname} />
				</main>
			</div>
		</body>
	</html>
}
