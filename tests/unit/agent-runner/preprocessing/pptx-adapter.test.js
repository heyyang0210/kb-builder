const fs = require('fs').promises;
const path = require('path');
const { PptxAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/pptx-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-pptx-adapter-' + Date.now());

describe('PptxAdapter', () => {
  let adapter;

  beforeAll(async () => {
    adapter = new PptxAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic properties', () => {
    test('name 应为 pptx', () => {
      expect(adapter.name).toBe('pptx');
    });

    test('supportedExtensions 应包含 .pptx', () => {
      expect(adapter.supportedExtensions).toContain('.pptx');
      expect(adapter.supportedExtensions).not.toContain('.ppt');
    });

    test('canHandle 应正确识别 PPTX 文件', () => {
      expect(adapter.canHandle('test.pptx')).toBe(true);
      expect(adapter.canHandle('test.PPTX')).toBe(true);
      expect(adapter.canHandle('test.pdf')).toBe(false);
    });
  });

  describe('scan', () => {
    test('应递归扫描目录中的 .pptx 文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.pptx'), 'fake');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'b.pptx'), 'fake');
      await fs.writeFile(path.join(TEST_DIR, 'c.txt'), 'not pptx');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(2);
      expect(files.every(f => f.endsWith('.pptx'))).toBe(true);
    });
  });

  describe('parseSlideXml', () => {
    test('应提取幻灯片文本', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>标题文本</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="架构图" descr="Redo持久化架构图"/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdImage1"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="10" y="20"/></a:xfrm></p:spPr>
      </p:pic>
      <p:sp>
        <p:nvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>内容文本</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

      const result = adapter.parseSlideXml(xml, 1);
      expect(result.number).toBe(1);
      expect(result.title).toBe('标题文本');
      expect(result.texts).toContain('标题文本');
      expect(result.texts).toContain('内容文本');
    });

    test('无标题占位符时应使用第一段文本', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>第一段文本</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

      const result = adapter.parseSlideXml(xml, 2);
      expect(result.title).toBe('第一段文本');
    });

    test('空幻灯片应使用默认标题', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree></p:spTree></p:cSld>
</p:sld>`;

      const result = adapter.parseSlideXml(xml, 3);
      expect(result.title).toBe('幻灯片 3');
      expect(result.texts).toEqual([]);
    });
  });

  describe('extractNotesText', () => {
    test('应提取备注文本', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
         xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>备注内容</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;

      const result = adapter.extractNotesText(xml);
      expect(result).toContain('备注内容');
    });
  });

  describe('buildMarkdown', () => {
    test('应构建 Markdown 内容', () => {
      const slides = [
        { number: 1, title: '标题1', texts: ['标题1', '内容1'], notes: '备注1' },
        { number: 2, title: '标题2', texts: ['标题2', '内容2'], notes: '' }
      ];
      const md = adapter.buildMarkdown(slides);
      expect(md).toContain('## 标题1');
      expect(md).toContain('内容1');
      expect(md).toContain('**备注：**');
      expect(md).toContain('备注1');
      expect(md).toContain('## 标题2');
      expect(md).toContain('---');
    });
  });

  describe('parse with real PPTX', () => {
    test('应能解析由 adm-zip 创建的简单 PPTX', async () => {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();

      // 添加最小 PPTX 结构
      zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`));

      zip.addFile('ppt/presentation.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
</p:presentation>`));

      zip.addFile('ppt/slides/slide1.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>测试标题</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>测试内容</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="架构图" descr="Redo持久化架构图"/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rIdImage1"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="10" y="20"/></a:xfrm></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`));
      zip.addFile('ppt/slides/_rels/slide1.xml.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`));
      zip.addFile('ppt/media/image1.png', Buffer.from('original-pptx-image'));

      const filePath = path.join(TEST_DIR, 'test.pptx');
      zip.writeZip(filePath);

      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('测试标题');
      expect(doc.metadata.sourceFormat).toBe('pptx');
      expect(doc.metadata.extra.slideCount).toBe(1);
      expect(doc.content).toContain('## 测试标题');
      expect(doc.content).toContain('测试内容');
      expect(doc.metadata.assets).toHaveLength(1);
      expect(doc.metadata.assets[0].data.equals(Buffer.from('original-pptx-image'))).toBe(true);
      expect(doc.content).toContain(`](${doc.metadata.assets[0].relativePath})`);
      expect(doc.content).toContain('图片说明：Redo持久化架构图。');
      expect(doc.hash).toBeTruthy();
    });
  });
});
