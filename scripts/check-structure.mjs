import { access } from 'node:fs/promises';
import process from 'node:process';

const requiredPaths = [
  'README.md',
  'docs/architecture.md',
  'docs/rule-based-reading.md',
  'docs/auth-session.md',
  'docs/database-modeling.md',
  'docs/deployment.md',
  'docs/testing.md',
  'docs/public-scope.md',
  'samples/server/README.md',
  'samples/server/prisma/schema.prisma',
  'samples/server/src/myeongri/common/interpretation-state.types.ts',
  'samples/server/src/myeongri/common/reading-policy.types.ts',
  'samples/server/src/myeongri/common/algorithm-config.ts',
  'samples/server/src/myeongri/renderers/block-reading.renderer.ts',
  'samples/server/src/myeongri/renderers/generative-rule-reading.renderer.ts',
  'samples/server/src/myeongri/services/saju-summary-report.service.ts',
  'samples/server/src/auth/auth.service.ts',
  'samples/server/src/share-snapshot/share-snapshot.service.ts',
  'samples/server/test/auth-refresh.test.js',
  'samples/server/test/share-snapshot.test.js',
];

const missing = [];

for (const path of requiredPaths) {
  try {
    await access(path);
  } catch {
    missing.push(path);
  }
}

if (missing.length > 0) {
  console.error('Required public case-study files are missing:');
  missing.forEach((path) => console.error(`- ${path}`));
  process.exit(1);
}

console.log('Public case-study structure looks complete.');
