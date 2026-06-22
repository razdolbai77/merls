import * as path from 'path';

export interface BuildCompileCommandOptions {
  assemblerPath: string;
  extraArgs: readonly string[];
  macroFolderPath: string;
  sourcePath: string;
  isWindows: boolean;
}

function quoteWindowsArg(value: string): string {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/gu, '""')}"`;
}

function quotePosixArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  if (!/[\s'"\\$`!]/u.test(value)) {
    return value;
  }

  return `'${value.replace(/'/gu, `'"'"'`)}'`;
}

function quoteArg(value: string, isWindows: boolean): string {
  return isWindows ? quoteWindowsArg(value) : quotePosixArg(value);
}

export function buildCompileCommand({
  assemblerPath,
  extraArgs,
  macroFolderPath,
  sourcePath,
  isWindows
}: BuildCompileCommandOptions): string {
  const args = [assemblerPath, ...extraArgs, macroFolderPath, sourcePath];
  return args.map(arg => quoteArg(arg, isWindows)).join(' ');
}

export function getCompileWorkingDirectory(
  sourcePath: string,
  workspacePath?: string
): string {
  return workspacePath ?? path.dirname(sourcePath);
}

export function getMacroFolderPath(
  sourcePath: string,
  configuredMacroFolderPath?: string
): string {
  return configuredMacroFolderPath ?? path.dirname(sourcePath);
}

export function getProjectEntryFilePath(
  workspacePath: string,
  configuredEntryFilePath: string
): string {
  if (path.isAbsolute(configuredEntryFilePath)) {
    return configuredEntryFilePath;
  }

  return path.resolve(workspacePath, configuredEntryFilePath);
}
