/**
 * Secrets detection module
 * Detects files that likely contain secrets and should not be sent to LLM
 */

import { minimatch } from 'minimatch';

/**
 * File patterns that likely contain secrets
 * Based on common secret file conventions
 */
const SECRET_FILE_PATTERNS = [
  // Environment files
  '.env',
  '.env.*',
  '*.env',
  '.envrc',

  // NPM/Node
  '.npmrc',
  '.yarnrc',
  '.yarnrc.yml',

  // SSH/GPG keys
  '*.key',
  '*.pem',
  '*.p12',
  '*.pfx',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '*.pub',

  // AWS
  '.aws/**',
  'credentials',

  // Docker
  '.docker/config.json',

  // Git credentials
  '.git-credentials',
  '.netrc',

  // Service account files
  '*-service-account.json',
  '*-serviceaccount.json',
  'service-account*.json',
  'serviceaccount*.json',

  // Kubernetes
  'kubeconfig',
  '*.kubeconfig',

  // Terraform
  '*.tfvars',
  'terraform.tfstate',
  'terraform.tfstate.backup',

  // Other common secrets
  'secrets.yml',
  'secrets.yaml',
  'secret.yml',
  'secret.yaml',
  'passwords.txt',
  'password.txt',
];

/**
 * Content patterns that indicate secrets
 */
const SECRET_CONTENT_PATTERNS = [
  // API keys/tokens
  /api[_-]?key[s]?['":\s]*[a-zA-Z0-9_-]{20,}/i,
  /auth[_-]?token[s]?['":\s]*[a-zA-Z0-9_-]{20,}/i,
  /access[_-]?token[s]?['":\s]*[a-zA-Z0-9_-]{20,}/i,

  // AWS
  /AKIA[0-9A-Z]{16}/,
  /aws[_-]?secret[_-]?access[_-]?key/i,

  // NPM
  /\/\/registry\.npmjs\.org\/:_authToken=/,
  /npm_[A-Za-z0-9]{30,}/,

  // GitHub
  /gh[pousr]_[A-Za-z0-9_]{36,}/,

  // Slack
  /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,}/,

  // Private keys
  /-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,

  // Passwords
  /password['":\s]*['"]/i,

  // Generic patterns
  /secret['":\s]*['"]/i,
];

/**
 * Check if file path matches secret file patterns
 */
export function isSecretFile(filePath: string): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  return SECRET_FILE_PATTERNS.some(pattern =>
    minimatch(normalizedPath, pattern, { matchBase: true })
  );
}

/**
 * Check if file content contains secret patterns
 */
export function containsSecrets(content: string): boolean {
  return SECRET_CONTENT_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Scan files for potential secrets
 * Returns list of files that likely contain secrets
 */
export function detectSecretFiles(files: string[]): string[] {
  return files.filter(isSecretFile);
}

/**
 * Scan file diffs for secrets
 * Returns map of files that contain secrets
 */
export function detectSecretsInDiffs(diffs: Map<string, string>): Map<string, string> {
  const secretDiffs = new Map<string, string>();

  for (const [file, diff] of diffs.entries()) {
    if (containsSecrets(diff)) {
      secretDiffs.set(file, diff);
    }
  }

  return secretDiffs;
}

/**
 * Create error message for detected secrets
 */
export function formatSecretsWarning(secretFiles: string[]): string {
  const count = secretFiles.length;
  const filesList = secretFiles.map(f => `  - ${f}`).join('\n');

  return [
    `🚨 CRITICAL SECURITY ERROR: Detected ${count} file(s) with potential secrets:`,
    filesList,
    '',
    '⛔️ COMMIT GENERATION ABORTED',
    '',
    'These files contain sensitive data (API keys, tokens, credentials)',
    'that MUST NOT be committed to git or sent to LLM.',
    '',
    '✅ Actions to fix:',
    '  1. Add these files to .gitignore',
    '  2. Remove secrets from the files (use environment variables instead)',
    '  3. If already committed, use git filter-branch or BFG to remove from history',
    '',
    '⚠️  If you already ran commit:generate before, the secrets may have been',
    'sent to OpenAI. Rotate your credentials immediately.',
  ].join('\n');
}
