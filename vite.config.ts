import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    host: host || '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 3001,
        }
      : undefined,
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        secure: false,
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        secure: false,
      },
      '/api/google': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google/, ''),
        secure: false,
      },
      '/api/alibaba': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/alibaba/, ''),
        secure: false,
      },
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        secure: false,
      },
      '/api/minimax': {
        target: 'https://api.minimax.chat',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/minimax/, ''),
        secure: false,
      },
      '/api/moonshot': {
        target: 'https://api.moonshot.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/moonshot/, ''),
        secure: false,
      },
      '/api/xai': {
        target: 'https://api.x.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xai/, ''),
        secure: false,
      },
      '/api/zai': {
        target: 'https://open.bigmodel.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zai/, ''),
        secure: false,
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
