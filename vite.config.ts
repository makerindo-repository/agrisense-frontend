import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // SECURITY: API keys must NEVER be injected into frontend bundles.
      // Gemini API calls are handled securely via Laravel backend.
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Leaflet is standalone (no React dependency) — safe to split
              if (id.includes('leaflet')) return 'vendor-maps';
              // Recharts is large but depends on React — keep with React
              // to avoid circular chunks
            }
            // Let Rollup handle all other chunking automatically
            return undefined;
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        usePolling: true,
        ignored: [
          '**/backend/**',
          '**/dist/**',
          '**/storage/**',
          '**/.git/**',
          '**/docker-compose.yml',
          '**/nginx.conf',
          '**/*.log',
        ],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.ts',
    },
  };
});
