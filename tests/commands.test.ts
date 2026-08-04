import { describe, expect, test } from '@jest/globals';

import {
  createDeployment,
  createVersion,
  push,
  ClaspContext
} from '../src/clasp/commands';
import { ClaspRunner, RunOptions, RunResult } from '../src/clasp/runner';

class FakeRunner implements ClaspRunner {
  readonly calls: { args: string[]; options: RunOptions }[] = [];

  constructor(private readonly results: RunResult[]) {}

  async run(args: string[], options: RunOptions): Promise<RunResult> {
    this.calls.push({ args, options });
    const result = this.results.shift();
    if (result === undefined) {
      throw new Error('No fake result configured.');
    }
    return result;
  }
}

function context(runner: ClaspRunner): ClaspContext {
  return {
    runner,
    cwd: '/workspace/project',
    extraEnv: {
      clasp_config_auth: '/tmp/auth.json',
      clasp_config_project: '/tmp/project.json'
    }
  };
}

describe('push', () => {
  test('uses force and JSON output and decodes changed paths', async () => {
    const runner = new FakeRunner([
      { stdout: '["src/Code.js"]', stderr: '', exitCode: 0 }
    ]);

    await expect(push(context(runner))).resolves.toEqual(['src/Code.js']);
    expect(runner.calls).toEqual([
      {
        args: ['push', '-f', '--json'],
        options: {
          cwd: '/workspace/project',
          extraEnv: {
            clasp_config_auth: '/tmp/auth.json',
            clasp_config_project: '/tmp/project.json'
          }
        }
      }
    ]);
  });
});

describe('createVersion', () => {
  test('adds a description after the JSON option and decodes the version', async () => {
    const runner = new FakeRunner([
      { stdout: '{"versionNumber":7}', stderr: '', exitCode: 0 }
    ]);

    await expect(createVersion(context(runner), 'release')).resolves.toBe(7);
    expect(runner.calls[0].args).toEqual([
      'create-version',
      '--json',
      'release'
    ]);
  });

  test('omits the description argument when it is undefined', async () => {
    const runner = new FakeRunner([
      { stdout: '{"versionNumber":7}', stderr: '', exitCode: 0 }
    ]);

    await expect(createVersion(context(runner))).resolves.toBe(7);
    expect(runner.calls[0].args).toEqual(['create-version', '--json']);
  });
});

describe('createDeployment', () => {
  test('adds all deployment options and decodes the deployment', async () => {
    const runner = new FakeRunner([
      {
        stdout:
          '{"deploymentId":"deployment-id","versionNumber":7,"description":"release"}',
        stderr: '',
        exitCode: 0
      }
    ]);

    await expect(
      createDeployment(context(runner), {
        deploymentId: 'deployment-id',
        description: 'release',
        versionNumber: 7
      })
    ).resolves.toEqual({
      deploymentId: 'deployment-id',
      versionNumber: 7,
      description: 'release'
    });
    expect(runner.calls[0].args).toEqual([
      'create-deployment',
      '--json',
      '-i',
      'deployment-id',
      '-d',
      'release',
      '-V',
      '7'
    ]);
  });

  test('omits undefined deployment options', async () => {
    const runner = new FakeRunner([
      { stdout: '{"deploymentId":"deployment-id"}', stderr: '', exitCode: 0 }
    ]);

    await expect(createDeployment(context(runner), {})).resolves.toEqual({
      deploymentId: 'deployment-id'
    });
    expect(runner.calls[0].args).toEqual(['create-deployment', '--json']);
  });
});
