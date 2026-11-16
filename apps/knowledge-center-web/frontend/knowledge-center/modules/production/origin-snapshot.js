import { sha256Text } from '../../common/utils/sha256.js';

export async function createPlatformOriginSnapshot(markdown, context = {}) {
  const content = String(markdown ?? '');
  return {
    content,
    snapshot: {
      originType: 'platform',
      snapshotId: null,
      contentDigest: await sha256Text(content),
      handbookId: context.handbookId,
      documentId: context.documentId,
      outlineVersionId: context.outlineVersionId || null,
      branch: context.branch || null,
    },
  };
}
