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
COPY apps/dashboard/package.json ./apps/dashboard/

RUN --mount=type=cache,id=pnpm-dashboard,target=/pnpm/store pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
WORKDIR /app/apps/dashboard
RUN --mount=type=cache,id=nextjs-dashboard,target=/app/apps/dashboard/.next/cache pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/dashboard/server.js"]
