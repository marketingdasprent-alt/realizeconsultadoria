/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // Valores de substituição: o cliente Supabase falha ao importar sem URL/chave (CI sem .env).
    env: {
      VITE_SUPABASE_URL: 'https://placeholder-url.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'placeholder-key',
    },
    // .claude/worktrees: cópias do projeto de outras sessões (não são testes deste).
    exclude: ['e2e/**', '**/node_modules/**', '.claude/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/setupTests.ts', 'e2e/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
