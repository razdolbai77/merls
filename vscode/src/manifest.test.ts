import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

interface ExtensionManifest {
  contributes?: {
    configurationDefaults?: Record<string, unknown>;
  };
}

function readManifest(): ExtensionManifest {
  const manifestPath = path.resolve(__dirname, '..', 'package.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as ExtensionManifest;
}

test('manifest sets 6502 tab size to 8 by default', () => {
  const manifest = readManifest();
  const languageDefaults = manifest.contributes?.configurationDefaults?.['[6502]'];

  assert.deepEqual(languageDefaults, {
    'editor.indentSize': 8,
    'editor.tabSize': 8
  });
});
