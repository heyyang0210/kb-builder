import { openProductionWritingPage } from './production-writing-page.js';

// Compatibility entry point for integrations that still open the production workbench as a dialog.
// The writing page owns the current interaction and keeps the same data-* contract.
export function openProductionAIDialog(options = {}) {
  const host = options.host || document.getElementById('view-root') || document.body;
  return openProductionWritingPage({
    ...options,
    host,
    operation: options.operation || 'generate',
    editVersion: Number.isSafeInteger(options.editVersion) ? options.editVersion : 0,
    getMarkdown: options.getMarkdown || (() => ''),
    baselineDigest: options.baselineDigest || (async () => ''),
    onAdopt: options.onAdopt || (() => {}),
  });
}
