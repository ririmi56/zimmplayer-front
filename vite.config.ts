import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En developpement le proxy reproduit le routage de nginx : /api vers l'API et
// /s3 vers MinIO. Le front travaille donc en meme-origine comme en production,
// ce qui evite d'avoir a gerer du CORS ici et seulement ici.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // ws: true — le front est aussi un snapclient, l'audio arrive par
      // WebSocket sur /api/snapcast/stream.
      '/api': { target: 'http://localhost:8000', ws: true },
      '/s3': {
        target: 'http://localhost:9000',
        rewrite: (path) => path.replace(/^\/s3/, ''),
      },
    },
  },
})
