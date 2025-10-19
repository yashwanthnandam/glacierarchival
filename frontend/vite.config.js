import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    // Optimize build performance for CI/CD environments
    target: 'es2015',
    minify: 'esbuild', // Faster than terser
    sourcemap: false,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Reduce memory usage
    rollupOptions: {
      maxParallelFileOps: 2, // Limit parallel file operations
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
          utils: ['axios', 'jszip'],
        },
      },
      external: (id) => {
        // Handle Node.js modules that shouldn't be bundled
        if (id === 'crypto' || id === 'fs' || id === 'path') {
          return true;
        }
        return false;
      },
    },
    // Define global constants
    define: {
      global: 'globalThis',
    },
    // Reduce memory usage during build
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  optimizeDeps: {
    // Exclude problematic dependencies from pre-bundling
    exclude: ['crypto'],
  },
  resolve: {
    alias: {
      // Provide browser-compatible alternatives
      crypto: 'crypto-browserify',
    },
  },
});