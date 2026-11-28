import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');
const versionTsPath = path.join(rootDir, 'src', 'version.ts');

let current = '1.0.0';
try {
  const data = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  if (typeof data.version === 'string' && /^\d+\.\d+\.\d+$/.test(data.version.trim())) {
    current = data.version.trim();
  }
} catch {
  // start from 1.0.0
}

const parts = current.split('.').map((n) => Number(n));
parts[2] = (parts[2] || 0) + 1;
const nextVersion = parts.join('.');

fs.writeFileSync(versionJsonPath, JSON.stringify({ version: nextVersion }, null, 2) + '\n', 'utf8');
fs.writeFileSync(
  versionTsPath,
  `// Tự động cập nhật mỗi lần build / deploy bởi scripts/bump-version.mjs\nexport const BUILD_VERSION = '${nextVersion}';\n`,
  'utf8',
);

console.log(`[version] Bumped deploy version: ${current} -> ${nextVersion}`);
