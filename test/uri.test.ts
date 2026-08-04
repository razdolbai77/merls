import assert from "node:assert/strict";
import path from "node:path";

import { uriToFilePath } from "../src/lsp/uri";

export function runUriToFilePathTest(): void {
  const plain = uriToFilePath("untitled:Untitled-1");
  assert.equal(plain, "untitled:Untitled-1");

  if (process.platform === "win32") {
    const upper = uriToFilePath("file:///C:/workspace/main.S");
    const lower = uriToFilePath("file:///c:/workspace/main.S");
    assert.equal(upper, lower);
    assert.equal(upper, "c:\\workspace\\main.s");
    assert.equal(path.isAbsolute(upper), true);
  } else {
    const uri = uriToFilePath("file:///workspace/main.S");
    assert.equal(uri, "/workspace/main.S");
  }
}
