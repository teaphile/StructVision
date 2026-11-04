import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Using './' relative base so the built static bundle works seamlessly on BOTH:
// 1. Root domains (Vercel, Netlify, Cloudflare Pages)
// 2. Subpath hosting (GitHub Pages: https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    // The ILD preset sweep solves dozens of moving-load cases; on slower
    // classroom laptops it can exceed Vitest's default 5 s budget.
    testTimeout: 30000,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        // Keep the framework and icon set in their own long-lived chunks so the
        // lecture app's own code can be re-downloaded without busting them.
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    watch: { ignored: ['**/.npm/**', '**/.cache/**', '**/dist/**', '**/.git/**'] },
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
