/**
 * models.js - 数据模型定义
 * 
 * 相当于Python版本的models.py，使用类和类型定义
 */

const { v4: uuidv4 } = require('uuid');

// 工具函数
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// 用于验证请求数据的工具函数
function validateChatMessage(message) {
  if (!message || typeof message !== 'object') {
    throw new Error('消息必须是一个对象');
  }
  
  if (!['system', 'user', 'assistant'].includes(message.role)) {
    throw new Error('消息角色必须是 system、user 或 assistant');
  }
  
  if (typeof message.content !== 'string') {
    throw new Error('消息内容必须是字符串');
  }
  
  return message;
}

function validateChatCompletionRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('请求必须是一个对象');
  }
  
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new Error('messages必须是非空数组');
  }
  
  request.messages.forEach(validateChatMessage);
  
  // 设置默认值
  request.model = request.model || 'notion-proxy';
  request.stream = request.stream !== undefined ? Boolean(request.stream) : false;
  request.notion_model = request.notion_model || 'anthropic-opus-4';
  
  return request;
}

// Notion相关模型
function createNotionTranscriptConfigValue(model) {
  return {
    type: 'markdown-chat',
    model: model
  };
}

function createNotionTranscriptItem(type, value) {
  if (!['config', 'user', 'markdown-chat'].includes(type)) {
    throw new Error('转录项类型必须是config、user或markdown-chat');
  }
  
  return { type, value };
}

function createNotionDebugOverrides() {
  return {
    cachedInferences: {},
    annotationInferences: {},
    emitInferences: false
  };
}

function createNotionRequestBody(spaceId, transcript) {
  return {
    traceId: uuidv4(),
    spaceId: spaceId,
    transcript: transcript,
    createThread: true,
    debugOverrides: createNotionDebugOverrides(),
    generateTitle: false,
    saveAllThreadOperations: true
  };
}

// OpenAI兼容的输出模型
function createChoiceDelta(content = null) {
  return { content };
}

function createChoice(delta, finishReason = null) {
  return {
    index: 0,
    delta: delta,
    finish_reason: finishReason
  };
}

function createChatCompletionChunk(choices, model = 'notion-proxy') {
  return {
    id: `chatcmpl-${uuidv4()}`,
    object: 'chat.completion.chunk',
    created: getCurrentTimestamp(),
    model: model,
    choices: choices
  };
}

// 模型列表端点的模型
function createModel(id, ownedBy = 'notion') {
  return {
    id: id,
    object: 'model',
    created: getCurrentTimestamp(),
    owned_by: ownedBy
  };
}

function createModelList(models) {
  return {
    object: 'list',
    data: models
  };
}

module.exports = {
  validateChatCompletionRequest,
  validateChatMessage,
  createNotionTranscriptConfigValue,
  createNotionTranscriptItem,
  createNotionRequestBody,
  createChoiceDelta,
  createChoice,
  createChatCompletionChunk,
  createModel,
  createModelList,
  getCurrentTimestamp
}; 