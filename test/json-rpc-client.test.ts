import assert from "node:assert/strict";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";

export async function runJsonRpcClientTest(): Promise<void> {
  const timeoutClient = startJsonRpcClient(
    process.execPath,
    ["-e", "process.stdin.resume()"],
    { requestTimeoutMs: 20 }
  );

  try {
    await assert.rejects(
      timeoutClient.request("test/timeout", {}),
      /timed out/
    );
  } finally {
    timeoutClient.stop();
  }

  const missingClient = startJsonRpcClient(
    path.resolve(process.cwd(), "test/fixtures/missing-json-rpc-server"),
    []
  );

  try {
    await assert.rejects(
      missingClient.request("test/exit", {}),
      /closed|exited|failed/
    );
  } finally {
    missingClient.stop();
  }
}
