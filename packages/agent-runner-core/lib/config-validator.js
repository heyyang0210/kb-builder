class ConfigValidator {
  static validateModelConfig(config) {
    const errors = [];

    if (!config.provider) {
      errors.push('provider is required');
    }

    const validProviders = ['openai', 'alibaba', 'zhipu', 'custom'];
    if (config.provider && !validProviders.includes(config.provider)) {
      errors.push(`provider must be one of: ${validProviders.join(', ')}`);
    }

    if (!config.model) {
      errors.push('model is required');
    }

    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        errors.push('temperature must be a number between 0 and 2');
      }
    }

    if (config.max_tokens !== undefined) {
      if (typeof config.max_tokens !== 'number' || config.max_tokens < 1) {
        errors.push('max_tokens must be a positive number');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateMCPConfig(config) {
    const errors = [];

    if (!config.server_url) {
      errors.push('server_url is required');
    }

    try {
      if (config.server_url) {
        new URL(config.server_url);
      }
    } catch {
      errors.push('server_url must be a valid URL');
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 1000) {
        errors.push('timeout must be a number >= 1000ms');
      }
    }

    if (config.cache) {
      if (config.cache.ttl !== undefined && (typeof config.cache.ttl !== 'number' || config.cache.ttl < 0)) {
        errors.push('cache.ttl must be a non-negative number');
      }
      if (config.cache.max_size !== undefined && (typeof config.cache.max_size !== 'number' || config.cache.max_size < 1)) {
        errors.push('cache.max_size must be a positive number');
      }
    }

    // 验证 headers
    if (config.headers && Array.isArray(config.headers)) {
      config.headers.forEach((header, index) => {
        if (!header.name || typeof header.name !== 'string') {
          errors.push(`header[${index}].name is required and must be a string`);
        }
        if (header.encrypted === undefined) {
          errors.push(`header[${index}].encrypted is required`);
        }
        if (header.encrypted && !header.value && !header.value_encrypted) {
          errors.push(`header[${index}].value is required when encrypted=true`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateAgentPreset(preset) {
    const errors = [];

    if (!preset.id) errors.push('id is required');
    if (!preset.name) errors.push('name is required');
    if (!preset.steps || !Array.isArray(preset.steps) || preset.steps.length === 0) {
      errors.push('at least one step is required');
    }

    if (preset.steps) {
      const validAgents = ['planner', 'retriever', 'generator', 'validator'];
      preset.steps.forEach((step, i) => {
        if (!step.name) errors.push(`step[${i}].name is required`);
        if (!step.agent) errors.push(`step[${i}].agent is required`);
        if (step.agent && !validAgents.includes(step.agent)) {
          errors.push(`step[${i}].agent must be one of: ${validAgents.join(', ')}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ConfigValidator;
