import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // also bind to the LAN IP so `npm run dev` prints a Network URL
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost/cryptotrack/backend',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost/cryptotrack/backend',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
