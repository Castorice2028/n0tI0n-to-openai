# Notion API 代理服务 (Node.js版本)

这是Python版本[notion2api](../)的Node.js重构版本，可以将Notion的AI接口转换为OpenAI兼容的API格式。

## 功能特点

- 将请求转发到Notion的AI接口，同时以OpenAI的API格式返回结果
- 支持流式和非流式响应
- 提供与OpenAI兼容的`/v1/models`和`/v1/chat/completions`端点
- 支持认证和环境变量配置

## 安装

1. 确保已安装Node.js (推荐v16+)
2. 在nodejs目录中安装依赖:

```bash
cd nodejs
npm install
```

## 配置

在nodejs目录中创建`.env`文件，设置以下环境变量:

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

```bash
cd nodejs
npm start
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