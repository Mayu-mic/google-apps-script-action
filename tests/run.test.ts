import path from 'path';
import { afterEach, describe, expect, jest, test } from '@jest/globals';

import {
  ActionCore,
  defaultRunDependencies,
  RunDependencies,
  runDeploy,
  runPush,
  runVersion
} from '../src/run';
import {
  ClaspRunner,
  ExecClaspRunner,
  RunOptions,
  RunResult
} from '../src/clasp/runner';
import { TemporaryWorkspace } from '../src/workspace';

interface Fixture {
  dependencies: RunDependencies;
  core: ActionCore;
  workspace: TemporaryWorkspace;
  runnerCalls: { args: string[]; options: RunOptions }[];
}

function createCore(inputs: Record<string, string>): ActionCore {
  return {
    getInput: jest.fn((name: string): string => inputs[name] ?? ''),
    warning: jest.fn(),
    setOutput: jest.fn(),
    setFailed: jest.fn()
  };
}

function createFixture(
  inputs: Record<string, string>,
  results: (RunResult | Error | string)[],
  options: { claspIgnore?: string } = {}
): Fixture {
  const core = createCore(inputs);
  const workspace: TemporaryWorkspace = {
    directory: '/tmp/action-workspace',
    cleanup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
  const runnerCalls: { args: string[]; options: RunOptions }[] = [];
  const runner: ClaspRunner = {
    run: jest.fn(
      async (args: string[], runOptions: RunOptions): Promise<RunResult> => {
        runnerCalls.push({ args, options: runOptions });
        const result = results.shift();
        if (result instanceof Error || typeof result === 'string') {
          throw result;
        }
        if (result === undefined) {
          throw new Error('No fake result configured.');
        }
        return result;
      }
    )
  };

  const dependencies: RunDependencies = {
    ...defaultRunDependencies,
    core,
    installClasp: jest
      .fn<(installDir: string) => Promise<string>>()
      .mockResolvedValue('/tmp/action-workspace/clasp/index.js'),
    createRunner: jest
      .fn<(claspBinPath: string) => ClaspRunner>()
      .mockReturnValue(runner),
    workspace: {
      createTemporaryWorkspace: jest
        .fn<() => Promise<TemporaryWorkspace>>()
        .mockResolvedValue(workspace),
      writeAuthFile: jest
        .fn<
          (workspaceArg: TemporaryWorkspace, clasprc: string) => Promise<string>
        >()
        .mockResolvedValue('/tmp/action-workspace/clasprc.json'),
      createProjectFile: jest
        .fn<
          (
            workspaceArg: TemporaryWorkspace,
            templateOptions: {
              projectRootPath: string;
              scriptId: string;
              sourceRootDir?: string;
              claspJsonTemplatePath?: string;
            }
          ) => Promise<string>
        >()
        .mockResolvedValue('/tmp/action-workspace/.clasp.json'),
      resolveClaspIgnore: jest
        .fn<(projectRootPath: string) => string | undefined>()
        .mockReturnValue(options.claspIgnore),
      copyAppsScriptJson: jest
        .fn<
          (copyOptions: {
            projectRootPath: string;
            sourceRootDir?: string;
            appsscriptJsonPath: string;
          }) => Promise<string>
        >()
        .mockResolvedValue('/tmp/project/appsscript.json')
    }
  };

  return { dependencies, core, workspace, runnerCalls };
}

function rejectCleanup(fixture: Fixture, reason: Error | string): void {
  fixture.workspace.cleanup = jest
    .fn<() => Promise<void>>()
    .mockRejectedValue(reason);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('runPush', () => {
  test('builds the clasp context and cleans up after success', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id'
      },
      [{ stdout: '[]', stderr: '', exitCode: 0 }]
    );

    await runPush(fixture.dependencies);

    expect(fixture.dependencies.installClasp).toHaveBeenCalledWith(
      path.join(fixture.workspace.directory, 'clasp')
    );
    expect(
      fixture.dependencies.workspace.createProjectFile
    ).toHaveBeenCalledWith(fixture.workspace, {
      projectRootPath: '.',
      scriptId: 'script-id',
      sourceRootDir: undefined,
      claspJsonTemplatePath: undefined
    });
    expect(fixture.runnerCalls).toEqual([
      {
        args: ['push', '-f', '--json'],
        options: {
          cwd: path.resolve('.'),
          extraEnv: {
            clasp_config_auth: '/tmp/action-workspace/clasprc.json',
            clasp_config_project: '/tmp/action-workspace/.clasp.json'
          }
        }
      }
    ]);
    expect(fixture.core.warning).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.workspace.cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.core.setFailed).not.toHaveBeenCalled();
  });

  test('warns for v1-global auth and includes optional ignore and appsscript paths', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"access_token":"token"}',
        scriptId: 'script-id',
        projectRootPath: '/project',
        sourceRootDir: 'src',
        appsscriptJsonPath: '/input/appsscript.json',
        claspJsonTemplatePath: '/input/template.json'
      },
      [{ stdout: '[]', stderr: '', exitCode: 0 }],
      { claspIgnore: '/project/.claspignore' }
    );

    await runPush(fixture.dependencies);

    expect(fixture.core.warning).toHaveBeenCalledWith(
      expect.stringContaining('client_id and client_secret')
    );
    expect(
      fixture.dependencies.workspace.copyAppsScriptJson
    ).toHaveBeenCalledWith({
      projectRootPath: '/project',
      sourceRootDir: 'src',
      appsscriptJsonPath: '/input/appsscript.json'
    });
    expect(fixture.runnerCalls[0].options.extraEnv).toEqual({
      clasp_config_auth: '/tmp/action-workspace/clasprc.json',
      clasp_config_project: '/tmp/action-workspace/.clasp.json',
      clasp_config_ignore: '/project/.claspignore'
    });
  });

  test('reports an invalid clasprc and does not create a workspace', async () => {
    const fixture = createFixture({ clasprc: '{}', scriptId: 'script-id' }, []);

    await runPush(fixture.dependencies);

    expect(fixture.core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Please provide')
    );
    expect(
      fixture.dependencies.workspace.createTemporaryWorkspace
    ).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.workspace.cleanup).not.toHaveBeenCalled();
  });
});

