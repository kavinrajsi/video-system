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
    display_override: ["window-controls-overlay", "fullscreen"],
    orientation: "landscape",
    id: "video-display-system",
    lang: "en",
    dir: "ltr",
    launch_handler: {
      client_mode: "focus-existing",
    },
    screenshots: [
      {
        src: "screenshot.png",
        sizes: "1080x1920",
        type: "image/png",
      },
    ],
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
    file_handlers: [
      {
        action: "/admin?upload=true",
        accept: {
          "video/mp4": [".mp4"],
          "video/webm": [".webm"],
          "video/quicktime": [".mov"],
          "video/x-msvideo": [".avi"],
          "video/ogg": [".ogv"],
        },
      },
    ],
    share_target: {
      action: "/admin?share=true",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "description",
        url: "url",
        files: [
          {
            name: "video",
            accept: [
              "video/mp4",
              "video/webm",
              "video/quicktime",
              "video/x-msvideo",
              "video/ogg",
            ],
          },
        ],
      },
    },
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

    protocol_handlers: [
      {
        protocol: "web+videodisplay",
        url: "/admin?video=%s",
      },
    ],
    categories: ["business", "productivity", "utilities", "entertainment"],
    related_applications: [],
    prefer_related_applications: false,
  };
}
