import {
  decodeDeploymentResult,
  decodePushResult,
  decodeVersionResult,
  DeploymentResult
} from './schema';
import { ClaspRunner } from './runner';

export interface ClaspContext {
  runner: ClaspRunner;
  cwd: string;
  extraEnv: Record<string, string>;
}

interface DeploymentOptions {
  deploymentId?: string;
  description?: string;
  versionNumber?: number;
}

async function runCommand(
  ctx: ClaspContext,
  args: string[]
): Promise<{ stdout: string }> {
  return await ctx.runner.run(args, {
    cwd: ctx.cwd,
    extraEnv: ctx.extraEnv
  });
}

export async function push(ctx: ClaspContext): Promise<string[]> {
  const result = await runCommand(ctx, ['push', '-f', '--json']);
  return decodePushResult(result.stdout);
}

export async function createVersion(
  ctx: ClaspContext,
  description?: string
): Promise<number> {
  const args = ['create-version', '--json'];
  if (description !== undefined) {
    args.push(description);
  }
  const result = await runCommand(ctx, args);
  return decodeVersionResult(result.stdout).versionNumber;
}

export async function createDeployment(
  ctx: ClaspContext,
  options: DeploymentOptions
): Promise<DeploymentResult> {
  const args = ['create-deployment', '--json'];
  if (options.deploymentId !== undefined) {
    args.push('-i', options.deploymentId);
  }
  if (options.description !== undefined) {
    args.push('-d', options.description);
  }
  if (options.versionNumber !== undefined) {
    args.push('-V', String(options.versionNumber));
  }
  const result = await runCommand(ctx, args);
  return decodeDeploymentResult(result.stdout);
}
