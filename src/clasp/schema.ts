export type PushResult = string[];
export type VersionResult = { versionNumber: number };
export type DeploymentResult = {
  deploymentId: string;
  versionNumber?: number;
  description?: string;
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown): item is string => typeof item === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidOutput(stdout: string): never {
  throw new Error(`Unexpected clasp JSON output: ${stdout}`);
}

function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return invalidOutput(stdout);
  }
}

export function decodePushResult(stdout: string): PushResult {
  const parsed = parseJson(stdout);

  if (!isStringArray(parsed)) {
    return invalidOutput(stdout);
  }
  return parsed;
}

export function decodeVersionResult(stdout: string): VersionResult {
  const parsed = parseJson(stdout);

  if (!isRecord(parsed) || typeof parsed.versionNumber !== 'number') {
    return invalidOutput(stdout);
  }
  return { versionNumber: parsed.versionNumber };
}

export function decodeDeploymentResult(stdout: string): DeploymentResult {
  const parsed = parseJson(stdout);

  if (!isRecord(parsed) || typeof parsed.deploymentId !== 'string') {
    return invalidOutput(stdout);
  }

  if ('versionNumber' in parsed && typeof parsed.versionNumber !== 'number') {
    return invalidOutput(stdout);
  }
  if ('description' in parsed && typeof parsed.description !== 'string') {
    return invalidOutput(stdout);
  }

  const result: DeploymentResult = {
    deploymentId: parsed.deploymentId
  };
  if (typeof parsed.versionNumber === 'number') {
    result.versionNumber = parsed.versionNumber;
  }
  if (typeof parsed.description === 'string') {
    result.description = parsed.description;
  }
  return result;
}
