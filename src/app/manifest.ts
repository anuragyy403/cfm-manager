import type { MetadataRoute } from "next";
import { APP_NAME, COMPANY_NAME } from "@/components/brand";

/**
 * Web app manifest: lets people install CFM Workplace to their phone's home
 * screen. It opens at "/", which sends signed-out people to sign-in and
 * signed-in people straight to their workspace.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: "CFM Work",
    description: `Team task tracking for ${COMPANY_NAME}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f2e8",
    theme_color: "#0c243e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
