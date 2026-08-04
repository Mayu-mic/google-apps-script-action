import { getExecOutput } from '@actions/exec';
import { existsSync } from 'fs';
import path from 'path';

export const CLASP_VERSION = '3.3.0';

export type NpmExecutor = (command: string, args: string[]) => Promise<void>;

const defaultNpmExecutor: NpmExecutor = async (
  command: string,
  args: string[]
): Promise<void> => {
  await getExecOutput(command, args);
};

export async function installClasp(
  installDir: string,
  executeNpm: NpmExecutor = defaultNpmExecutor
): Promise<string> {
  const resolvedInstallDir = path.resolve(installDir);
  await executeNpm('npm', [
    'install',
    '--prefix',
    resolvedInstallDir,
    '--no-audit',
    '--no-fund',
    `@google/clasp@${CLASP_VERSION}`
  ]);

  const binPath = path.join(
    resolvedInstallDir,
    'node_modules/@google/clasp/build/src/index.js'
  );
  if (!existsSync(binPath)) {
    throw new Error(`clasp bin was not found after installation: ${binPath}`);
  }
  return binPath;
}
