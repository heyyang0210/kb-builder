const fs = require('fs').promises;
const path = require('path');
const { OpenAICompatibleImageCaptionProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/captioning/openai-compatible-image-caption-provider');

const enabled = process.env.RUN_VISION_INTEGRATION === '1' && Boolean(process.env.VISION_API_KEY);
const integrationTest = enabled ? test : test.skip;

describe('Vision API real integration', () => {
  integrationTest('真实接口返回一句图片说明', async () => {
    const imagePath = path.resolve(__dirname, '../../../refs/pingcode/_test_output/pipeline/files/1.jpg');
    const provider = new OpenAICompatibleImageCaptionProvider({
      endpoint: {
        type: process.env.VISION_BASE_URL ? 'compatible' : 'official',
        baseUrlEnv: 'VISION_BASE_URL'
      },
      apiKeyEnv: 'VISION_API_KEY',
      modelEnv: 'VISION_MODEL',
      model: 'gpt-5.6-terra',
      request: { reasoningEffort: 'none', maxOutputTokens: 120, imageDetail: 'low' }
    });
    const caption = await provider.caption({
      fileName: '1.jpg',
      mimeType: 'image/jpeg',
      data: await fs.readFile(imagePath)
    }, { title: 'PingCode Office 文档图片' });

    expect(caption.length).toBeGreaterThan(5);
    expect(caption.length).toBeLessThan(300);
  }, 120000);
});
