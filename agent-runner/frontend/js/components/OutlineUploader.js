/**
 * OutlineUploader Component
 * Uploads outline files and consumes the server-owned parse result.
 */
class OutlineUploader {
  constructor(options = {}) {
    this.options = {
      accept: '.json,.md,.csv',
      maxSize: 10 * 1024 * 1024,
      productId: null,
      businessVersionTags: [],
      onUploadComplete: null,
      ...options
    };
  }
  
  async upload(file) {
    if (!this._validateFile(file)) {
      throw new Error('文件格式不支持或文件过大');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    if (this.options.productId) formData.append('productId', this.options.productId);
    formData.append('businessVersionTags', JSON.stringify(this.options.businessVersionTags || []));
    
    const response = await fetch(getBackendBaseUrl() + '/api/outline/import', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('上传失败: ' + response.statusText);
    }
    
    const result = await response.json();
    const parsedOutline = result?.data?.content || result?.data?.items?.find(item => item.status === 'imported')?.data?.content;
    if (!parsedOutline) throw new Error('服务端未返回统一解析结果');
    result.data.parsedOutline = parsedOutline;
    
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
  
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OutlineUploader;
}
