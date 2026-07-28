import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // O projeto usa `any` deliberadamente em todo o código (schema do
      // Supabase é fracamente tipado no client) — como regra de erro isso
      // gerava ~93% de todo o ruído do lint (1822 de 1964 erros) e escondia
      // problemas reais (vars não usadas, deps de hook faltando etc.).
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
];

export default eslintConfig;
