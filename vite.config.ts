import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    // Just to stop the scary warning spam
    chunkSizeWarningLimit: 2000, // 2 MB

    rollupOptions: {
      output: {
        // ✅ Smarter auto-chunking
        manualChunks(id) {
          // node_modules always go to vendor-like chunks
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("scheduler")) {
              return "vendor-react";
            }
            if (id.includes("react-router")) {
              return "vendor-router";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("axios")) {
              return "vendor-axios";
            }
            if (id.includes("pdfjs-dist")) {
              return "vendor-pdf";
            }
            return "vendor";
          }

          // You can group big feature folders too, e.g. src/pages/results/*
          if (id.includes("/src/pages/Results")) return "page-results";
          if (id.includes("/src/pages/StudentQuiz")) return "page-student-quiz";

          return undefined; // let Vite handle the rest
        },
      },
    },
  },
}));
