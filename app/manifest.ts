import type { MetadataRoute } from "next";

// Bump ICON_VERSION whenever the launcher icons change. The query string forces
// Android/Chrome to treat the icons as new URLs and refetch them instead of
// serving the previously installed icon from cache.
const ICON_VERSION = "2";

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
        src: `/icons/icon-192.png?v=${ICON_VERSION}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-512.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/maskable-512.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
