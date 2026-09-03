const OpenAI = require('openai');
const { ImageCaptionProvider } = require('../contracts/image-caption-provider');

class OpenAICompatibleImageCaptionProvider extends ImageCaptionProvider {
  constructor(config = {}) {
    super();
    const endpoint = config.endpoint || {};
    const apiKey = config.apiKey || process.env[config.apiKeyEnv || 'VISION_API_KEY'];
    if (!config.client && !apiKey) throw new Error('未配置视觉模型 API Key');
    this.model = process.env[config.modelEnv || 'VISION_MODEL'] || config.model || 'gpt-5.6-terra';
    this.requestConfig = config.request || {};
    const clientOptions = { apiKey, timeout: this.requestConfig.timeoutMs || 60000 };
    const baseURL = endpoint.baseURL || process.env[endpoint.baseUrlEnv || 'VISION_BASE_URL'] || config.baseURL;
    const endpointType = endpoint.type || (baseURL ? 'compatible' : 'official');
    if (endpointType === 'compatible') {
      if (!baseURL) throw new Error('第三方视觉接口未配置 baseURL');
      clientOptions.baseURL = baseURL;
    }
    this.client = config.client || new OpenAI(clientOptions);
  }

  async caption(asset, context = {}) {
    const mimeType = asset.mimeType || this.mimeTypeFromName(asset.fileName);
    const response = await this.client.chat.completions.create(this.buildRequest(asset, context, mimeType));
    const caption = response.choices?.[0]?.message?.content?.trim();
    if (!caption) throw new Error('视觉模型未返回图片说明');
    return /[。！？.!?]$/.test(caption) ? caption : `${caption}。`;
  }

  buildRequest(asset, context, mimeType) {
    const request = {
      model: this.model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `用一句中文客观描述图片中展示的内容，不要推测图中不存在的信息。文档：${context.title || ''}；位置：${context.location || ''}。`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${asset.data.toString('base64')}`,
              detail: this.requestConfig.imageDetail || 'low'
            }
          }
        ]
      }]
    };
    const tokenParameter = this.requestConfig.tokenParameter || 'max_completion_tokens';
    request[tokenParameter] = this.requestConfig.maxOutputTokens || 120;
    if (this.requestConfig.reasoningEffort !== null && this.requestConfig.reasoningEffort !== false) {
      request.reasoning_effort = this.requestConfig.reasoningEffort || 'none';
    }
    if (this.requestConfig.temperature !== undefined) request.temperature = this.requestConfig.temperature;
    return request;
  }

  mimeTypeFromName(fileName = '') {
    if (/\.jpe?g$/i.test(fileName)) return 'image/jpeg';
    if (/\.gif$/i.test(fileName)) return 'image/gif';
    if (/\.svg$/i.test(fileName)) return 'image/svg+xml';
    return 'image/png';
  }
}

module.exports = { OpenAICompatibleImageCaptionProvider };
