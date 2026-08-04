import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';

import {
  copyAppsScriptJson,
  createTemporaryWorkspace,
  createProjectFile,
  resolveClaspIgnore,
  writeAuthFile
} from '../src/workspace';

const temporaryDirectories: string[] = [];
let originalRunnerTemp: string | undefined;
let originalHome: string | undefined;

beforeEach(async () => {
  originalRunnerTemp = process.env.RUNNER_TEMP;
  originalHome = process.env.HOME;
  const testRoot = await mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
  temporaryDirectories.push(testRoot);
  process.env.RUNNER_TEMP = testRoot;
  process.env.HOME = path.join(testRoot, 'home');
});

afterEach(async () => {
  if (originalRunnerTemp === undefined) {
    delete process.env.RUNNER_TEMP;
  } else {
    process.env.RUNNER_TEMP = originalRunnerTemp;
  }
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async directory => rm(directory, { force: true, recursive: true }))
  );
});

describe('writeAuthFile', () => {
  test('writes clasprc into a temporary file instead of HOME', async () => {
    const clasprc = '{"token":{"access_token":"secret"}}';
    const workspace = await createTemporaryWorkspace();

    const authPath = await writeAuthFile(workspace, clasprc);

    await expect(readFile(authPath, 'utf8')).resolves.toBe(clasprc);
    expect((await stat(authPath)).mode & 0o777).toBe(0o600);
    await expect(
      readFile(path.join(process.env.HOME as string, '.clasprc.json'), 'utf8')
    ).rejects.toThrow();
    expect(path.isAbsolute(authPath)).toBe(true);
    expect(authPath.startsWith(process.env.RUNNER_TEMP as string)).toBe(true);
  });

  test('falls back to os.tmpdir when RUNNER_TEMP is unset', async () => {
    delete process.env.RUNNER_TEMP;

    const workspace = await createTemporaryWorkspace();
    const authPath = await writeAuthFile(workspace, '{}');

    expect(authPath.startsWith(os.tmpdir())).toBe(true);
    await workspace.cleanup();
  });
});

describe('createTemporaryWorkspace', () => {
  test('creates an owned directory and cleanup is idempotent', async () => {
    const workspace = await createTemporaryWorkspace();
    const authPath = await writeAuthFile(workspace, '{}');
    const projectPath = await createProjectFile(workspace, {
      projectRootPath: '/repository',
      scriptId: 'script-id'
    });

    expect(path.isAbsolute(workspace.directory)).toBe(true);
    expect(path.dirname(authPath)).toBe(path.dirname(projectPath));
    expect(path.dirname(authPath)).toBe(workspace.directory);
    await expect(stat(workspace.directory)).resolves.toBeDefined();
    await workspace.cleanup();
    await workspace.cleanup();
    await expect(stat(workspace.directory)).rejects.toThrow();
  });
});

