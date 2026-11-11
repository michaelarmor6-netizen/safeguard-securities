import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',

  resolve: {
    alias: {
      'firebase/app': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
      'firebase/auth': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
      'firebase/firestore': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
      'firebase/storage': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
      'firebase/functions': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
      '@firebase/app': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
      '@firebase/auth': path.resolve(__dirname, 'src/config/firebase-stub.ts'),
    },
  },

  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    host: true,
  },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
})