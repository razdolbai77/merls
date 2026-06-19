import assert from "node:assert/strict";

import { projectName } from "../src/index";

export function runBootstrapTest(): void {
  assert.equal(projectName, "merls");
}
