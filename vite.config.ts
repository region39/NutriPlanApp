import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Разрешаем наш домен
      allowedHosts: true,
      // Явно указываем порт, чтобы Vite не конфликтовал с NPM
      port: 3050,
      host: true, 
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});