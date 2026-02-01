const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
   {
      ignores: [
         "dist/**",
         "node_modules/**",
         "data/**",
         "resources/**",
         "logs/**",
         "backup-data/**",
         "dev-only/**",
         ".review/**",
      ],
   },
   {
      files: ["eslint.config.js"],
      languageOptions: {
         globals: {
            __dirname: "readonly",
            module: "readonly",
            require: "readonly",
         },
         sourceType: "script",
      },
   },
   js.configs.recommended,
   {
      files: ["**/*.ts"],
      languageOptions: {
         parser: tsParser,
         parserOptions: {
            project: ["./tsconfig.eslint.json"],
            tsconfigRootDir: __dirname,
            sourceType: "module",
         },
      },
      plugins: {
         "@typescript-eslint": tsPlugin,
      },
      rules: {
         indent: ["error", 3, { SwitchCase: 1 }],
         quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
         semi: "off",
         "comma-dangle": ["error", "only-multiline"],
         "object-curly-spacing": ["error", "always"],
         "no-trailing-spaces": ["error", { skipBlankLines: true }],
         "no-mixed-spaces-and-tabs": "error",
         "prefer-const": "error",
         eqeqeq: ["error", "always"],
         curly: "off",
         "no-undef": "off",
         "no-unused-vars": "off",
         "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
         "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
         "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
         "@typescript-eslint/explicit-function-return-type": ["warn", { allowExpressions: true, allowTypedFunctionExpressions: true }],
      },
   },
];
