"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
	{ href: "/estudio", label: "Hoje" },
	{ href: "/estudio/contas", label: "Contas" },
	{ href: "/apps", label: "Apps & anúncios" },
];

/** Navegação do estúdio. As telas de anúncio (/apps) seguem com o cabeçalho delas. */
export function StudioNav() {
	const path = usePathname();

	return (
		<nav className="row" style={{ gap: 4, padding: "12px 24px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
			<span style={{ fontWeight: 800, letterSpacing: 2, fontSize: 12, marginRight: 16 }}>
				ESTÚDIO <span className="muted" style={{ fontWeight: 400 }}>de conteúdo</span>
			</span>
			{LINKS.map((l) => {
				const active = l.href === "/estudio" ? path === "/estudio" : path.startsWith(l.href);

				return (
					<Link
						key={l.href}
						href={l.href}
						style={{
							textDecoration: "none",
							padding: "6px 12px",
							borderRadius: 999,
							fontSize: 13,
							background: active ? "var(--panel-2)" : "transparent",
							color: active ? "var(--fg)" : "var(--muted)",
							border: `1px solid ${active ? "var(--line)" : "transparent"}`,
						}}
					>
						{l.label}
					</Link>
				);
			})}
		</nav>
	);
}
