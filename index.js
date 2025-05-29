/**
 * index.js - Notion API代理服务的Node.js实现
 * 使用Express替代FastAPI
 */

// 导入依赖
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const dotenv = require('dotenv');
const chalk = require('chalk');
const { 
  validateChatCompletionRequest, 
  createNotionTranscriptConfigValue,
  createNotionTranscriptItem,
  createNotionRequestBody,
  createChoiceDelta,
  createChoice,
  createChatCompletionChunk,
  createModel,
  createModelList,
  getCurrentTimestamp
} = require('./models');
const { log } = require('console');

// 加载环境变量，从当前目录读取
dotenv.config();

// 配置
const NOTION_API_URL = 'https://www.notion.so/api/v3/runInferenceTranscript';
const NOTION_COOKIE = process.env.NOTION_COOKIE || '';
const NOTION_SPACE_ID = process.env.NOTION_SPACE_ID || '';
const EXPECTED_TOKEN = process.env.PROXY_AUTH_TOKEN || 'default_token';

// 验证环境变量
if (!NOTION_COOKIE) {
  console.error(chalk.red("错误: NOTION_COOKIE 环境变量未设置"));
}

if (!NOTION_SPACE_ID) {
  console.warn(chalk.yellow("警告: NOTION_SPACE_ID 环境变量未设置"));
}

// 创建Express应用
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 日志中间件 - 记录API调用信息
app.use((req, res, next) => {
  const start = Date.now();
  const requestMethod = req.method;
  const requestPath = req.path;
  const requestId = uuidv4().slice(0, 8);
  
  // 只记录开始日志（如果需要）
  // console.log(chalk.cyan(`[${new Date().toISOString()}] 请求开始 ${requestId}: ${requestMethod} ${requestPath}`));
  
  // 如果是聊天完成请求，只记录简单信息
  if (requestPath === '/v1/chat/completions' && req.method === 'POST') {
    try {
      const model = req.body.notion_model || req.body.model || 'unknown';
      const isStream = req.body.stream ? '流式' : '非流式';
      console.log(chalk.blue(`[请求] ${requestMethod} ${requestPath} - 模型:${model} ${isStream}`));
    } catch (e) {
      // 忽略解析错误
    }
  }
  
  // 捕获响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // 根据状态码选择颜色
    let statusColor;
    if (statusCode >= 500) {
      statusColor = chalk.red;
    } else if (statusCode >= 400) {
      statusColor = chalk.yellow;
    } else if (statusCode >= 300) {
      statusColor = chalk.cyan;
    } else {
      statusColor = chalk.green;
    }
    
    // 简化的日志输出
    console.log(
      `[${chalk.bold(requestMethod)}] - ${requestPath} ${statusColor(statusCode)} ${duration}ms` +
      `${duration > 1000 ? chalk.yellow(' [慢]') : ''}`
    );
  });
  
  next();
});

// 身份验证中间件
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        message: "缺少身份验证凭据",
        type: "unauthorized"
      }
    });
  }
  
  const token = authHeader.substring(7);
  // 使用安全的比较方法避免时序攻击
  const isValidToken = crypto.timingSafeEqual(
    Buffer.from(token, 'utf8'),
    Buffer.from(EXPECTED_TOKEN, 'utf8')
  );
  
  if (!isValidToken) {
    return res.status(401).json({
      error: {
        message: "无效的身份验证凭据",
        type: "unauthorized"
      }
    });
  }
  
  next();
}

// 辅助函数
function buildNotionRequest(requestData) {
  // 将OpenAI风格的消息转换为Notion格式
  const transcript = [
    createNotionTranscriptItem(
      'config', 
      createNotionTranscriptConfigValue(requestData.notion_model)
    )
  ];
  
  for (const message of requestData.messages) {
    if (message.role === 'assistant') {
      // Notion使用"markdown-chat"作为助手回复
      transcript.push(createNotionTranscriptItem('markdown-chat', message.content));
    } else {
      // 将用户、系统和其他角色映射到'user'
      transcript.push(createNotionTranscriptItem('user', [[message.content]]));
    }
  }
  
  // 使用全局配置的spaceId，并设置createThread=true
  return createNotionRequestBody(NOTION_SPACE_ID, transcript);
}

