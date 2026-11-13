import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "XIBALBÁ AI | Protección inteligente", description: "Tu espacio para prevenir estafas digitales.", icons: { icon: "/xibalba-logo.jpg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
