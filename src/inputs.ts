type InputGetter = (name: string) => string;

export interface PushInputs {
  clasprc: string;
  scriptId: string;
  projectRootPath?: string;
  sourceRootDir?: string;
  appsscriptJsonPath?: string;
  claspJsonTemplatePath?: string;
}

export interface DeployInputs extends PushInputs {
  deploymentId?: string;
  versionNumber?: number;
  description?: string;
}

export interface VersionInputs extends PushInputs {
  description?: string;
}

function getRequiredInput(get: InputGetter, name: string): string {
  const value = get(name);
  if (value === '') {
    throw new Error(`Required input "${name}" must not be empty.`);
  }
  return value;
}

function getOptionalInput(get: InputGetter, name: string): string | undefined {
  const value = get(name);
  return value === '' ? undefined : value;
}

function getOptionalVersionNumber(get: InputGetter): number | undefined {
  const value = get('versionNumber');
  if (value === '') {
    return undefined;
  }

  const normalizedValue = value.trim();
  const versionNumber = Number(normalizedValue);
  if (
    !/^\d+$/.test(normalizedValue) ||
    !Number.isInteger(versionNumber) ||
    versionNumber < 1
  ) {
    throw new Error(
      'Input "versionNumber" must be a positive decimal integer.'
    );
  }
  return versionNumber;
}

function parseCommonInputs(get: InputGetter): PushInputs {
  return {
    clasprc: getRequiredInput(get, 'clasprc'),
    scriptId: getRequiredInput(get, 'scriptId'),
    projectRootPath: getOptionalInput(get, 'projectRootPath'),
    sourceRootDir: getOptionalInput(get, 'sourceRootDir'),
    appsscriptJsonPath: getOptionalInput(get, 'appsscriptJsonPath'),
    claspJsonTemplatePath: getOptionalInput(get, 'claspJsonTemplatePath')
  };
}

export function parsePushInputs(get: InputGetter): PushInputs {
  return parseCommonInputs(get);
}

export function parseDeployInputs(get: InputGetter): DeployInputs {
  return {
    ...parseCommonInputs(get),
    deploymentId: getOptionalInput(get, 'deploymentId'),
    versionNumber: getOptionalVersionNumber(get),
    description: getOptionalInput(get, 'description')
  };
}

export function parseVersionInputs(get: InputGetter): VersionInputs {
  return {
    ...parseCommonInputs(get),
    description: getOptionalInput(get, 'description')
  };
}
