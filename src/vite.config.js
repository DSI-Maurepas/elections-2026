import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Chargement des variables d'environnement (.env)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Le 'base' doit correspondre au nom de votre dépôt GitHub (ex: /elections-2026/)
    // Si vous utilisez un domaine personnalisé, laissez '/'
    base: mode === 'production' ? '/elections-2026/' : '/',

    plugins: [
      react({
        // Optimisation Fast Refresh pour les Hooks React 18
        fastRefresh: true,
      }),
    ],

    server: {
      port: 3000,
      strictPort: true, // Évite de changer de port si le 3000 est pris (critique pour OAuth)
      host: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production', // Désactivé en prod pour la légèreté
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // Découpage du code pour améliorer le chargement initial
          manualChunks: {
            vendor: ['react', 'react-dom'],
            charts: ['recharts'], // Si vous utilisez recharts pour les stats
            excel: ['xlsx'],      // Si vous utilisez xlsx pour les exports
          },
        },
      },
    },

    // Définition de constantes globales
    define: {
      __APP_VERSION__: JSON.stringify('1.0.0'),
      __SCRUTIN_DATE__: JSON.stringify('2026-03-15'),
    },
  };
});