import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    watch: {
      ignored: ['**/.chrome-*/**', '**/onboarding-check.png', '**/gameplay-check.png'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Some Windows preview processes keep the existing output directory open.
    // Vite still overwrites the active manifest/index while preserving harmless
    // hashed leftovers, so production builds remain deterministic and reliable.
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-runtime';
          if (id.includes('/node_modules/socket.io-client/') || id.includes('/node_modules/engine.io-client/')) return 'online-runtime';
          return undefined;
        },
      },
    },
  },
});
