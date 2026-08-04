import { describe, expect, test } from '@jest/globals';

import {
  decodeDeploymentResult,
  decodePushResult,
  decodeVersionResult
} from '../src/clasp/schema';

describe('decodePushResult', () => {
  test('decodes changed file paths', () => {
    const stdout = '["src/Code.js","appsscript.json"]';

    expect(decodePushResult(stdout)).toEqual([
      'src/Code.js',
      'appsscript.json'
    ]);
  });

  test('decodes an empty array when nothing changed', () => {
    expect(decodePushResult('[]')).toEqual([]);
  });

  test('includes invalid JSON stdout in its error', () => {
    const stdout = '{not-json';

    expect(() => decodePushResult(stdout)).toThrow(stdout);
  });

  test('includes stdout with the wrong result type in its error', () => {
    const stdout = '[1]';

    expect(() => decodePushResult(stdout)).toThrow(stdout);
  });
});

describe('decodeVersionResult', () => {
  test('decodes a version number', () => {
    expect(decodeVersionResult('{"versionNumber":5}')).toEqual({
      versionNumber: 5
    });
  });

  test('includes invalid JSON stdout in its error', () => {
    const stdout = '{not-json';

    expect(() => decodeVersionResult(stdout)).toThrow(stdout);
  });

  test('includes stdout with the wrong result type in its error', () => {
    const stdout = '{"versionNumber":"5"}';

    expect(() => decodeVersionResult(stdout)).toThrow(stdout);
  });
});

describe('decodeDeploymentResult', () => {
  test('decodes deployment details', () => {
    const stdout =
      '{"deploymentId":"deployment-id","versionNumber":5,"description":"release"}';

    expect(decodeDeploymentResult(stdout)).toEqual({
      deploymentId: 'deployment-id',
      versionNumber: 5,
      description: 'release'
    });
  });

  test('decodes deployment details without optional fields', () => {
    const result = decodeDeploymentResult('{"deploymentId":"deployment-id"}');

    expect(result).toEqual({ deploymentId: 'deployment-id' });
    expect(result.versionNumber).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  test('rejects a non-number optional versionNumber', () => {
    const stdout = '{"deploymentId":"id","versionNumber":"5"}';

    expect(() => decodeDeploymentResult(stdout)).toThrow(stdout);
  });

  test('rejects a non-string optional description', () => {
    const stdout = '{"deploymentId":"id","description":5}';

    expect(() => decodeDeploymentResult(stdout)).toThrow(stdout);
  });

  test('includes invalid JSON stdout in its error', () => {
    const stdout = '{not-json';

    expect(() => decodeDeploymentResult(stdout)).toThrow(stdout);
  });

  test('includes stdout with the wrong result type in its error', () => {
    const stdout = '{"deploymentId":5}';

    expect(() => decodeDeploymentResult(stdout)).toThrow(stdout);
  });

  test('rejects a JSON array', () => {
    const stdout = '[]';

    expect(() => decodeDeploymentResult(stdout)).toThrow(stdout);
  });
});
