import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { configureSharedMapsApi } from './server/sharedMapsApi.js';
import { configureStravaApi } from './server/stravaApi.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      vue(),
      {
        name: 'local-strava-api',
        configureServer(server) {
          configureStravaApi(server, env);
          configureSharedMapsApi(server, env);
        },
      },
    ],
  };
});
