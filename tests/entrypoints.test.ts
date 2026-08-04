import { describe, expect, jest, test } from '@jest/globals';

import { main as deployMain } from '../src/entrypoints/deploy';
import { main as pushMain } from '../src/entrypoints/push';
import { main as versionMain } from '../src/entrypoints/version';
import { runDeploy, runPush, runVersion } from '../src/run';

jest.mock('../src/run', () => ({
  runPush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  runDeploy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  runVersion: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}));

describe('entrypoints', () => {
  test('delegates push to the shared runner', async () => {
    await pushMain();
    expect(runPush).toHaveBeenCalled();
  });

  test('delegates deploy to the shared runner', async () => {
    await deployMain();
    expect(runDeploy).toHaveBeenCalled();
  });

  test('delegates version to the shared runner', async () => {
    await versionMain();
    expect(runVersion).toHaveBeenCalled();
  });
});
