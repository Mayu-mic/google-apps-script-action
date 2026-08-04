import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { getExecOutput } from '@actions/exec';
import { afterEach, describe, expect, jest, test } from '@jest/globals';

import { CLASP_VERSION, installClasp } from '../src/clasp/install';

jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn()
}));

const mockedGetExecOutput = getExecOutput as jest.MockedFunction<
  typeof getExecOutput
>;

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async directory => rm(directory, { force: true, recursive: true }))
  );
});

async function createInstallDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'clasp-install-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('installClasp', () => {
  test('runs npm with the pinned clasp version and returns its bin path', async () => {
    const installDir = await createInstallDirectory();
    const binPath = path.join(
      installDir,
      'node_modules/@google/clasp/build/src/index.js'
    );
    await mkdir(path.dirname(binPath), { recursive: true });
    await writeFile(binPath, '');
    const calls: { command: string; args: string[] }[] = [];

    const result = await installClasp(installDir, async (command, args) => {
      calls.push({ command, args });
    });

    expect(result).toBe(binPath);
    expect(calls).toEqual([
      {
        command: 'npm',
        args: [
          'install',
          '--prefix',
          installDir,
          '--no-audit',
          '--no-fund',
          `@google/clasp@${CLASP_VERSION}`
        ]
      }
    ]);
  });

  test('throws when npm finishes without creating the clasp bin', async () => {
    const installDir = await createInstallDirectory();

    await expect(
      installClasp(installDir, async () => undefined)
    ).rejects.toThrow(binPathFor(installDir));
  });

  test('uses getExecOutput for the default npm executor', async () => {
    const installDir = await createInstallDirectory();
    const binPath = binPathFor(installDir);
    await mkdir(path.dirname(binPath), { recursive: true });
    await writeFile(binPath, '');
    mockedGetExecOutput.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });

    await expect(installClasp(installDir)).resolves.toBe(binPath);

    expect(mockedGetExecOutput).toHaveBeenCalledWith('npm', [
      'install',
      '--prefix',
      installDir,
      '--no-audit',
      '--no-fund',
      `@google/clasp@${CLASP_VERSION}`
    ]);
  });
});

function binPathFor(installDir: string): string {
  return path.join(installDir, 'node_modules/@google/clasp/build/src/index.js');
}
