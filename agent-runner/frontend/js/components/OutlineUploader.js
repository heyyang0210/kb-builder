/**
 * OutlineUploader Component
 * Handles uploading and parsinging of knowledge point outline files
 */
class OutlineUploader {
  constructor(options = {}) {
    this.options = {
      accept: '.json,.md,.csv',
      maxSize: 10 * 1024 * 1024,
      onUploadComplete: null,
      ...options
    };
  }
  
  async upload(file) {
    if (!this._validateFile(file)) {
      throw new Error('文件格式不支持或文件过大');
    }
    
    const content = await this._readFile(file);
    const outline = this._parseContent(content, file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('content', JSON.stringify(outline));
    
    const response = await fetch(getBackendBaseUrl() + '/api/outline/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('上传失败: ' + response.statusText);
    }
    
    const result = await response.json();
    result.data.parsedOutline = outline;
    
    if (this.options.onUploadComplete) {
      this.options.onUploadComplete(result);
    }
    
    return result;
  }
  
  _validateFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['json', 'md', 'csv'];
    return validExts.includes(ext) && file.size <= this.options.maxSize;
  }
  
  async _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
  
  _parseContent(content, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'json':
        return this._parseJSON(content);
      case 'md':
        return this._parseMarkdown(content);
      case 'csv':
        return this._parseCSV(content);
      default:
        throw new Error('Unsupported format');
    }
  }
  
  _parseJSON(content) {
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error('JSON 格式错误: ' + e.message);
    }
  }
  
  _parseMarkdown(content) {
    const lines = content.split('\n');
    const outline = { parts: [] };
    let currentPart = null;
    let currentChapter = null;
    
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();
      
      if (!trimmed || trimmed === '---') continue;
      
      // Skip document header sections (文档说明, 大纲定位, etc.)
      if (trimmed.startsWith('# ') && !trimmed.startsWith('# 数据库') && !trimmed.startsWith('# Oracle') && !trimmed.startsWith('# 共享') && !trimmed.startsWith('# 性能') && !trimmed.startsWith('# 高可用')) {
        // Top-level title like "# Oracle OCA 认证知识点大纲"
        outline.title = trimmed.substring(2).trim();
        continue;
      }
      
      // Skip header sub-sections
      if (trimmed.startsWith('## 文档说明') || trimmed.startsWith('### 大纲定位') ||
          trimmed.startsWith('### 目标人群') || trimmed.startsWith('### 前置知识') ||
          trimmed.startsWith('### 难度分级') || trimmed.startsWith('### 学习路径') ||
          trimmed.startsWith('### 章节依赖')) {
        continue;
      }
      
      // Skip table rows, code blocks, and other non-outline content
      if (trimmed.startsWith('|') || trimmed.startsWith('```') || trimmed.startsWith('┌') ||
          trimmed.startsWith('└') || trimmed.startsWith('├') || trimmed.startsWith('│') ||
          trimmed.startsWith('🎯') || trimmed.startsWith('- **必须') || trimmed.startsWith('- **推荐')) {
        continue;
      }
      
      // Part level: "## 一、xxx ⭐" or "## 二、xxx ⭐⭐"
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
      
      // Chapter level: "- **1.1 数据类型映射**" or "- **2.3 网络配置**"
      const chapterMatch = trimmed.match(/^-\s+\*\*(\d+\.\d+)\s+(.+?)\*\*$/);
      if (chapterMatch && currentPart) {
        currentChapter = {
          name: chapterMatch[1] + ' ' + chapterMatch[2],
          kps: []
        };
        currentPart.chapters.push(currentChapter);
        continue;
      }
      
      // Knowledge point level: "  - 1.1.1 ⭐ 字符串类型：..."
      const kpMatch = trimmed.match(/^-\s+(\d+\.\d+\.\d+)\s+([⭐★]*)\s*(.+)$/);
      if (kpMatch && currentChapter) {
        const difficulty = kpMatch[2] || '⭐';
        const desc = kpMatch[3].trim();
        // Extract name (before colon if exists)
        const colonIdx = desc.indexOf('：');
        const name = colonIdx > 0 ? desc.substring(0, colonIdx) : desc;
        const detail = colonIdx > 0 ? desc.substring(colonIdx + 1) : '';
        
        currentChapter.kps.push({
          id: kpMatch[1],
          name: name,
          desc: detail || name,
          difficulty: difficulty
        });
        continue;
      }
    }
    
    // Convert to the standard format expected by initTree
    return {
      title: outline.title || '上传的大纲',
      parts: outline.parts.map(part => ({
        part: part.part,
        level: part.level,
        chapters: part.chapters.map(ch => ({
          name: ch.name,
          kps: ch.kps.map(kp => ({
            id: kp.id,
            name: kp.name,
            desc: kp.desc
          }))
        }))
      }))
    };
  }
  
  _parseCSV(content) {
    const lines = content.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV 文件为空');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const outline = { parts: [{ part: '默认部分', level: '⭐', chapters: [] }] };
    const chapterMap = new Map();
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]);
      
      if (!chapterMap.has(row.chapter)) {
        const chapter = { name: row.chapter, kps: [] };
        outline.parts[0].chapters.push(chapter);
        chapterMap.set(row.chapter, chapter);
      }
      
      const chapter = chapterMap.get(row.chapter);
      chapter.kps.push({
        id: row.kp_id || `kp_${Date.now()}_${Math.random()}`,
        name: row.name || '未命名',
        desc: row.desc || ''
      });
    }
    
    return outline;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OutlineUploader;
}
