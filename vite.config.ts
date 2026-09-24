import { defineConfig } from 'vite';

// base relativo funciona tanto local (npm run dev/preview)
// quanto publicado em qualquer subpasta do GitHub Pages (ex: usuario.github.io/prospecto/)
export default defineConfig({
  base: './',
});