describe('createProjectFile', () => {
  test('writes an absolute project root based on sourceRootDir', async () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );
    const workspace = await createTemporaryWorkspace();

    const projectPath = await createProjectFile(workspace, {
      projectRootPath,
      scriptId: 'script-id',
      sourceRootDir: 'src'
    });
    const project = JSON.parse(await readFile(projectPath, 'utf8')) as Record<
      string,
      unknown
    >;

    expect(project).toEqual({
      scriptId: 'script-id',
      rootDir: path.resolve(projectRootPath, 'src')
    });
    expect(path.isAbsolute(project.rootDir as string)).toBe(true);
  });

  test('uses the absolute project root when sourceRootDir is omitted', async () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );
    const workspace = await createTemporaryWorkspace();

    const projectPath = await createProjectFile(workspace, {
      projectRootPath,
      scriptId: 'script-id'
    });
    const project = JSON.parse(await readFile(projectPath, 'utf8')) as Record<
      string,
      unknown
    >;

    expect(project.rootDir).toBe(path.resolve(projectRootPath));
  });

  test('overwrites template fields and removes srcDir', async () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );
    const templatePath = path.join(
      process.env.RUNNER_TEMP as string,
      'template.json'
    );
    await writeFile(
      templatePath,
      JSON.stringify({
        scriptId: 'old-script-id',
        rootDir: 'old-root',
        srcDir: 'relative-src',
        fileExtension: 'ts'
      })
    );
    const workspace = await createTemporaryWorkspace();

    const projectPath = await createProjectFile(workspace, {
      projectRootPath,
      scriptId: 'script-id',
      sourceRootDir: 'src',
      claspJsonTemplatePath: templatePath
    });
    const project = JSON.parse(await readFile(projectPath, 'utf8')) as Record<
      string,
      unknown
    >;

    expect(project).toEqual({
      scriptId: 'script-id',
      rootDir: path.resolve(projectRootPath, 'src'),
      fileExtension: 'ts'
    });
    expect('srcDir' in project).toBe(false);
  });

  test('includes the template path when JSON parsing fails', async () => {
    const templatePath = path.join(
      process.env.RUNNER_TEMP as string,
      'invalid-template.json'
    );
    await writeFile(templatePath, '{invalid');

    const workspace = await createTemporaryWorkspace();
    await expect(
      createProjectFile(workspace, {
        projectRootPath: '/repository',
        scriptId: 'script-id',
        claspJsonTemplatePath: templatePath
      })
    ).rejects.toThrow(templatePath);
  });

  test.each(['null', '[1,2]', '"x"'])(
    'rejects a non-object template %s with its path',
    async templateContents => {
      const templatePath = path.join(
        process.env.RUNNER_TEMP as string,
        `invalid-${templateContents.length}.json`
      );
      await writeFile(templatePath, templateContents);
      const workspace = await createTemporaryWorkspace();

      await expect(
        createProjectFile(workspace, {
          projectRootPath: '/repository',
          scriptId: 'script-id',
          claspJsonTemplatePath: templatePath
        })
      ).rejects.toThrow(templatePath);
    }
  );
});

test('resolves a relative RUNNER_TEMP before creating workspace files', async () => {
  const relativeRunnerTemp = 'relative-workspace-temp';
  const absoluteRunnerTemp = path.resolve(relativeRunnerTemp);
  temporaryDirectories.push(absoluteRunnerTemp);
  process.env.RUNNER_TEMP = relativeRunnerTemp;

  const workspace = await createTemporaryWorkspace();
  const authPath = await writeAuthFile(workspace, '{}');

  expect(path.isAbsolute(workspace.directory)).toBe(true);
  expect(path.isAbsolute(authPath)).toBe(true);
});

describe('resolveClaspIgnore', () => {
  test('returns the absolute path when .claspignore exists', async () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );
    const ignorePath = path.join(projectRootPath, '.claspignore');
    await mkdir(projectRootPath, { recursive: true });
    await writeFile(ignorePath, 'node_modules');

    expect(resolveClaspIgnore(projectRootPath)).toBe(path.resolve(ignorePath));
  });

  test('returns undefined when .claspignore does not exist', () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );

    expect(resolveClaspIgnore(projectRootPath)).toBeUndefined();
  });
});

describe('copyAppsScriptJson', () => {
  test('copies appsscript.json below sourceRootDir', async () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );
    const sourcePath = path.join(
      process.env.RUNNER_TEMP as string,
      'appsscript-source.json'
    );
    await writeFile(sourcePath, '{"timeZone":"Asia/Tokyo"}');

    const destination = await copyAppsScriptJson({
      projectRootPath,
      sourceRootDir: 'src',
      appsscriptJsonPath: sourcePath
    });

    expect(destination).toBe(
      path.resolve(projectRootPath, 'src', 'appsscript.json')
    );
    await expect(readFile(destination, 'utf8')).resolves.toBe(
      '{"timeZone":"Asia/Tokyo"}'
    );
  });

  test('copies appsscript.json at the project root when sourceRootDir is omitted', async () => {
    const projectRootPath = path.join(
      process.env.RUNNER_TEMP as string,
      'repository'
    );
    const sourcePath = path.join(
      process.env.RUNNER_TEMP as string,
      'appsscript-source.json'
    );
    await writeFile(sourcePath, '{}');

    const destination = await copyAppsScriptJson({
      projectRootPath,
      appsscriptJsonPath: sourcePath
    });

    expect(destination).toBe(path.resolve(projectRootPath, 'appsscript.json'));
    await expect(readFile(destination, 'utf8')).resolves.toBe('{}');
  });
});
