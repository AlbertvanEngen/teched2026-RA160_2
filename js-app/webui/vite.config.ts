import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3142',
        changeOrigin: true,
      },
      '/sap': {
        target: 'http://localhost:3142',
        changeOrigin: true,
      },
    },
  },
});
