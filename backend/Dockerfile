# ---- 构建阶段 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件和 Prisma schema（generate 需要 schema）
COPY package*.json ./
COPY prisma ./prisma

# 安装全部依赖（包括 devDependencies 用于编译）
RUN npm ci

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码并编译
COPY . .
RUN npm run build

# ---- 生产阶段 ----
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --only=production && npx prisma generate

# 从构建阶段复制编译产物
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]
