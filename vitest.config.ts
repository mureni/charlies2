import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      alias: {
         "@": resolve(__dirname, "src")
      }
   },
   test: {
      environment: "node",
      setupFiles: ["tests/setup.ts"],
      include: ["tests/**/*.test.ts"],
      typecheck: {
         include: ["tests/**/*.test.ts"]
      },
      coverage: {
         provider: "v8",
         reporter: ["text", "html"],
         exclude: ["dist/**", "resources/**", "tools/**", "tests/**", "**/*.d.ts"]
      }
   }
});
