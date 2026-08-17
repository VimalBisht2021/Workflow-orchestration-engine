FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/builder/package.json ./packages/builder/
COPY packages/execution-contract/package.json ./packages/execution-contract/
COPY packages/execution-sdk/package.json ./packages/execution-sdk/
COPY packages/shared/package.json ./packages/shared/
COPY services/api/package.json ./services/api/
COPY prisma/schema.prisma ./prisma/

RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store pnpm install --frozen-lockfile

COPY packages ./packages
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY services/api ./services/api
RUN pnpm run -r build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/package.json ./services/api/
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules

WORKDIR /app/services/api
CMD ["node", "dist/main.js"]
