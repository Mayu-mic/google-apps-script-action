import { getExecOutput } from '@actions/exec';

export interface RunOptions {
  cwd: string;
  extraEnv: Record<string, string>;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ClaspRunner {
  run(args: string[], options: RunOptions): Promise<RunResult>;
}

export class ExecClaspRunner implements ClaspRunner {
  private readonly claspBinPath: string;

  constructor(claspBinPath: string) {
    this.claspBinPath = claspBinPath;
  }

  async run(args: string[], options: RunOptions): Promise<RunResult> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    Object.assign(env, options.extraEnv);

    const result = await getExecOutput(
      process.execPath,
      [this.claspBinPath, ...args],
      {
        cwd: options.cwd,
        env,
        ignoreReturnCode: true
      }
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `clasp exited with code ${result.exitCode}: ${result.stderr}`
      );
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  }
}
