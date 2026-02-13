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
      setupFiles: ["dev/tests/setup.ts"],
      include: ["dev/tests/**/*.test.ts"],
      typecheck: {
         include: ["dev/tests/**/*.test.ts"]
      },
      coverage: {
         provider: "v8",
         reporter: ["text", "html"],
         exclude: ["dist/**", "resources/**", "tools/**", "dev/tests/**", "**/*.d.ts"]
      }
   }
});
