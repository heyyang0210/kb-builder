function pointerJoin(pointer, part) {
  const escaped = String(part).replace(/~/g, '~0').replace(/\//g, '~1');
  return `${pointer}/${escaped}`;
}

function resolveRef(rootSchema, reference) {
  if (!reference.startsWith('#/')) throw new Error(`Unsupported schema reference: ${reference}`);
  return reference.slice(2).split('/').reduce((current, part) => current[part.replace(/~1/g, '/').replace(/~0/g, '~')], rootSchema);
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateNode(value, schema, rootSchema, pointer, errors) {
  if (schema.$ref) return validateNode(value, resolveRef(rootSchema, schema.$ref), rootSchema, pointer, errors);
  if (schema.oneOf) {
    const matched = schema.oneOf.filter(candidate => {
      const candidateErrors = [];
      validateNode(value, candidate, rootSchema, pointer, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (matched.length !== 1) errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'oneOf' });
    return;
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !deepEqual(value, schema.const)) {
    errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'const' });
    return;
  }
  if (schema.enum && !schema.enum.some(item => deepEqual(item, value))) {
    errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'enum' });
    return;
  }
  if (schema.type) {
    const validType = schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : schema.type === 'array' ? Array.isArray(value)
        : schema.type === 'string' ? typeof value === 'string'
          : schema.type === 'boolean' ? typeof value === 'boolean'
            : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
              : true;
    if (!validType) {
      errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'type' });
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && [...value].length < schema.minLength) errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'minLength' });
    if (schema.maxLength !== undefined && [...value].length > schema.maxLength) errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'maxLength' });
    if (schema.pattern && !(new RegExp(schema.pattern, 'u')).test(value)) errors.push({ issueCode: 'SCHEMA_INVALID', path: pointer || '/', keyword: 'pattern' });
  }
  if (Array.isArray(value)) {
    if (schema.uniqueItems) {
      const seen = new Set();
      value.forEach((item, index) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push({ issueCode: 'SCHEMA_INVALID', path: pointerJoin(pointer, index), keyword: 'uniqueItems' });
        seen.add(key);
      });
    }
    if (schema.items) value.forEach((item, index) => validateNode(item, schema.items, rootSchema, pointerJoin(pointer, index), errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) errors.push({ issueCode: 'REQUIRED_FIELD_MISSING', path: pointerJoin(pointer, required), keyword: 'required' });
    }
    if (schema.propertyNames) Object.keys(value).forEach(key => validateNode(key, schema.propertyNames, rootSchema, pointerJoin(pointer, key), errors));
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validateNode(child, schema.properties[key], rootSchema, pointerJoin(pointer, key), errors);
      else if (schema.additionalProperties === false) errors.push({ issueCode: 'UNKNOWN_FIELD', path: pointerJoin(pointer, key), keyword: 'additionalProperties' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateNode(child, schema.additionalProperties, rootSchema, pointerJoin(pointer, key), errors);
    }
  }
}

// This validator intentionally implements only the JSON Schema keywords used by
// enterprise-profile/v1; it is not a general Draft 2020-12 implementation.
function validateSchema(value, schema) {
  const errors = [];
  validateNode(value, schema, schema, '', errors);
  return errors;
}

module.exports = { validateSchema };
