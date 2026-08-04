import * as core from '@actions/core';
import path from 'path';

import { detectClasprcFormat } from './auth/clasprcFormat';
import {
  createDeployment,
  createVersion,
  ClaspContext,
  push
} from './clasp/commands';
import { installClasp } from './clasp/install';
import { ClaspRunner, ExecClaspRunner } from './clasp/runner';
import {
  parseDeployInputs,
  parsePushInputs,
  parseVersionInputs,
  PushInputs,
  DeployInputs,
  VersionInputs
} from './inputs';
import {
  copyAppsScriptJson,
  createProjectFile,
  createTemporaryWorkspace,
  resolveClaspIgnore,
  TemporaryWorkspace,
  writeAuthFile
} from './workspace';

export interface ActionCore {
  getInput: (name: string) => string;
  warning: (message: string) => void;
  setOutput: (name: string, value: string | number) => void;
  setFailed: (message: string) => void;
}

export interface WorkspaceOperations {
  createTemporaryWorkspace: typeof createTemporaryWorkspace;
  writeAuthFile: typeof writeAuthFile;
  createProjectFile: typeof createProjectFile;
  resolveClaspIgnore: typeof resolveClaspIgnore;
  copyAppsScriptJson: typeof copyAppsScriptJson;
}

export interface RunDependencies {
  core: ActionCore;
  installClasp: typeof installClasp;
  createRunner: (claspBinPath: string) => ClaspRunner;
  workspace: WorkspaceOperations;
}

export const defaultRunDependencies: RunDependencies = {
  core,
  installClasp,
  createRunner: claspBinPath => new ExecClaspRunner(claspBinPath),
  workspace: {
    createTemporaryWorkspace,
    writeAuthFile,
    createProjectFile,
    resolveClaspIgnore,
    copyAppsScriptJson
  }
};

type InputParser<Inputs extends PushInputs> = (
  getInput: (name: string) => string
) => Inputs;
type ActionCommand<Inputs extends PushInputs> = (
  context: ClaspContext,
  inputs: Inputs
) => Promise<void>;

async function runAction<Inputs extends PushInputs>(
  dependencies: RunDependencies,
  parseInputs: InputParser<Inputs>,
  command: ActionCommand<Inputs>
): Promise<void> {
  let workspace: TemporaryWorkspace | undefined;

  try {
    const inputs = parseInputs(name => dependencies.core.getInput(name));
    const clasprcFormat = detectClasprcFormat(inputs.clasprc);
    if (clasprcFormat === 'v1-global') {
      dependencies.core.warning(
        'The v1-global clasprc format is supported, but client_id and client_secret will be replaced with clasp defaults.'
      );
    }

    const projectRootPath = inputs.projectRootPath ?? '.';
    workspace = await dependencies.workspace.createTemporaryWorkspace();
    const authPath = await dependencies.workspace.writeAuthFile(
      workspace,
      inputs.clasprc
    );
    const projectPath = await dependencies.workspace.createProjectFile(
      workspace,
      {
        projectRootPath,
        scriptId: inputs.scriptId,
        sourceRootDir: inputs.sourceRootDir,
        claspJsonTemplatePath: inputs.claspJsonTemplatePath
      }
    );
    const extraEnv: Record<string, string> = {
      clasp_config_auth: authPath,
      clasp_config_project: projectPath
    };
    const ignorePath =
      dependencies.workspace.resolveClaspIgnore(projectRootPath);
    if (ignorePath !== undefined) {
      extraEnv.clasp_config_ignore = ignorePath;
    }

    if (inputs.appsscriptJsonPath !== undefined) {
      await dependencies.workspace.copyAppsScriptJson({
        projectRootPath,
        sourceRootDir: inputs.sourceRootDir,
        appsscriptJsonPath: inputs.appsscriptJsonPath
      });
    }

    const claspBinPath = await dependencies.installClasp(
      path.join(workspace.directory, 'clasp')
    );
    const context: ClaspContext = {
      runner: dependencies.createRunner(claspBinPath),
      cwd: path.resolve(projectRootPath),
      extraEnv
    };
    await command(context, inputs);
  } catch (error) {
    dependencies.core.setFailed(
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    if (workspace !== undefined) {
      try {
        await workspace.cleanup();
      } catch (error) {
        dependencies.core.warning(
          `Unable to clean up temporary workspace "${
            workspace.directory
          }". Authentication files may remain in this directory. Cleanup error: ${String(
            error
          )}`
        );
      }
    }
  }
}

export async function runPush(
  dependencies: RunDependencies = defaultRunDependencies
): Promise<void> {
  await runAction(dependencies, parsePushInputs, async context => {
    await push(context);
  });
}

export async function runDeploy(
  dependencies: RunDependencies = defaultRunDependencies
): Promise<void> {
  await runAction(
    dependencies,
    parseDeployInputs,
    async (context, inputs: DeployInputs) => {
      await push(context);
      const result = await createDeployment(context, {
        deploymentId: inputs.deploymentId,
        description: inputs.description,
        versionNumber: inputs.versionNumber
      });
      dependencies.core.setOutput('deploymentId', result.deploymentId);
      dependencies.core.setOutput('versionNumber', result.versionNumber ?? '');
    }
  );
}

export async function runVersion(
  dependencies: RunDependencies = defaultRunDependencies
): Promise<void> {
  await runAction(
    dependencies,
    parseVersionInputs,
    async (context, inputs: VersionInputs) => {
      await push(context);
      const versionNumber = await createVersion(context, inputs.description);
      dependencies.core.setOutput('versionNumber', versionNumber);
    }
  );
}
