/**
 * MarkdownPreview Component
 * Renders Markdown content as HTML with syntax highlighting
 */
class MarkdownPreview {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    this.options = {
      highlight: true,        // Enable code highlighting
      lineNumbers: false,     // Show line numbers
      sanitize: false,        // Sanitize HTML
      breaks: true,           // Support line breaks
      ...options
    };
    
    this._initMarked();
  }
  
  _initMarked() {
    // Configure marked.js
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: this.options.breaks,
        gfm: true,              // GitHub Flavored Markdown
        headerIds: true,
        mangle: false,
        highlight: (code, lang) => {
          if (this.options.highlight && typeof hljs !== 'undefined') {
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
          }
          return code;
        }
      });
    }
  }
  
  render(markdown) {
    if (!markdown) {
      this.container.innerHTML = '<p class="empty">暂无内容</p>';
      return;
    }
    
    if (typeof marked !== 'undefined') {
      const html = marked.parse(markdown);
      this.container.innerHTML = html;
    } else {
      // Fallback: simple markdown rendering
      this.container.innerHTML = this._simpleRender(markdown);
    }
    
    // Add styling class
    this.container.classList.add('markdown-body');
    
    // Apply line numbers if enabled
    if (this.options.lineNumbers) {
      this._addLineNumbers();
    }
  }
  
  _simpleRender(markdown) {
    // Basic markdown rendering fallback
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br>');
    
    return html;
  }
  
  _addLineNumbers() {
    const codeBlocks = this.container.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      const lines = block.innerHTML.split('\n');
      const numberedLines = lines.map((line, i) => 
        `<span class="line-number">${i + 1}</span>${line}`
      ).join('\n');
      block.innerHTML = numberedLines;
    });
  }
  
  clear() {
    this.container.innerHTML = '';
    this.container.classList.remove('markdown-body');
  }
  
  export(format = 'html') {
    if (format === 'html') {
      return this.container.innerHTML;
    }
    if (format === 'markdown') {
      return this.container.textContent;
    }
    return null;
  }
  
  scrollToTop() {
    this.container.scrollTop = 0;
  }
  
  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownPreview;
}
