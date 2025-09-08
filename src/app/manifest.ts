import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Video Display System",
    short_name: "VideoDisplay",
    description: "Global video display system",
    theme_color: "#ff0000",
    background_color: "#000000",
    scope: "/display",
    start_url: "/display",
    display: "fullscreen",
    orientation: "landscape",
    icons: [
      {
        src: "/icon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-256x256.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Admin Panel",
        short_name: "Admin",
        description: "Manage videos and schedules",
        url: "/admin",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Display Screen",
        short_name: "Display",
        description: "Full-screen video display",
        url: "/display",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Debug Panel",
        short_name: "Debug",
        description: "System diagnostics",
        url: "/debug",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
    categories: ["business", "productivity", "utilities"],
    related_applications: [],
    prefer_related_applications: false,
  };
}
