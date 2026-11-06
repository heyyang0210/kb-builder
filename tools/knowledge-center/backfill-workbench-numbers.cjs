#!/usr/bin/env node
// Offline file migration. Never points at the aggregate database directly.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { backfillDocumentNumbers, backfillHistoricalNumbers } = require('../../packages/agent-runner-core/lib/workbench-numbering');

const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const ticketPath = option('--ticket-state');
const reviewPath = option('--review-state');
const outputPath = option('--output');
if (!ticketPath || !reviewPath || !outputPath || args.includes('--apply')) {
  process.stderr.write('Usage: node backfill-workbench-numbers.cjs --ticket-state INPUT.json --review-state REVIEW.json --output runtime/PATCH.json\n');
  process.exitCode = 2;
} else {
  const source = fs.readFileSync(ticketPath);
  const tickets = JSON.parse(source);
  const reviews = JSON.parse(fs.readFileSync(reviewPath));
  if (tickets.schemaVersion !== 2 || !Array.isArray(tickets.tasks) || !Array.isArray(reviews.tasks)) throw new Error('状态格式不符合迁移契约');
  const migrated = structuredClone(tickets);
  backfillDocumentNumbers(migrated);
  backfillHistoricalNumbers(migrated, reviews);
  const report = {
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    ticketCount: tickets.tasks.length,
    documentCount: migrated.tasks.flatMap(task => task.decomposition?.handbooks || []).flatMap(book => book.documents || []).length,
    historicalCount: Object.values(migrated.workbenchNumbers.entries).filter(entry => entry.status === 'historical').length,
    needsReview: Object.entries(migrated.workbenchNumbers.entries).filter(([, entry]) => entry.status === 'needs_review').map(([root]) => root),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(ticketPath, `${outputPath}.backup.json`, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(outputPath, JSON.stringify({ report, state: migrated }, null, 2));
  process.stdout.write(JSON.stringify(report) + '\n');
}
