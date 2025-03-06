# 使用 Node.js 作为基础镜像
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install

# 复制项目文件
COPY . .

# 构建项目
RUN pnpm run build

# 生产环境
FROM node:20-alpine AS production

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 设置环境变量
ENV NODE_ENV=production

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 仅安装生产依赖
RUN pnpm install --prod

# 从构建阶段复制构建结果
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "dist/main"] 