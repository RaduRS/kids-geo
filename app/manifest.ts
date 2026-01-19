import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kids Geo",
    short_name: "Kids Geo",
    description:
      "Tablet-first geography game for kids with interactive world map.",
    start_url: "/",
    display: "standalone",
    background_color: "#0ea5e9",
    theme_color: "#0ea5e9",
    icons: [
      {
        src: "/flag.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/flag.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
