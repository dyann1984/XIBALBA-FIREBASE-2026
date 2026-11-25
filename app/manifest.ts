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
    share_target: {
      action: "/",
      method: "GET",
      params: {
        title: "share_title",
        text: "share_text",
        url: "share_url",
      },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
