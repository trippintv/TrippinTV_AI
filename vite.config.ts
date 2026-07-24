import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Strip `crossorigin` from <script> and <link> tags — it causes CORS errors
// inside the Capacitor WebView (custom https://localhost scheme).
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    enforce: 'post',
    transformIndexHtml(html: string) {
      return html
        .replace(/ crossorigin/g, '')
        .replace(/crossorigin="[^"]*"/g, '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), stripCrossorigin()],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
