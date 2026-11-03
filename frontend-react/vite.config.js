import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server proxies /api to the backend (python main.py in innovation-g2, 127.0.0.1:3000).
export default defineConfig({
  plugins: [react()],
  server: {
    // Bound to every interface so another device on the same network (a phone,
    // say) can open the app to check the mobile layout.
    host: true,
    port: 5173,
    // The dev server answers on whatever host name it's reached by. The
    // container running the browser reaches it as host.docker.internal.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
