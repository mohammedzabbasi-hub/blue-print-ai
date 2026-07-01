FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --include=dev && npm cache clean --force

COPY . .

# Schema derivation is a build step; runtime validation happens in docker-start
# with the real production environment before migrations are deployed.
RUN NODE_ENV=development npm run prisma:prepare:production && DATABASE_URL=postgresql://build:build@localhost:5432/blueprintai npm exec prisma generate -- --schema prisma/production/schema.prisma && npm run build

CMD ["npm", "run", "docker-start"]
