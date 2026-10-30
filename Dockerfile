FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/lib/schema-upgrade.ts ./lib/schema-upgrade.ts
COPY --from=build /app/scripts/migrate-board.mjs ./scripts/migrate-board.mjs
COPY --from=build /app/scripts/start-board.mjs ./scripts/start-board.mjs
COPY --from=build /app/scripts/write-runtime-env.mjs ./scripts/write-runtime-env.mjs
COPY --from=build /app/scripts/dotenv-value.mjs ./scripts/dotenv-value.mjs
COPY --from=build /app/wrangler.local.jsonc ./wrangler.local.jsonc
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/state').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
