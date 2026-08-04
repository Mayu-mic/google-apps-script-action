import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

export interface ProjectFileOptions {
  projectRootPath: string;
  scriptId: string;
  sourceRootDir?: string;
  claspJsonTemplatePath?: string;
}

export interface AppsScriptJsonOptions {
  projectRootPath: string;
  sourceRootDir?: string;
  appsscriptJsonPath: string;
}

export interface TemporaryWorkspace {
  directory: string;
  cleanup(): Promise<void>;
}

function temporaryRoot(): string {
  return path.resolve(process.env.RUNNER_TEMP ?? os.tmpdir());
}

export async function createTemporaryWorkspace(): Promise<TemporaryWorkspace> {
  const root = temporaryRoot();
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(
    path.join(root, 'google-apps-script-action-')
  );
  return {
    directory,
    cleanup: async (): Promise<void> => {
      await rm(directory, { force: true, recursive: true });
    }
  };
}

export async function writeAuthFile(
  workspace: TemporaryWorkspace,
  clasprc: string
): Promise<string> {
  const filePath = path.join(workspace.directory, 'clasprc.json');
  await writeFile(filePath, clasprc, { mode: 0o600 });
  return filePath;
}

export async function createProjectFile(
  workspace: TemporaryWorkspace,
  options: ProjectFileOptions
): Promise<string> {
  let project: Record<string, unknown> = {};
  if (options.claspJsonTemplatePath !== undefined) {
    let templateContents: string;
    try {
      templateContents = await readFile(options.claspJsonTemplatePath, 'utf8');
    } catch {
      throw new Error(
        `Unable to read clasp JSON template: ${options.claspJsonTemplatePath}`
      );
    }

    try {
      const parsed = JSON.parse(templateContents) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('Template must be a JSON object.');
      }
      project = parsed as Record<string, unknown>;
    } catch {
      throw new Error(
        `Unable to parse clasp JSON template: ${options.claspJsonTemplatePath}`
      );
    }
  }

  project.scriptId = options.scriptId;
  project.rootDir =
    options.sourceRootDir === undefined
      ? path.resolve(options.projectRootPath)
      : path.resolve(options.projectRootPath, options.sourceRootDir);
  if ('srcDir' in project) {
    delete project.srcDir;
  }

  const projectPath = path.join(workspace.directory, '.clasp.json');
  await writeFile(projectPath, JSON.stringify(project));
  return projectPath;
}

export function resolveClaspIgnore(
  projectRootPath: string
): string | undefined {
  const ignorePath = path.resolve(projectRootPath, '.claspignore');
  return existsSync(ignorePath) ? ignorePath : undefined;
}

export async function copyAppsScriptJson(
  options: AppsScriptJsonOptions
): Promise<string> {
  const destination = path.resolve(
    options.projectRootPath,
    options.sourceRootDir ?? '.',
    'appsscript.json'
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(options.appsscriptJsonPath, destination);
  return destination;
}
