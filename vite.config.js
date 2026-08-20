import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { configureStravaApi } from './server/stravaApi.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "@/assets/styles/variables" as *;\n',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            maplibre: ['maplibre-gl'],
            gsap: ['gsap'],
          },
        },
      },
    },
    plugins: [
      vue(),
      {
        name: 'local-strava-api',
        configureServer(server) {
          configureStravaApi(server, env);
        },
      },
    ],
  };
});
