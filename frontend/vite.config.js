import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          state: ['react-redux', '@reduxjs/toolkit'],
          utils: ['axios', 'socket.io-client'],
        },
      },
    },
    sourcemap: true,
    minify: 'terser',
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://wplanner-j7a7.onrender.com',
        changeOrigin: true,
        secure: true
      },
      '/socket.io': {
        target: 'https://wplanner-j7a7.onrender.com',
        ws: true,
        changeOrigin: true,
        secure: true
      },
      '/uploads': {
        target: 'https://wplanner-j7a7.onrender.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
});