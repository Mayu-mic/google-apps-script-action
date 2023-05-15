import * as core from '@actions/core';
import { exec } from '@actions/exec';
import { ClaspWrapperImpl, ClaspWrapper } from './claspWrapper';
import fs from 'fs';
import path from 'path';

async function run(): Promise<void> {
  try {
    const clasprc = core.getInput('clasprc', { required: true });
    const scriptId = core.getInput('scriptId', { required: true });
    const command = core.getInput('command', {
      required: true,
      trimWhitespace: true
    });
    const description = core.getInput('description', { required: false });
    const deploymentId = core.getInput('deploymentId', { required: false });
    const versionNumber = core.getInput('versionNumber', {
      required: false
    });
    const projectRootPath = core.getInput('projectRootPath', {
      required: false
    });
    const sourceRootDir = core.getInput('sourceRootDir', {
      required: false
    });
    const appsscriptJsonPath = core.getInput('appsscriptJsonPath', {
      required: false
    });

    if (command === 'check') {
      await exec('clasp', ['--version']);
      return;
    }

    const homeDir = process.env.HOME ?? '.';
    fs.writeFileSync(path.join(homeDir, '.clasprc.json'), clasprc);

    const claspWrapper: ClaspWrapper = new ClaspWrapperImpl({
      sourceRootDir,
      projectRootPath,
      appsscriptJsonPath
    });

    switch (command) {
      case 'push':
        await claspWrapper.push(scriptId);
        break;
      case 'deploy': {
        const { versionNumber: newVersion, deploymentId: newDeploymentId } =
          await claspWrapper.deploy(scriptId, {
            description,
            deploymentId,
            versionNumber:
              versionNumber === undefined ? Number(versionNumber) : undefined
          });
        core.setOutput('versionNumber', newVersion ?? '');
        core.setOutput('deploymentId', newDeploymentId ?? '');
        break;
      }
      case 'version': {
        const { versionNumber: newVersion, deploymentId: newDeploymentId } =
          await claspWrapper.version(scriptId, {
            description
          });
        core.setOutput('versionNumber', newVersion ?? '');
        core.setOutput('deploymentId', newDeploymentId ?? '');
        break;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
