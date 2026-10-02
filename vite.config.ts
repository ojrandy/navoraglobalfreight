import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The assets folder in this repo is capitalized (Public/), not Vite's default lowercase
  // "public" — Windows' case-insensitive filesystem silently papered over the mismatch in
  // every local dev/build run, but Hostinger's Linux build server is case-sensitive and
  // couldn't find it at all, so none of these assets (including the logo) ever made it into
  // the production build.
  publicDir: 'Public',
  server: {
    host: true,
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