describe('runDeploy', () => {
  test('pushes before deploying and sets an empty version output when absent', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id',
        deploymentId: 'deployment-id',
        versionNumber: '7',
        description: 'release'
      },
      [
        { stdout: '[]', stderr: '', exitCode: 0 },
        { stdout: '{"deploymentId":"deployment-id"}', stderr: '', exitCode: 0 }
      ]
    );

    await runDeploy(fixture.dependencies);

    expect(fixture.runnerCalls.map(call => call.args[0])).toEqual([
      'push',
      'create-deployment'
    ]);
    expect(fixture.core.setOutput).toHaveBeenCalledWith(
      'deploymentId',
      'deployment-id'
    );
    expect(fixture.core.setOutput).toHaveBeenCalledWith('versionNumber', '');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.workspace.cleanup).toHaveBeenCalledTimes(1);
  });

  test('sets the deployment version when clasp returns one', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id'
      },
      [
        { stdout: '[]', stderr: '', exitCode: 0 },
        {
          stdout: '{"deploymentId":"deployment-id","versionNumber":8}',
          stderr: '',
          exitCode: 0
        }
      ]
    );

    await runDeploy(fixture.dependencies);

    expect(fixture.core.setOutput).toHaveBeenCalledWith('versionNumber', 8);
  });
});

describe('runVersion', () => {
  test('pushes before creating a version and does not set deploymentId', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id',
        description: 'release'
      },
      [
        { stdout: '[]', stderr: '', exitCode: 0 },
        { stdout: '{"versionNumber":9}', stderr: '', exitCode: 0 }
      ]
    );

    await runVersion(fixture.dependencies);

    expect(fixture.runnerCalls.map(call => call.args[0])).toEqual([
      'push',
      'create-version'
    ]);
    expect(fixture.core.setOutput).toHaveBeenCalledWith('versionNumber', 9);
    expect(fixture.core.setOutput).not.toHaveBeenCalledWith(
      'deploymentId',
      expect.anything()
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.workspace.cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('runAction failure handling', () => {
  test('reports an Error and cleans up after a command failure', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id'
      },
      [new Error('clasp failed')]
    );

    await runPush(fixture.dependencies);

    expect(fixture.core.setFailed).toHaveBeenCalledWith('clasp failed');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.workspace.cleanup).toHaveBeenCalledTimes(1);
  });

  test('reports a non-Error thrown value and still cleans up', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id'
      },
      ['plain failure']
    );

    await runPush(fixture.dependencies);

    expect(fixture.core.setFailed).toHaveBeenCalledWith('plain failure');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.workspace.cleanup).toHaveBeenCalledTimes(1);
  });

  test('warns when cleanup fails after a successful command', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id'
      },
      [{ stdout: '[]', stderr: '', exitCode: 0 }]
    );
    rejectCleanup(fixture, new Error('cleanup failed'));

    await expect(runPush(fixture.dependencies)).resolves.toBeUndefined();

    expect(fixture.core.warning).toHaveBeenCalledWith(
      expect.stringContaining(fixture.workspace.directory)
    );
    expect(fixture.core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Authentication')
    );
    expect(fixture.core.setFailed).not.toHaveBeenCalled();
  });

  test('reports both command failure and cleanup failure', async () => {
    const fixture = createFixture(
      {
        clasprc: '{"tokens":{"default":{}}}',
        scriptId: 'script-id'
      },
      [new Error('clasp failed')]
    );
    rejectCleanup(fixture, 'cleanup failed');

    await expect(runPush(fixture.dependencies)).resolves.toBeUndefined();

    expect(fixture.core.setFailed).toHaveBeenCalledWith('clasp failed');
    expect(fixture.core.warning).toHaveBeenCalledWith(
      expect.stringContaining(fixture.workspace.directory)
    );
  });
});

describe('default run dependencies', () => {
  test('creates an executable clasp runner', () => {
    expect(defaultRunDependencies.createRunner('/tmp/clasp.js')).toBeInstanceOf(
      ExecClaspRunner
    );
  });

  test('uses default dependencies when no injection is supplied', async () => {
    const setFailed = jest
      .spyOn(defaultRunDependencies.core, 'setFailed')
      .mockImplementation(() => undefined);

    await runPush();
    await runDeploy();
    await runVersion();

    expect(setFailed).toHaveBeenCalledTimes(3);
  });
});
