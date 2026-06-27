import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Atlas Nomade — deux modes de build :
//  - normal      : npm run build   -> dist/ (assets séparés, à servir via preview)
//  - fichier seul : npm run build:single -> dist-single/index.html (double-cliquable, offline)
const single = process.env.SINGLE === "1";

export default defineConfig({
  base: "./",
  plugins: single ? [viteSingleFile()] : [],
  build: {
    target: "es2022",
    outDir: single ? "dist-single" : "dist",
    // mode normal : garde les gros binaires en fichiers ; mode single : tout en data-URI
    assetsInlineLimit: single ? 100_000_000 : 0,
    chunkSizeWarningLimit: 4000,
  },
});
