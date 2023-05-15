import path from 'path';
import { getExecOutput } from '@actions/exec';
import * as core from '@actions/core';
import * as io from '@actions/io';
import fs from 'fs';

export interface ClaspWrapper {
  push(scriptId: string): Promise<void>;
  deploy(scriptId: string, option: DeployOption): Promise<ClaspOutput>;
  version(scriptId: string, option: VersionOption): Promise<ClaspOutput>;
}

interface ClaspOption {
  sourceRootDir?: string;
  projectRootPath?: string;
  appsscriptJsonPath?: string;
}

interface DeployOption {
  description?: string;
  deploymentId?: string;
  versionNumber?: number;
}

interface VersionOption {
  description?: string;
}

interface ClaspJson {
  scriptId: string;
  rootDir?: string;
}

interface ClaspOutput {
  versionNumber?: number;
  deploymentId?: string;
}

export class ClaspWrapperImpl implements ClaspWrapper {
  private sourceRootDir: string;
  private projectRootPath: string;
  private appsscriptJsonPath?: string;

  constructor(claspOption: ClaspOption = {}) {
    this.sourceRootDir = claspOption.sourceRootDir || '.';
    this.projectRootPath = claspOption.projectRootPath || '.';
    this.appsscriptJsonPath = claspOption.appsscriptJsonPath;
  }

  async push(scriptId: string): Promise<void> {
    if (this.appsscriptJsonPath) {
      await this.setupAppsScriptJson(this.appsscriptJsonPath);
    }
    this.createClaspJson(scriptId);
    await this.execClasp(['push', '-f']);
  }

  async deploy(scriptId: string, option: DeployOption): Promise<ClaspOutput> {
    await this.push(scriptId);
    const args: string[] = ['deploy'];
    if (option.deploymentId) {
      args.push('-i', option.deploymentId);
    }
    if (option.description) {
      args.push('-d', option.description);
    }
    if (option.versionNumber) {
      args.push('-V', option.versionNumber.toString());
    }
    return await this.execClasp(args);
  }

  async version(scriptId: string, option: VersionOption): Promise<ClaspOutput> {
    await this.push(scriptId);
    const args: string[] = ['version'];
    if (option.description) {
      args.push(option.description);
    }
    return await this.execClasp(args);
  }

  private async execClasp(args: string[]): Promise<ClaspOutput> {
    const response = await getExecOutput('clasp', args, {
      cwd: this.projectRootPath
    });

    core.info(response.stdout);
    let versionNumber: number | undefined = undefined;
    let deploymentId: string | undefined = undefined;
    for (const line of response.stdout.split('\n')) {
      const versionMatch = line.match(/Created version (\d+)\./);
      if (versionMatch) {
        versionNumber = Number(versionMatch[1]);
      }
      const deploymentIdMatch = line.match(/- ([\w-_]+) @\d+\./);
      if (deploymentIdMatch) {
        deploymentId = deploymentIdMatch[1];
      }
    }
    return {
      versionNumber,
      deploymentId
    };
  }

  private async setupAppsScriptJson(appsscriptJsonPath: string): Promise<void> {
    await io.cp(
      appsscriptJsonPath,
      path.join(this.projectRootPath, this.sourceRootDir, 'appsscript.json')
    );
    core.debug(`appsscript.json generated: ${appsscriptJsonPath}`);
  }

  private createClaspJson(scriptId: string): void {
    const json: ClaspJson = {
      scriptId,
      rootDir: this.sourceRootDir
    };
    const output = JSON.stringify(json);
    fs.writeFileSync(path.join(this.projectRootPath, '.clasp.json'), output);
    core.debug(`.clasp.json generated: ${output}`);
  }
}
