/** Load the repo-root .env into process.env. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from './paths';

export function loadEnv(): void {
  const envFile = join(paths.root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
