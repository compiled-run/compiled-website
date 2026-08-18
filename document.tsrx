import Sidebar from './components/docs/sidebar.tsrx';
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
			<div class="site-shell">
				<Sidebar pathname={pathname} />
				<main class="prose">{children}</main>
			</div>
		</body>
	</html>
}
