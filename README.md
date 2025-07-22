# Notion API 代理服务 (Node.js版本)

这是Python版本[notion2api](https://github.com/gzzhongqi/notion2api)的Node.js重构版本，可以将Notion的AI接口转换为OpenAI兼容的API格式。

## 功能特点

- 将请求转发到Notion的AI接口，同时以OpenAI的API格式返回结果
- 支持流式和非流式响应
- 提供与OpenAI兼容的`/v1/models`和`/v1/chat/completions`端点
- 支持认证和环境变量配置

## 安装

### 本地运行

1. 确保已安装Node.js (推荐v16+)
2. 安装依赖:

```bash
npm install
```

### Docker部署

确保已安装Docker和Docker Compose：
- [Docker安装文档](https://docs.docker.com/get-docker/)
- [Docker Compose安装文档](https://docs.docker.com/compose/install/)

## 配置

创建`.env`文件，设置以下环境变量:

```bash
# 最简单的方法是复制示例文件
cp .env.example .env
# 然后编辑.env文件，填入你的实际值
```

配置文件内容:
```
NOTION_COOKIE=your_notion_cookie_here
NOTION_SPACE_ID=your_notion_space_id_here
PROXY_AUTH_TOKEN=your_auth_token_here
NOTION_ACTIVE_USER_HEADER=optional_active_user_header
```

### 必要的环境变量

- `NOTION_COOKIE`: 从Notion网站获取的cookie值
- `NOTION_SPACE_ID`: 你的Notion工作区ID
- `PROXY_AUTH_TOKEN`: API认证令牌，用于验证客户端请求

## 运行服务

### 方式1：直接运行

```bash
npm start
```

### 方式2：使用部署脚本（推荐）

我们提供了一个便捷的部署脚本来简化Docker部署过程：

```bash
# 启动服务（包含依赖检查、环境配置检查等）
./deploy.sh start

# 查看服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs

# 停止服务
./deploy.sh stop

# 重启服务
./deploy.sh restart

# 清理Docker资源
./deploy.sh clean

# 查看帮助
./deploy.sh help
```

### 方式3：Docker Compose部署

1. 配置环境变量：
```bash
# 复制环境变量模板
cp .env.example .env
# 编辑.env文件，填入你的实际值
```

2. 使用Docker Compose启动：
```bash
# 构建并启动服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f notion-proxy
```

3. 停止服务：
```bash
docker compose down
```

### 方式4：直接使用Docker

```bash
# 构建镜像
docker build -t notion-proxy .

# 运行容器
docker run -d \
  --name notion-api-proxy \
  -p 7860:7860 \
  --env-file .env \
  notion-proxy
```

服务器默认在`http://127.0.0.1:7860`启动

## API使用方法

### 获取可用模型

```bash
curl http://127.0.0.1:7860/v1/models \
  -H "Authorization: Bearer your_auth_token_here"
```

### 发送聊天请求 (非流式)

```bash
curl http://127.0.0.1:7860/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_auth_token_here" \
  -d '{
    "model": "notion-proxy",
    "notion_model": "anthropic-opus-4",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ]
  }'
```

### 发送聊天请求 (流式)

```bash
curl http://127.0.0.1:7860/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_auth_token_here" \
  -d '{
    "model": "notion-proxy",
    "notion_model": "anthropic-opus-4",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ],
    "stream": true
  }'
```

## 可用模型

- `openai-gpt-4.1`
- `anthropic-opus-4`
- `anthropic-sonnet-4`

## 注意事项

- 此应用仅用于学习和研究目的
- 使用前请确保遵守Notion的服务条款
- 不建议在生产环境中使用未经授权的API接口

## Docker部署优势

- 简化部署过程，无需手动安装Node.js环境
- 容器化运行，与宿主系统隔离
- 支持健康检查和自动重启
- 易于管理和扩展
- 支持日志持久化

## 故障排除

### Docker相关问题

1. 如果构建失败，确保Docker有足够的磁盘空间
2. 如果容器无法启动，检查环境变量是否正确设置
3. 如果健康检查失败，确认PROXY_AUTH_TOKEN设置正确
4. 查看容器日志：`docker compose logs notion-proxy` 