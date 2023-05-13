import path from 'path';
import { exec } from '@actions/exec';
import core from '@actions/core';
import io from '@actions/io';
import fs from 'fs';

export interface ClaspWrapper {
  push(scriptId: string): void;
  deploy(scriptId: string, option: DeployOption): void;
  version(scriptId: string, option: VersionOption): void;
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

export class ClaspWrapperImpl implements ClaspWrapper {
  private sourceRootDir: string;
  private projectRootPath: string;
  private appsscriptJsonPath?: string;

  constructor(claspOption: ClaspOption = {}) {
    this.sourceRootDir = claspOption.sourceRootDir || '.';
    this.projectRootPath = claspOption.projectRootPath || '.';
    this.appsscriptJsonPath = claspOption.appsscriptJsonPath;
  }

  push(scriptId: string): void {
    if (this.appsscriptJsonPath) {
      this.setupAppsScriptJson(this.appsscriptJsonPath);
    }
    this.createClaspJson(scriptId);
    this.execClasp(['push', '-f']);
  }

  deploy(scriptId: string, option: DeployOption): void {
    this.push(scriptId);
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
    this.execClasp(args);
  }

  version(scriptId: string, option: VersionOption): void {
    this.push(scriptId);
    const args: string[] = ['version'];
    if (option.description) {
      args.push(option.description);
    }
    this.execClasp(args);
  }

  private execClasp(args: string[]): void {
    exec('clasp', args, {
      cwd: this.projectRootPath
    });
  }

  private setupAppsScriptJson(appsscriptJsonPath: string): void {
    io.cp(
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
