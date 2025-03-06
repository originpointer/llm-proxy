# Docker 部署指南

## 项目 Docker 构建指南

本项目使用 Docker 和 Docker Compose 进行容器化部署。以下是相关操作步骤：

## 环境变量配置

在运行 Docker 容器前，请确保以下环境变量已正确配置：

```
DIFY_API_URL=https://api.dify.ai/v1  # Dify API 地址
DIFY_API_KEY=your_api_key            # Dify API 密钥
```

您可以通过以下方式设置这些环境变量：
1. 在宿主机上设置环境变量
2. 使用 `.env` 文件 (不推荐用于生产环境)
3. 直接在 `docker-compose.yml` 中修改

## 构建和运行

### 使用 Docker Compose (推荐)

```bash
# 构建并启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止容器
docker-compose down
```

### 使用 Docker 命令

```bash
# 构建镜像
docker build -t llm-proxy:latest .

# 运行容器
docker run -d \
  --name llm-proxy \
  -p 3000:3000 \
  -e DIFY_API_URL=https://api.dify.ai/v1 \
  -e DIFY_API_KEY=your_api_key \
  -v $(pwd)/data:/app/data \
  llm-proxy:latest

# 查看日志
docker logs -f llm-proxy

# 停止并移除容器
docker stop llm-proxy
docker rm llm-proxy
```

## 端口说明

默认情况下，应用在容器内使用 3000 端口，并映射到宿主机的 3000 端口。若需修改宿主机端口，请编辑 `docker-compose.yml` 文件中的端口映射配置。

## 数据持久化

应用的数据目录 `/app/data` 已通过卷映射到宿主机的 `./data` 目录，确保数据在容器重启后仍然保留。 