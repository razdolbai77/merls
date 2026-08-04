import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  buildCompileCommand,
  getCompileWorkingDirectory,
  getMacroFolderPath,
  getProjectEntryFilePath
} from './compile';

test('buildCompileCommand quotes Windows executable, args, and file path', () => {
  const command = buildCompileCommand({
    assemblerPath: 'C:\\Program Files\\Merlin32\\merlin32.exe',
    extraArgs: ['-V', 'OUT FILE'],
    macroFolderPath: 'C:\\Work Dir\\macros',
    sourcePath: 'C:\\Work Dir\\main file.S',
    isWindows: true
  });

  assert.equal(
    command,
    '"C:\\Program Files\\Merlin32\\merlin32.exe" -V "OUT FILE" "C:\\Work Dir\\macros" "C:\\Work Dir\\main file.S"'
  );
});

test('buildCompileCommand quotes POSIX paths with embedded single quotes', () => {
  const command = buildCompileCommand({
    assemblerPath: '/opt/merlin 32/bin/merlin32',
    extraArgs: ["--define=NAME=O'Brien"],
    macroFolderPath: "/tmp/O'Brien/macros dir",
    sourcePath: "/tmp/O'Brien/main file.S",
    isWindows: false
  });

  assert.equal(
    command,
    '\'/opt/merlin 32/bin/merlin32\' \'--define=NAME=O\'"\'"\'Brien\' \'/tmp/O\'"\'"\'Brien/macros dir\' \'/tmp/O\'"\'"\'Brien/main file.S\''
  );
});

test('buildCompileCommand quotes Windows args containing cmd metacharacters', () => {
  const command = buildCompileCommand({
    assemblerPath: 'C:\\tools\\merlin32.exe',
    extraArgs: [],
    macroFolderPath: 'C:\\data&macros',
    sourcePath: 'C:\\100%done^name\\main.S',
    isWindows: true
  });

  assert.equal(
    command,
    'C:\\tools\\merlin32.exe "C:\\data&macros" "C:\\100%done^name\\main.S"'
  );
});

test('buildCompileCommand quotes POSIX args containing shell metacharacters without spaces', () => {
  const command = buildCompileCommand({
    assemblerPath: '/opt/merlin32/bin/merlin32',
    extraArgs: [],
    macroFolderPath: '/tmp/foo;reboot',
    sourcePath: '/tmp/a&b|c<d>e(f)g*h?i[j]#k~l^m%n.S',
    isWindows: false
  });

  assert.equal(
    command,
    "/opt/merlin32/bin/merlin32 '/tmp/foo;reboot' '/tmp/a&b|c<d>e(f)g*h?i[j]#k~l^m%n.S'"
  );
});

test('getCompileWorkingDirectory prefers the workspace folder', () => {
  assert.equal(
    getCompileWorkingDirectory('C:\\Workspace\\src\\main.S', 'C:\\Workspace'),
    'C:\\Workspace'
  );
});

test('getCompileWorkingDirectory falls back to the file directory', () => {
  assert.equal(
    getCompileWorkingDirectory('C:\\Workspace\\src\\main.S'),
    'C:\\Workspace\\src'
  );
});

test('getMacroFolderPath prefers configured macro folder', () => {
  assert.equal(
    getMacroFolderPath('C:\\Workspace\\src\\main.S', 'C:\\Macros'),
    'C:\\Macros'
  );
});

test('getMacroFolderPath falls back to the file directory', () => {
  assert.equal(
    getMacroFolderPath('C:\\Workspace\\src\\main.S'),
    'C:\\Workspace\\src'
  );
});

test('getProjectEntryFilePath resolves configured relative path against workspace', () => {
  assert.equal(
    getProjectEntryFilePath('C:\\Workspace', 'build\\main.S'),
    'C:\\Workspace\\build\\main.S'
  );
});

test('getProjectEntryFilePath preserves configured absolute path', () => {
  assert.equal(
    getProjectEntryFilePath('C:\\Workspace', 'D:\\Projects\\game\\main.S'),
    'D:\\Projects\\game\\main.S'
  );
});
