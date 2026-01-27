import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/elections-2026/', //elections-2026
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'google-api': ['./src/services/googleSheetsService.js'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
