const { OpenAICompatibleImageCaptionProvider } = require('../../lib/preprocessing/captioning/openai-compatible-image-caption-provider');

describe('OpenAICompatibleImageCaptionProvider', () => {
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
});
