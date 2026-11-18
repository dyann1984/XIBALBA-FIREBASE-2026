import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "XIBALBÁ AI | Protección inteligente",
  description:
    "Plataforma de prevención, detección e investigación de fraudes digitales.",
  icons: { icon: "/xibalba-logo.jpg", apple: "/xibalba-logo.jpg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "XIBALBÁ",
  },
};

export const viewport: Viewport = {
  themeColor: "#050a0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
