import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server proxies the API to the FastAPI backend, so the browser only
// ever talks to one origin and no CORS setup is needed while developing.
//
// The backend is started from the innovation-g2 folder:  python main.py
// It listens on 127.0.0.1:3000.
export default defineConfig({
  plugins: [react()],
  server: {
    // Bound to every interface so the app can be opened from another device
    // on the same network, for example a phone, to check the mobile layout.
    host: true,
    port: 5173,
    // The dev server answers on whatever host name it is reached by. The
    // container that runs the browser reaches it as host.docker.internal.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