async function streamNotionResponse(notionRequestBody, res, isStreamingMode = true) {
  // 设置响应头
  if (isStreamingMode) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  }
  
  const streamId = uuidv4().slice(0, 8);
  
  const headers = {
    'accept': 'application/x-ndjson',
    'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6,ja;q=0.5',
    'content-type': 'application/json',
    'notion-audit-log-platform': 'web',
    'notion-client-version': '23.13.0.3604',
    'origin': 'https://www.notion.so',
    'priority': 'u=1, i',
    'referer': 'https://www.notion.so',
    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'cookie': NOTION_COOKIE,
    'x-notion-space-id': NOTION_SPACE_ID
  };
  
  // 添加active user header（如果存在）
  const notionActiveUser = process.env.NOTION_ACTIVE_USER_HEADER;
  if (notionActiveUser) {
    headers['x-notion-active-user-header'] = notionActiveUser;
  }
  
  const chunkId = `chatcmpl-${uuidv4()}`;
  const createdTime = getCurrentTimestamp();
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(NOTION_API_URL, notionRequestBody, {
      headers,
      responseType: 'stream'
    });
    
    // 只在流式模式下输出连接成功日志
    if (isStreamingMode) {
      console.log(chalk.green(`[流] Notion API连接成功`));
    }
    
    let chunkCount = 0;
    let totalChars = 0;
    let fullResponseContent = ''; // 用于非流式响应模式
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          
          // 检查是否是包含文本块的消息
          if (data.type === 'markdown-chat' && typeof data.value === 'string') {
            const contentChunk = data.value;
            
            if (contentChunk) {
              chunkCount++;
              totalChars += contentChunk.length;
              
              const chunk = createChatCompletionChunk(
                [createChoice(createChoiceDelta(contentChunk))]
              );
              
              if (isStreamingMode) {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              }
              fullResponseContent += contentChunk;
            }
          }
          
          // 如果看到recordMap，则停止流式传输
          if ('recordMap' in data) {
            break;
          }
        } catch (error) {
          // 忽略解析错误
        }
      }
    });
    
    response.data.on('end', () => {
      const duration = Date.now() - startTime;
      
      if (isStreamingMode) {
        // 发送最终块表示停止
        const finalChunk = createChatCompletionChunk(
          [createChoice(createChoiceDelta(), 'stop')]
        );
        
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        
        // 只在流式模式下输出完成日志
        console.log(chalk.green(`[流] 完成: ${totalChars}字符, ${duration}ms`));
        
        res.end();
      } else {
        // 在非流式模式下，通过回调返回收集到的完整内容
        if (res.sendFullContent) {
          res.sendFullContent(fullResponseContent);
        }
      }
    });
    
    response.data.on('error', (error) => {
      console.error(chalk.red(`[${isStreamingMode ? '流' : '非流'}] 错误: ${error.message}`));
      res.status(500).json({
        error: {
          message: `处理Notion API响应时出错: ${error.message}`,
          type: "server_error"
        }
      });
    });
  } catch (error) {
    console.error(chalk.red(`[${isStreamingMode ? '流' : '非流'}] 连接错误: ${error.message}`));
    
    if (error.response) {
      console.error(chalk.red(`[${isStreamingMode ? '流' : '非流'}] Notion API响应码: ${error.response.status}`));
      return res.status(error.response.status).json({
        error: {
          message: `Notion API错误: ${error.message}`,
          type: "api_error"
        }
      });
    }
    
    return res.status(500).json({
      error: {
        message: `连接到Notion API时出错: ${error.message}`,
        type: "connection_error"
      }
    });
  }
}

// API端点
app.get('/v1/models', authenticate, (req, res) => {
  // 端点列出可用的Notion模型，模仿OpenAI的/v1/models
  const availableModels = [
    'openai-gpt-4.1',
    'anthropic-opus-4',
    'anthropic-sonnet-4'
  ];
  
  const modelList = createModelList(
    availableModels.map(modelId => createModel(modelId))
  );
  
  res.json(modelList);
});

app.post('/v1/chat/completions', authenticate, async (req, res) => {
  // 模仿OpenAI的聊天完成功能，代理到Notion
  if (!NOTION_COOKIE) {
    return res.status(500).json({
      error: {
        message: "服务器配置错误: Notion cookie未设置",
        type: "server_error"
      }
    });
  }
  
  try {
    const requestData = validateChatCompletionRequest(req.body);
    const notionRequestBody = buildNotionRequest(requestData);
    
    if (requestData.stream) {
      // 处理流式响应
      return streamNotionResponse(notionRequestBody, res, true);
    } else {
      // 非流式响应 - 使用同一个函数但采用非流式模式
      const startTime = Date.now();
      console.log(chalk.blue(`[请求] 开始非流式处理`));
      
      // 创建带有sendFullContent回调的对象
      const mockRes = {
        setHeader: () => {},
        status: (code) => {
          res.status(code);
          return mockRes;
        },
        json: (data) => {
          res.json(data);
        },
        // 当收集完整内容后的回调函数
        sendFullContent: (fullContent) => {
          // 构建最终的OpenAI兼容非流式响应
          const responseJson = {
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: getCurrentTimestamp(),
            model: requestData.model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: fullContent,
                },
                finish_reason: 'stop',
              }
            ],
            usage: {
              prompt_tokens: null,
              completion_tokens: null,
              total_tokens: null,
            },
          };
          
          const duration = Date.now() - startTime;
          console.log(chalk.green(`[非流] 完成: ${fullContent.length}字符, ${duration}ms`));
          res.json(responseJson);
        }
      };
      
      // 使用同一个函数，但指定非流式模式
      return streamNotionResponse(notionRequestBody, mockRes, false);
    }
  } catch (error) {
    console.error(`处理请求时出错: ${error.message}`);
    return res.status(400).json({
      error: {
        message: `请求处理错误: ${error.message}`,
        type: "invalid_request_error"
      }
    });
  }
});

// 启动服务器
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
  console.log(chalk.green.bold(`Notion API 代理服务已启动`));
  console.log(chalk.yellow(`地址: `) + chalk.green(`http://127.0.0.1:${PORT}`));
  
  // 显示关键配置状态
  const cookieStatus = NOTION_COOKIE !== '' ? chalk.green('✓') : chalk.red('✗');
  const spaceStatus = NOTION_SPACE_ID !== '' ? chalk.green('✓') : chalk.red('✗');
  const tokenStatus = EXPECTED_TOKEN !== 'default_token' ? chalk.green('✓') : chalk.yellow('默认');
  console.log(chalk.yellow(`配置: `) + 
    `Cookie ${cookieStatus} | Space ID ${spaceStatus} | 认证令牌 ${tokenStatus}`);
}); 