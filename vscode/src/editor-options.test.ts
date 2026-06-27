import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  applyPearlsEditorOptions,
  is6502Document
} from './editor-options';

test('is6502Document matches only the Pearls language id', () => {
  assert.equal(is6502Document({ languageId: '6502' } as { languageId: string } & never), true);
  assert.equal(is6502Document({ languageId: 'plaintext' } as { languageId: string } & never), false);
});

test('applyPearlsEditorOptions sets hard tabs with width 8 for 6502 editors', () => {
  const editor = {
    document: { languageId: '6502' },
    options: { insertSpaces: true, tabSize: 4 }
  };

  const changed = applyPearlsEditorOptions(editor as never);

  assert.equal(changed, true);
  assert.deepEqual(editor.options, { insertSpaces: true, tabSize: 8 });
});

test('applyPearlsEditorOptions skips non-6502 editors', () => {
  const editor = {
    document: { languageId: 'plaintext' },
    options: { insertSpaces: true, tabSize: 4 }
  };

  const changed = applyPearlsEditorOptions(editor as never);

  assert.equal(changed, false);
  assert.deepEqual(editor.options, { insertSpaces: true, tabSize: 4 });
});
