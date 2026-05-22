# ---- 构建阶段 ----
FROM docker.das-security.cn/node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 构建时注入 API 地址（通过 Nginx 反向代理，使用 /api 相对路径）
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# ---- 生产阶段（Nginx 代理）----
FROM nginx:1.25-alpine AS production

# 复制构建产物
COPY --from=builder /app/build /usr/share/nginx/html

# 复制 Nginx 配置（包含API代理）
COPY simple-proxy.conf /etc/nginx/conf.d/default.conf

EXPOSE 5000

CMD ["nginx", "-g", "daemon off;"]
