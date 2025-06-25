import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Server configuration
    server: {
      port: 5173,
      open: true,
      // Removed proxy since we're directly connecting to backend
      // proxy: {
      //   '/api': {
      //     target: 'http://localhost:5003',
      //     changeOrigin: true,
      //     secure: false
      //   }
      // }
    },
    // Environment variables configuration
    define: {
      'process.env': {},
      __APP_ENV__: env.APP_ENV,
    },
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    // Resolve configuration
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});
