# ---- 构建阶段 ----
FROM docker.das-security.cn/node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 构建时注入 API 地址（指向后端服务）
ARG REACT_APP_API_URL=http://localhost:3001/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# ---- 生产阶段（使用轻量级HTTP服务器）----
FROM node:22-alpine AS production

# 安装轻量级HTTP服务器
RUN npm install -g serve

# 复制构建产物
COPY --from=builder /app/build /app/build

WORKDIR /app

EXPOSE 5000

CMD ["serve", "-s", "build", "-l", "5000"]
