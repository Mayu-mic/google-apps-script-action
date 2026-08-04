import { getExecOutput } from '@actions/exec';
import { describe, expect, jest, test } from '@jest/globals';

import { ExecClaspRunner } from '../src/clasp/runner';

jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn()
}));

const mockedGetExecOutput = getExecOutput as jest.MockedFunction<
  typeof getExecOutput
>;

describe('ExecClaspRunner', () => {
  test('runs clasp with the action runtime and passes cwd and env', async () => {
    const inheritedKey = 'CLASP_RUNNER_INHERITED';
    const overrideKey = 'CLASP_RUNNER_OVERRIDE';
    const originalInherited = process.env[inheritedKey];
    const originalOverride = process.env[overrideKey];
    process.env[inheritedKey] = 'from-process';
    process.env[overrideKey] = 'from-process';
    mockedGetExecOutput.mockResolvedValue({
      exitCode: 0,
      stdout: '{"ok":true}',
      stderr: ''
    });
    const runner = new ExecClaspRunner('/tmp/clasp/index.js');
    const options = {
      cwd: '/workspace/project',
      extraEnv: {
        clasp_config_project: '/tmp/project.json',
        [overrideKey]: 'from-extra'
      }
    };

    try {
      await expect(runner.run(['push', '--json'], options)).resolves.toEqual({
        stdout: '{"ok":true}',
        stderr: '',
        exitCode: 0
      });
      expect(mockedGetExecOutput).toHaveBeenCalledWith(
        process.execPath,
        ['/tmp/clasp/index.js', 'push', '--json'],
        expect.objectContaining({
          cwd: '/workspace/project',
          env: expect.objectContaining({
            [inheritedKey]: 'from-process',
            [overrideKey]: 'from-extra',
            clasp_config_project: '/tmp/project.json'
          }),
          ignoreReturnCode: true
        })
      );
      const passedEnv = mockedGetExecOutput.mock.calls[0][2]?.env as Record<
        string,
        string
      >;
      expect(passedEnv.PATH).toBe(process.env.PATH);
    } finally {
      if (originalInherited === undefined) {
        delete process.env[inheritedKey];
      } else {
        process.env[inheritedKey] = originalInherited;
      }
      if (originalOverride === undefined) {
        delete process.env[overrideKey];
      } else {
        process.env[overrideKey] = originalOverride;
      }
    }
  });

  test('throws an error containing stderr when clasp exits unsuccessfully', async () => {
    mockedGetExecOutput.mockResolvedValue({
      exitCode: 9,
      stdout: '',
      stderr: 'clasp failed: authentication required'
    });
    const runner = new ExecClaspRunner('/tmp/clasp/index.js');

    await expect(
      runner.run(['push', '-f', '--json'], {
        cwd: '/workspace/project',
        extraEnv: {}
      })
    ).rejects.toThrow('clasp failed: authentication required');
  });

  test('omits an undefined inherited environment value', async () => {
    const undefinedKey = 'CLASP_RUNNER_UNDEFINED';
    Object.defineProperty(process.env, undefinedKey, {
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true
    });
    mockedGetExecOutput.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });

    try {
      await new ExecClaspRunner('/tmp/clasp/index.js').run([], {
        cwd: '/workspace/project',
        extraEnv: {}
      });
      const passedEnv = mockedGetExecOutput.mock.calls[0][2]?.env as Record<
        string,
        string
      >;
      expect(undefinedKey in passedEnv).toBe(false);
    } finally {
      delete process.env[undefinedKey];
    }
  });
});
