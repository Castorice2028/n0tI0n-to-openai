# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装应用依赖
RUN npm ci --only=production

# 复制应用源码
COPY . .

# 创建非root用户来运行应用
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 更改文件所有者
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露端口（默认7860，可通过环境变量配置）
EXPOSE 7860

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:7860/v1/models', {headers: {'Authorization': 'Bearer ' + process.env.PROXY_AUTH_TOKEN}}, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# 启动应用
CMD ["npm", "start"]