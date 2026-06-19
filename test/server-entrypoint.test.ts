import assert from "node:assert/strict";

import { createServerConnection, startServer } from "../src/server";

export function runServerEntrypointTest(): void {
  assert.equal(typeof startServer, "function");

  const connection = createServerConnection();
  assert.equal(typeof connection.listen, "function");
  connection.dispose();
}
