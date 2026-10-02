import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 'server-only'는 Next 번들러 밖에서 import하면 예외를 던진다 — 테스트에서는 빈 모듈로 대체
      'server-only': path.resolve(__dirname, 'tests/empty.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
})
