import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx,tsx}"],
    exclude: ["**/node_modules/**", "src/lib/typing-test/**", "src/lib/api.normalize.test.js"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
