import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
  "name": "Video Display System",
  "short_name": "VideoDisplay",
  "description": "Global video display system",
  "icons": [
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#000000",
  "background_color": "#000000",
  "start_url": "/display",
  "display": "fullscreen",
  "orientation": "landscape"
  }
}