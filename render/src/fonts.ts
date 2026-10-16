import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Montserrat (legenda, cartões, HUD, selos) vem dentro do motor: o Debian da imagem não tem o
 * pacote e o navegador do preview também não teria. Sem ela o texto cai na fonte da marca e
 * a legenda perde o peso 800 do estilo. O render espera a fonte carregar; se o arquivo
 * faltar, segue com a fonte da marca em vez de derrubar o vídeo.
 */
const handle = typeof document === "undefined" ? null : delayRender("fonte Montserrat");

if (handle !== null) {
	const montserrat = new FontFace(
		"Montserrat",
		`url('${staticFile("fonts/Montserrat-VariableFont_wght.ttf")}') format('truetype')`,
		{ weight: "100 900" },
	);
	montserrat
		.load()
		.then((loaded) => {
			document.fonts.add(loaded);
		})
		.catch(() => undefined)
		.finally(() => {
			continueRender(handle);
		});
}
