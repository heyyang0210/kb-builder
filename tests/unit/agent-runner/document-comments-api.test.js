const assert = require('node:assert/strict');

const BACKEND = process.env.DOCUMENT_BACKEND || 'http://localhost:4100';

async function request(method, pathname, body) {
  const response = await fetch(new URL(pathname, BACKEND), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

function commentsPath(docId) {
  return `/api/document/${encodeURIComponent(docId)}/comments`;
}

async function run() {
  const listResult = await request('GET', '/api/document/list');
  assert.equal(listResult.response.status, 200);
  assert.equal(listResult.payload.success, true);
  assert.ok(listResult.payload.data.length >= 2, '评论隔离测试至少需要两篇已注册文档');

  const [primaryDoc, otherDoc] = listResult.payload.data;
  let createdCommentId = null;

  try {
    const created = await request('POST', commentsPath(primaryDoc.id), {
      content: '  API 测试评论  ',
      quote: '  被引用的原文  '
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.success, true);
    assert.match(created.payload.data.id, /^comment_/);
    assert.equal(created.payload.data.documentId, primaryDoc.id);
    assert.equal(created.payload.data.content, 'API 测试评论');
    assert.equal(created.payload.data.quote, '被引用的原文');
    createdCommentId = created.payload.data.id;

    const listed = await request('GET', commentsPath(primaryDoc.id));
    assert.equal(listed.response.status, 200);
    assert.equal(listed.payload.count, listed.payload.data.length);
    assert.ok(listed.payload.data.some(comment => comment.id === createdCommentId));

    const emptyContent = await request('POST', commentsPath(primaryDoc.id), {
      content: '   ',
      quote: ''
    });
    assert.equal(emptyContent.response.status, 400);
    assert.equal(emptyContent.payload.success, false);

    const invalidQuote = await request('POST', commentsPath(primaryDoc.id), {
      content: '正文',
      quote: { text: '错误类型' }
    });
    assert.equal(invalidQuote.response.status, 400);

    const crossDocumentDelete = await request(
      'DELETE',
      `${commentsPath(otherDoc.id)}/${encodeURIComponent(createdCommentId)}`
    );
    assert.equal(crossDocumentDelete.response.status, 404);

    const stillPresent = await request('GET', commentsPath(primaryDoc.id));
    assert.ok(stillPresent.payload.data.some(comment => comment.id === createdCommentId));

    const deletedCommentId = createdCommentId;
    const deleted = await request(
      'DELETE',
      `${commentsPath(primaryDoc.id)}/${encodeURIComponent(deletedCommentId)}`
    );
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.payload.success, true);
    createdCommentId = null;

    const afterDelete = await request('GET', commentsPath(primaryDoc.id));
    assert.ok(!afterDelete.payload.data.some(comment => comment.id === deletedCommentId));

    const repeatedDelete = await request(
      'DELETE',
      `${commentsPath(primaryDoc.id)}/${encodeURIComponent(deletedCommentId)}`
    );
    assert.equal(repeatedDelete.response.status, 404);

    const missingDocument = Buffer.from('output:missing-comment-test.md').toString('base64');
    const missing = await request('GET', commentsPath(missingDocument));
    assert.equal(missing.response.status, 404);
  } finally {
    if (createdCommentId) {
      await request(
        'DELETE',
        `${commentsPath(primaryDoc.id)}/${encodeURIComponent(createdCommentId)}`
      );
    }
  }

  console.log(`Document comments API checks passed against ${BACKEND}`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
