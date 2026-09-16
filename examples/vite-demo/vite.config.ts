import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fun/chat': path.resolve(__dirname, '../../packages/fun-chat/src/index.ts'),
      '@fun/chat/styles.css': path.resolve(__dirname, '../../packages/fun-chat/src/styles/fun-chat.css'),
    },
  },
  server: {
    port: 5173,
  },
});