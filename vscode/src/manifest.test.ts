import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

interface ExtensionManifest {
  contributes?: {
    configurationDefaults?: Record<string, unknown>;
  };
}

type TaskDefinition = {
  label?: string;
  type?: string;
  command?: string;
  args?: readonly string[];
  script?: string;
  dependsOn?: readonly string[];
  dependsOrder?: string;
};

type TaskConfiguration = {
  tasks?: readonly TaskDefinition[];
};

type LaunchConfiguration = {
  configurations?: readonly {
    name?: string;
    preLaunchTask?: string;
  }[];
};

function readManifest(): ExtensionManifest {
  const manifestPath = path.resolve(__dirname, "..", "package.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as ExtensionManifest;
}

function readConfiguration<T>(fileName: string): T {
  const configurationPath = path.resolve(__dirname, "..", ".vscode", fileName);
  return JSON.parse(fs.readFileSync(configurationPath, "utf8")) as T;
}

function readExtensionSource(): string {
  const extensionPath = path.resolve(__dirname, "..", "src", "extension.ts");
  return fs.readFileSync(extensionPath, "utf8");
}

test("manifest enables 6502 quick suggestions and sets tab size to 8 by default", () => {
  const manifest = readManifest();
  const languageDefaults = manifest.contributes?.configurationDefaults?.["[6502]"];

  assert.deepEqual(languageDefaults, {
    "editor.indentSize": 8,
    "editor.tabSize": 8,
    "editor.quickSuggestions": true
  });
});

test("F5 builds the root language server before watching the extension", () => {
  const tasks = readConfiguration<TaskConfiguration>("tasks.json").tasks ?? [];
  const rootBuildTask = tasks.find((task) => task.label === "build language server");
  const extensionWatchTask = tasks.find((task) => task.label === "watch extension");
  const launch = readConfiguration<LaunchConfiguration>("launch.json");
  const extensionLaunch = launch.configurations?.find(
    (configuration) => configuration.name === "Run Extension"
  );

  assert.deepEqual(
    {
      label: rootBuildTask?.label,
      type: rootBuildTask?.type,
      command: rootBuildTask?.command,
      args: rootBuildTask?.args
    },
    {
      label: "build language server",
      type: "shell",
      command: "npm",
      args: ["--prefix", "${workspaceFolder}/..", "run", "build"]
    }
  );
  assert.deepEqual(extensionWatchTask?.dependsOn, ["build language server"]);
  assert.equal(extensionWatchTask?.dependsOrder, "sequence");
  assert.equal(extensionLaunch?.preLaunchTask, "watch extension");
});

test("F5 launches the language server without a Node inspector", () => {
  assert.doesNotMatch(readExtensionSource(), /--inspect=6009/);
});
