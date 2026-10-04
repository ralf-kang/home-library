import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dockerfile/deploy 빌드가 만드는 seed 컴파일 결과물(.gitignore 대상)
    "prisma/dist/**",
    "prisma/dist-demo/**",
    // 웹 퍼블리싱 에셋 제작·검증 스크립트(앱 코드 아님)
    "docs/**",
  ]),
]);

export default eslintConfig;
