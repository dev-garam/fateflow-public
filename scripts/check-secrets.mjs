import { readFile } from 'node:fs/promises';
import process from 'node:process';
import fg from 'fast-glob';

const patterns = [
  { label: 'DATABASE_URL assignment', regex: /DATABASE_URL\s*=/ },
  { label: 'REDIS_HOST assignment', regex: /REDIS_HOST\s*=/ },
  { label: 'JWT_ACCESS_SECRET assignment', regex: /JWT_ACCESS_SECRET\s*=/ },
  { label: 'JWT_REFRESH_SECRET assignment', regex: /JWT_REFRESH_SECRET\s*=/ },
  { label: 'Google API key', regex: /AIza[0-9A-Za-z_-]{20,}/ },
  { label: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  { label: 'private key block', regex: /-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?KEY-----/ },
  { label: 'local absolute path', regex: /\/Users\/dev-garam/ },
  { label: 'Terraform state mention', regex: /terraform\.tfstate/ },
  { label: 'Terraform tfvars mention', regex: /terraform\.tfvars/ },
  { label: 'IPv4 literal', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
];

const files = await fg(['**/*'], {
  dot: true,
  onlyFiles: true,
  ignore: ['node_modules/**', '.git/**', 'package-lock.json'],
});

const findings = [];

for (const file of files) {
  const content = await readFile(file, 'utf8').catch(() => null);
  if (content === null) {
    continue;
  }

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push(`${file}:${index + 1} ${pattern.label}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Potential public-scope issues found:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log('No obvious secret or environment value patterns found.');
