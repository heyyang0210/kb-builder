const { OpenAICompatibleImageCaptionProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/captioning/openai-compatible-image-caption-provider');
const { ImageCaptionProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/image-caption-provider');
const http = require('http');

async function withCaptionServer(responder, run) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ path: request.url, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
    const result = responder(requests.length);
    response.writeHead(result.status || 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(result.body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}/v1`, requests);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('OpenAICompatibleImageCaptionProvider', () => {
  test('Provider基类caption调用明确拒绝未实现', async () => {
    await expect(new ImageCaptionProvider().caption({ fileName: 'diagram.png' }))
      .rejects.toThrow('ImageCaptionProvider.caption must be implemented');
  });

  test('默认构造 GPT-5.6 Terra 的图片说明请求', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: '图中展示数据库日志写入流程' } }]
    });
    const provider = new OpenAICompatibleImageCaptionProvider({
      client: { chat: { completions: { create } } },
      request: { imageDetail: 'low' }
    });

    const caption = await provider.caption({
      data: Buffer.from('png'),
      mimeType: 'image/png',
      fileName: 'page.png'
    }, { title: 'Redo', location: '第 1 张幻灯片' });

    expect(caption).toBe('图中展示数据库日志写入流程。');
    const request = create.mock.calls[0][0];
    expect(request.model).toBe('gpt-5.6-terra');
    expect(request.reasoning_effort).toBe('none');
    expect(request.max_completion_tokens).toBe(120);
    expect(request.temperature).toBeUndefined();
    expect(request.messages[0].content[1].image_url.detail).toBe('low');
    expect(request.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
  });

  test('第三方端点支持直接 URL 和兼容 token 参数', () => {
    const provider = new OpenAICompatibleImageCaptionProvider({
      apiKey: 'test-key',
      endpoint: { type: 'compatible', baseURL: 'https://gateway.example.com/v1' },
      request: { tokenParameter: 'max_tokens', reasoningEffort: false }
    });
    const request = provider.buildRequest({ data: Buffer.from('x') }, {}, 'image/png');

    expect(provider.client.baseURL).toBe('https://gateway.example.com/v1');
    expect(request.max_tokens).toBe(120);
    expect(request.max_completion_tokens).toBeUndefined();
    expect(request.reasoning_effort).toBeUndefined();
  });

  test('第三方端点缺少 URL 时拒绝启动', () => {
    expect(() => new OpenAICompatibleImageCaptionProvider({
      apiKey: 'test-key',
      endpoint: { type: 'compatible', baseUrlEnv: 'MISSING_VISION_BASE_URL' }
    })).toThrow('未配置 baseURL');
  });

  test('没有凭据时拒绝启动', () => {
    expect(() => new OpenAICompatibleImageCaptionProvider({
      apiKeyEnv: 'CAPTION_TEST_MISSING_KEY_20261111'
    })).toThrow('未配置视觉模型 API Key');
  });

  test('通过兼容 HTTP 端点发送配置选项并保留已有句末标点', async () => {
    await withCaptionServer(() => ({
      body: { choices: [{ message: { content: '  图中是一张拓扑图！  ' } }] }
    }), async (baseURL, requests) => {
      const provider = new OpenAICompatibleImageCaptionProvider({
        apiKey: 'local-test-key',
        model: 'local-vision',
        endpoint: { type: 'compatible', baseURL },
        request: {
          timeoutMs: 5000,
          imageDetail: 'high',
          tokenParameter: 'max_tokens',
          maxOutputTokens: 42,
          reasoningEffort: null,
          temperature: 0
        }
      });
      expect(await provider.caption({ fileName: 'IMAGE.JPG', data: Buffer.from('jpeg') })).toBe('图中是一张拓扑图！');
      expect(requests).toHaveLength(1);
      expect(requests[0].path).toBe('/v1/chat/completions');
      expect(requests[0].body).toMatchObject({
        model: 'local-vision', max_tokens: 42, temperature: 0,
        messages: [{ content: [
          { type: 'text', text: expect.stringContaining('文档：；位置：。') },
          { type: 'image_url', image_url: { detail: 'high', url: 'data:image/jpeg;base64,anBlZw==' } }
        ] }]
      });
      expect(requests[0].body.reasoning_effort).toBeUndefined();
      expect(requests[0].body.max_completion_tokens).toBeUndefined();
    });
  });

  test('空响应给出明确错误，随后请求仍能成功', async () => {
    await withCaptionServer((count) => ({
      body: count === 1 ? { choices: [] } : { choices: [{ message: { content: '流程图' } }] }
    }), async (baseURL) => {
      const provider = new OpenAICompatibleImageCaptionProvider({ apiKey: 'local-test-key', baseURL });
      await expect(provider.caption({ fileName: 'diagram.gif', data: Buffer.from('gif') }))
        .rejects.toThrow('视觉模型未返回图片说明');
      await expect(provider.caption({ fileName: 'diagram.svg', data: Buffer.from('svg') }))
        .resolves.toBe('流程图。');
    });
  });

  test('兼容端点的 HTTP 错误直接传播', async () => {
    await withCaptionServer(() => ({ status: 400, body: { error: { message: 'invalid image' } } }), async (baseURL) => {
      const provider = new OpenAICompatibleImageCaptionProvider({ apiKey: 'local-test-key', baseURL });
      await expect(provider.caption({ fileName: 'diagram.png', data: Buffer.from('png') }))
        .rejects.toMatchObject({ status: 400, message: expect.stringContaining('invalid image') });
    });
  });

  test('环境变量端点和模型、MIME 推断遵守公开配置', () => {
    const modelEnv = 'CAPTION_TEST_MODEL_20261111';
    const baseUrlEnv = 'CAPTION_TEST_BASE_URL_20261111';
    const apiKeyEnv = 'CAPTION_TEST_KEY_20261111';
    process.env[modelEnv] = 'env-model';
    process.env[baseUrlEnv] = 'http://127.0.0.1:12345/v1';
    process.env[apiKeyEnv] = 'env-test-key';
    try {
      const provider = new OpenAICompatibleImageCaptionProvider({
        apiKeyEnv, model: 'configured-model', modelEnv,
        endpoint: { type: 'compatible', baseUrlEnv }
      });
      expect(provider.model).toBe('env-model');
      expect(provider.client.baseURL).toBe(process.env[baseUrlEnv]);
      expect(provider.mimeTypeFromName('photo.jpeg')).toBe('image/jpeg');
      expect(provider.mimeTypeFromName('animation.GIF')).toBe('image/gif');
      expect(provider.mimeTypeFromName('drawing.svg')).toBe('image/svg+xml');
      expect(provider.mimeTypeFromName()).toBe('image/png');
    } finally {
      delete process.env[modelEnv];
      delete process.env[baseUrlEnv];
      delete process.env[apiKeyEnv];
    }
  });
});
