/**
 * DocumentViewer Component
 * Handles viewing and managing generated documents
 */
class DocumentViewer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    this.documents = [];
    this.currentDoc = null;
    this.options = {
      onView: null,
      ...options
    };
  }
  
  async loadDocuments() {
    try {
      const response = await fetch('/api/document/list');
      const result = await response.json();
      
      if (result.success) {
        this.documents = result.data;
        this.renderList();
      } else {
        throw new Error(result.message || '加载文档列表失败');
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      this.documents = [];
      this.renderList();
    }
  }
  
  renderList() {
    if (this.documents.length === 0) {
      this.container.innerHTML = '<div class="empty-documents">暂无生成的文档</div>';
      return;
    }
    
    const html = `
      <div class="document-list">
        <div class="doc-header">
          <h3>生成的文档</h3>
          <input type="text" id="docSearch" placeholder="搜索文档..." class="doc-search">
        </div>
        <div class="doc-items">
          ${this.documents.map(doc => `
            <div class="doc-item" data-id="${doc.id}">
              <div class="doc-title">${doc.title}</div>
              <div class="doc-meta">
                <span class="doc-kp">${doc.knowledge_point || 'N/A'}</span>
                <span class="doc-date">${this._formatDate(doc.created_at)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // Bind events
    document.querySelectorAll('.doc-item').forEach(item => {
      item.addEventListener('click', () => {
        this._onSelectDoc(item.dataset.id);
      });
    });
    
    // Search functionality
    const searchInput = document.getElementById('docSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._filterDocuments(e.target.value);
      });
    }
  }
  
  _formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  
  _filterDocuments(keyword) {
    const items = document.querySelectorAll('.doc-item');
    items.forEach(item => {
      const title = item.querySelector('.doc-title').textContent.toLowerCase();
      const kp = item.querySelector('.doc-kp').textContent.toLowerCase();
      if (title.includes(keyword.toLowerCase()) || kp.includes(keyword.toLowerCase())) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  async _onSelectDoc(docId) {
    try {
      const response = await fetch(`/api/document/${docId}/content`);
      const result = await response.json();
      
      if (result.success) {
        this.currentDoc = result.data;
        this.renderContent();
        
        if (this.options.onView) {
          this.options.onView(result.data);
        }
      } else {
        throw new Error(result.message || '加载文档失败');
      }
    } catch (err) {
      console.error('Failed to load document:', err);
      showToast('加载文档失败: ' + err.message, 'error');
    }
  }
  
  renderContent() {
    if (!this.currentDoc) return;
    
    const html = `
      <div class="document-viewer">
        <div class="doc-viewer-header">
          <h2>${this.currentDoc.title}</h2>
          <div class="doc-actions">
            <button onclick="downloadDocument('${this.currentDoc.id}')" class="btn-action">📥 下载</button>
            <button onclick="closeDocumentViewer()" class="btn-action">✕ 关闭</button>
          </div>
        </div>
        <div id="docPreview" class="markdown-body"></div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // Render markdown
    const previewContainer = document.getElementById('docPreview');
    if (previewContainer && typeof MarkdownPreview !== 'undefined') {
      const preview = new MarkdownPreview(previewContainer, {
        highlight: true,
        breaks: true
      });
      preview.render(this.currentDoc.content);
    }
  }
  
  getCurrentDocument() {
    return this.currentDoc;
  }
}

// Global functions for document actions
function downloadDocument(docId) {
  window.open(`/api/document/${docId}/download`, '_blank');
}

function closeDocumentViewer() {
  const viewer = document.getElementById('documentViewerModal');
  if (viewer) {
    viewer.style.display = 'none';
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DocumentViewer;
}
