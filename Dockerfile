FROM node:20-slim AS base
# Debian slim: Prisma가 OpenSSL을 탐지할 수 있도록 설치
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 의존성 설치 단계
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# schema.prisma를 deps 단계에서도 제공해 npm install 시 엔진 다운로드가 반영되도록 함
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# standalone 모드 빌드 (next.config.ts에 output: 'standalone' 설정됨)
RUN npx prisma generate
RUN npm run build

# prisma/seed.ts를 런타임에 ts-node 없이 실행할 수 있도록 CommonJS로 미리 컴파일.
# tsconfig.seed.build.json은 prisma/seed.ts 한 파일만 대상으로 하므로 src/ 전체를
# 컴파일하지 않는다(불필요 + next SWC와 다른 경로 별칭/JSX 처리로 실패 위험).
# 결과물: prisma/dist/seed.js (runner 단계에서 prisma/ 디렉터리 통째로 복사될 때 함께 포함됨)
RUN npx tsc --project tsconfig.seed.build.json

# 실행 단계
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Debian slim: OpenSSL 설치 (Prisma 엔진 런타임 의존성)
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma 스키마 + 컴파일된 시드(prisma/dist/seed.js) 복사 (런타임 db push/seed용)
COPY --from=builder /app/prisma ./prisma

# prisma db push 실행에 필요한 CLI + 엔진 패키지.
# npm은 node_modules가 평면 구조라 pnpm(.pnpm 스토어)처럼 개별 경로를 나열할 필요 없음.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# 엔트리포인트 스크립트 복사 및 실행 권한 부여
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && \
    sed -i 's/\r$//' /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
