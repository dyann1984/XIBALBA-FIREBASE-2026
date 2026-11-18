import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "XIBALBÁ AI · Protección Antifraude",
    short_name: "XIBALBÁ",
    description:
      "Plataforma inteligente de prevención, detección e investigación de fraudes digitales.",
    start_url: "/",
    display: "standalone",
    background_color: "#050a0e",
    theme_color: "#050a0e",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/xibalba-logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
