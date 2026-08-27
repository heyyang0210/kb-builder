const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'outlines');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `outline_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.json', '.md', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JSON、Markdown、CSV 格式'));
    }
  }
});

// POST /api/outline/upload - Upload outline file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未选择文件' });
    }

    const file = req.file;
    const name = req.body.name || file.originalname;
    // Parse content: prefer frontend-parsed, fallback to server-side parsing
    let content = null;
    if (req.body.content) {
      try { content = JSON.parse(req.body.content); } catch(e) { content = null; }
    }
    if (!content) {
      try { content = parseMarkdownOutline(file.path); } catch(e) { content = null; }
    }

    // Generate outline ID
    const id = `outline_${Date.now()}`;

    // Create outline metadata
    const outlineData = {
      id,
      name,
      type: req.body.type || 'db',
      file: file.filename,
      content: content,
      kp_count: content ? countKnowledgePoints(content) : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save metadata
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    let metadata = { outlines: [] };
    
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    }
    
    metadata.outlines.push(outlineData);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({
      success: true,
      data: {
        id,
        name,
        kp_count: outlineData.kp_count,
        message: '大纲上传成功'
      }
    });
  } catch (err) {
    console.error('Outline upload error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// GET /api/outline/list - List all outlines
router.get('/list', (req, res) => {
  try {
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.json({ success: true, data: [] });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    // Enrich outlines with parsed content if missing
    metadata.outlines.forEach(outline => {
      if (!outline.content && outline.file) {
        const filePath = path.join(__dirname, '..', 'outlines', outline.file);
        if (fs.existsSync(filePath)) {
          try {
            outline.content = parseMarkdownOutline(filePath);
            outline.kp_count = countKnowledgePoints(outline.content);
          } catch(e) { /* skip unparseable files */ }
        }
      }
    });
    res.json({ success: true, data: metadata.outlines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/outline/:id - Get outline by ID
router.get('/:id', (req, res) => {
  try {
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const outline = metadata.outlines.find(o => o.id === req.params.id);
    
    if (!outline) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    res.json({ success: true, data: outline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/outline/:id - Delete outline
router.delete('/:id', (req, res) => {
  try {
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const outlineIndex = metadata.outlines.findIndex(o => o.id === req.params.id);
    
    if (outlineIndex === -1) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }
    
    const outline = metadata.outlines[outlineIndex];
    
    // Delete file
    const filePath = path.join(__dirname, '..', 'outlines', outline.file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove from metadata
    metadata.outlines.splice(outlineIndex, 1);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    res.json({ success: true, message: '大纲已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Parse markdown outline file into structured data
function parseMarkdownOutline(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const outline = { parts: [] };
  let currentPart = null;
  let currentChapter = null;
  let title = '';

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---') continue;

    // Top-level title
    if (trimmed.startsWith('# ')) {
      title = trimmed.substring(2).trim();
      continue;
    }

    // Skip document header sections
    if (trimmed.startsWith('## 文档说明') || trimmed.startsWith('### 大纲定位') ||
        trimmed.startsWith('### 目标人群') || trimmed.startsWith('### 前置知识') ||
        trimmed.startsWith('### 难度分级') || trimmed.startsWith('### 学习路径') ||
        trimmed.startsWith('### 章节依赖')) {
      continue;
    }

    // Skip tables, code blocks, diagrams
    if (trimmed.startsWith('|') || trimmed.startsWith('\`\`\`') ||
        trimmed.startsWith('┌') || trimmed.startsWith('└') ||
        trimmed.startsWith('├') || trimmed.startsWith('│') ||
        trimmed.startsWith('🎯') || trimmed.startsWith('- **必须') ||
        trimmed.startsWith('- **推荐')) {
      continue;
    }

    // Part level: "## 一、xxx"
    const partMatch = trimmed.match(/^##\s+([一二三四五六七八九十]+)、(.+?)(?:\s*[⭐★]+)?$/);
    if (partMatch) {
      currentPart = {
        part: partMatch[1] + '、' + partMatch[2].replace(/\s*[⭐★]+\s*$/, '').trim(),
        level: (trimmed.match(/[⭐★]+/) || ['⭐'])[0],
        chapters: []
      };
      outline.parts.push(currentPart);
      currentChapter = null;
      continue;
    }

    // Chapter level: "- **1.1 xxx**"
    const chapterMatch = trimmed.match(/^-\s+\*\*(\d+\.\d+)\s+(.+?)\*\*$/);
    if (chapterMatch && currentPart) {
      currentChapter = {
        name: chapterMatch[1] + ' ' + chapterMatch[2],
        kps: []
      };
      currentPart.chapters.push(currentChapter);
      continue;
    }

    // Knowledge point: "- 1.1.1 ⭐ xxx"
    const kpMatch = trimmed.match(/^-\s+(\d+\.\d+\.\d+)\s+([⭐★]*)\s*(.+)$/);
    if (kpMatch && currentChapter) {
      const desc = kpMatch[3].trim();
      const colonIdx = desc.indexOf('：');
      const name = colonIdx > 0 ? desc.substring(0, colonIdx) : desc;
      const detail = colonIdx > 0 ? desc.substring(colonIdx + 1) : '';
      currentChapter.kps.push({
        id: kpMatch[1],
        name: name,
        desc: detail || name
      });
    }
  }

  return { title: title || '上传的大纲', parts: outline.parts };
}

// Helper function to count knowledge points
function countKnowledgePoints(outline) {
  let count = 0;
  // New format: parts -> chapters -> kps
  if (outline.parts) {
    outline.parts.forEach(part => {
      if (part.chapters) {
        part.chapters.forEach(chapter => {
          if (chapter.kps) {
            count += chapter.kps.length;
          }
        });
      }
    });
  }
  // Old format: chapters -> kps
  if (outline.chapters) {
    outline.chapters.forEach(chapter => {
      if (chapter.kps) {
        count += chapter.kps.length;
      }
    });
  }
  return count;
}


const promptGenerator = require('../lib/prompt-generator');

// POST /api/outline/generate-prompts - Generate prompts from outline knowledge points
router.post('/generate-prompts', (req, res) => {
  try {
    const { outline_id, knowledge_points, options = {} } = req.body;

    if (!outline_id || !knowledge_points || knowledge_points.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: outline_id, knowledge_points'
      });
    }

    // Load outline
    const metadataPath = path.join(__dirname, '..', 'outlines', 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const outline = metadata.outlines.find(o => o.id === outline_id);

    if (!outline) {
      return res.status(404).json({ success: false, message: '大纲不存在' });
    }

    // Parse content if missing
    if (!outline.content) {
      const filePath = path.join(__dirname, '..', 'outlines', outline.file);
      if (fs.existsSync(filePath)) {
        try {
          outline.content = parseMarkdownOutline(filePath);
        } catch (e) {
          return res.status(400).json({ success: false, message: '大纲内容无法解析' });
        }
      } else {
        return res.status(400).json({ success: false, message: '大纲文件不存在' });
      }
    }

    // Extract knowledge point details
    const kpDetails = extractKnowledgePoints(outline.content, knowledge_points);

    if (kpDetails.length === 0) {
      return res.status(400).json({ success: false, message: '未找到匹配的知识点' });
    }

    // Generate prompts
    const prompts = [];
    for (const kp of kpDetails) {
      const promptData = {
        name: kp.name,
        part: kp.part,
        chapter: kp.chapter,
        desc: kp.desc,
        type: promptGenerator.detectType(kp.name, kp.desc),
        targetDb: options.target_db || global.__KNOWLEDGE_PLATFORM_CONTEXT__?.brand?.enterpriseName || 'YashanDB',
        refMcp: '',
        refDesign: '',
        refOracle: '',
        refTest: ''
      };

      const result = promptGenerator.assemblePrompt(promptData);
      prompts.push({
        kp_id: kp.id,
        kp_name: kp.name,
        prompt: result.prompt,
        skill_file: result.skillFile,
        template_file: result.templateFile,
        json: result.json
      });
    }

    // Merge output if requested
    let mergedPrompt = null;
    if (options.merge_output) {
      mergedPrompt = prompts.map(p =>
        `---\n\n# ${p.kp_id} ${p.kp_name}\n\n${p.prompt}\n`
      ).join('\n');
    }

    // Save prompts to files if requested
    let saved_files = [];
    if (options.save_to_file) {
      const outputDir = path.join(__dirname, '..', 'prompts', 'from-outline', outline_id);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      prompts.forEach(p => {
        const filename = `${p.kp_id.replace(/\./g, '-')}-${p.kp_name.replace(/[/\\:*?"<>|]/g, '_')}.md`;
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, p.prompt, 'utf-8');
        saved_files.push({ kp_id: p.kp_id, file: filename });
      });
    }

    res.json({
      success: true,
      data: {
        outline_id,
        outline_name: outline.name,
        prompts,
        merged_prompt: mergedPrompt,
        saved_files,
        total: prompts.length
      }
    });

  } catch (err) {
    console.error('Generate prompts error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Extract knowledge point details from outline content
function extractKnowledgePoints(outlineContent, selectedKps) {
  const result = [];
  const parts = outlineContent.parts || [];

  for (const selected of selectedKps) {
    const part = parts.find(p => p.part === selected.part);
    if (!part) continue;

    const chapter = part.chapters.find(c => c.name === selected.chapter);
    if (!chapter) continue;

    const kp = chapter.kps.find(k => k.id === selected.kp_id);
    if (!kp) continue;

    result.push({
      id: kp.id,
      name: kp.name,
      desc: kp.desc,
      part: part.part,
      chapter: chapter.name
    });
  }

  return result;
}

module.exports = router;
