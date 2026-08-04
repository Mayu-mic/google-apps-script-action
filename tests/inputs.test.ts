import { describe, expect, test } from '@jest/globals';

import {
  parseDeployInputs,
  parsePushInputs,
  parseVersionInputs
} from '../src/inputs';

describe('parsePushInputs', () => {
  test('throws when clasprc is empty', () => {
    const get = (name: string): string =>
      ({ clasprc: '', scriptId: 'script-id' }[name] ?? '');

    expect(() => parsePushInputs(get)).toThrow('clasprc');
  });

  test('throws when scriptId is empty', () => {
    const get = (name: string): string =>
      ({ clasprc: 'clasprc', scriptId: '' }[name] ?? '');

    expect(() => parsePushInputs(get)).toThrow('scriptId');
  });

  test('converts empty optional inputs to undefined', () => {
    const get = (name: string): string =>
      ({
        clasprc: 'clasprc',
        scriptId: 'script-id',
        projectRootPath: '',
        sourceRootDir: '',
        appsscriptJsonPath: '',
        claspJsonTemplatePath: ''
      }[name] ?? '');

    const inputs = parsePushInputs(get);

    expect(inputs).toEqual({
      clasprc: 'clasprc',
      scriptId: 'script-id'
    });
    expect(Object.keys(inputs)).toEqual([
      'clasprc',
      'scriptId',
      'projectRootPath',
      'sourceRootDir',
      'appsscriptJsonPath',
      'claspJsonTemplatePath'
    ]);
    expect(inputs.projectRootPath).toBeUndefined();
    expect(inputs.sourceRootDir).toBeUndefined();
    expect(inputs.appsscriptJsonPath).toBeUndefined();
    expect(inputs.claspJsonTemplatePath).toBeUndefined();
  });

  test('preserves non-empty optional inputs', () => {
    const get = (name: string): string =>
      ({
        clasprc: 'clasprc',
        scriptId: 'script-id',
        projectRootPath: '/project',
        sourceRootDir: 'src',
        appsscriptJsonPath: 'appsscript.json',
        claspJsonTemplatePath: 'clasp.template.json'
      }[name] ?? '');

    expect(parsePushInputs(get)).toMatchObject({
      projectRootPath: '/project',
      sourceRootDir: 'src',
      appsscriptJsonPath: 'appsscript.json',
      claspJsonTemplatePath: 'clasp.template.json'
    });
  });

  test('does not include deploy-specific inputs', () => {
    const get = (name: string): string =>
      ({
        clasprc: 'clasprc',
        scriptId: 'script-id',
        deploymentId: 'deployment-id',
        versionNumber: '5',
        description: 'description'
      }[name] ?? '');

    const inputs = parsePushInputs(get);

    expect(Object.keys(inputs)).toEqual([
      'clasprc',
      'scriptId',
      'projectRootPath',
      'sourceRootDir',
      'appsscriptJsonPath',
      'claspJsonTemplatePath'
    ]);
    expect('deploymentId' in inputs).toBe(false);
    expect('versionNumber' in inputs).toBe(false);
    expect('description' in inputs).toBe(false);
  });
});

describe('parseDeployInputs', () => {
  test('converts an empty versionNumber to undefined', () => {
    const get = (name: string): string =>
      ({ clasprc: 'clasprc', scriptId: 'script-id', versionNumber: '' }[name] ??
      '');

    expect(parseDeployInputs(get).versionNumber).toBeUndefined();
  });

  test('converts a numeric versionNumber to a number', () => {
    const get = (name: string): string =>
      ({ clasprc: 'clasprc', scriptId: 'script-id', versionNumber: '5' }[
        name
      ] ?? '');

    expect(parseDeployInputs(get).versionNumber).toBe(5);
  });

  test('throws when versionNumber is not numeric', () => {
    const get = (name: string): string =>
      ({ clasprc: 'clasprc', scriptId: 'script-id', versionNumber: 'abc' }[
        name
      ] ?? '');

    expect(() => parseDeployInputs(get)).toThrow('versionNumber');
  });

  test('preserves non-empty deployment optional inputs', () => {
    const get = (name: string): string =>
      ({
        clasprc: 'clasprc',
        scriptId: 'script-id',
        deploymentId: 'deployment-id',
        versionNumber: '5',
        description: 'release'
      }[name] ?? '');

    expect(parseDeployInputs(get)).toMatchObject({
      deploymentId: 'deployment-id',
      versionNumber: 5,
      description: 'release'
    });
  });

  test('accepts surrounding whitespace around a decimal integer', () => {
    const get = (name: string): string =>
      ({ clasprc: 'clasprc', scriptId: 'script-id', versionNumber: ' 5 ' }[
        name
      ] ?? '');

    expect(parseDeployInputs(get).versionNumber).toBe(5);
  });

  test.each(['1.5', '-5', '0', '0x10', '1e3', 'Infinity', 'abc'])(
    'throws for invalid versionNumber %s',
    versionNumber => {
      const get = (name: string): string =>
        ({ clasprc: 'clasprc', scriptId: 'script-id', versionNumber }[name] ??
        '');

      expect(() => parseDeployInputs(get)).toThrow('versionNumber');
    }
  );
});

describe('parseVersionInputs', () => {
  test('converts an empty description to undefined', () => {
    const get = (name: string): string =>
      ({ clasprc: 'clasprc', scriptId: 'script-id', description: '' }[name] ??
      '');

    expect(parseVersionInputs(get).description).toBeUndefined();
  });
});
