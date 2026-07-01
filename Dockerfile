FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN DATABASE_URL=postgresql://build:build@localhost:5432/blueprintai MEDIA_S3_BUCKET=build-only-private-media npm run prisma:prepare:production && DATABASE_URL=postgresql://build:build@localhost:5432/blueprintai npm exec prisma generate -- --schema prisma/production/schema.prisma && npm run build

CMD ["npm", "run", "docker-start"]
