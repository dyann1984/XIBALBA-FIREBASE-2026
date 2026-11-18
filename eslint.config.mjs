import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", ".next-phase2/**", "node_modules/**", "artifacts/**", "playwright-report/**", "test-results/**", "public/**"],
  },
];

export default config;
