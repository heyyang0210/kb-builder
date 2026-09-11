class ProfileError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
    this.issueCode = options.issueCode || null;
    this.path = options.path || '/';
    this.retryable = false;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      issueCode: this.issueCode,
      path: this.path,
      retryable: this.retryable
    };
  }
}

module.exports = ProfileError;
