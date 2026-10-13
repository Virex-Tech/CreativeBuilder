import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
	title: "Creative Engine",
	description: "Geração e variação de criativos para apps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body>{children}</body>
		</html>
	);
}
