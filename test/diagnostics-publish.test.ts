import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { sendDiagnosticsSafely, type DiagnosticsSender } from "../src/server";

export async function runDiagnosticsPublishTest(): Promise<void> {
  const sent: unknown[] = [];
  const okSender: DiagnosticsSender = {
    sendDiagnostics(params) {
      sent.push(params);
      return Promise.resolve();
    }
  };
  const params = { uri: "file:///workspace/x.S", diagnostics: [] };

  sendDiagnosticsSafely(okSender, params);
  await delay(5);
  assert.deepEqual(sent, [params]);

  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onRejection);
  try {
    const failingSender: DiagnosticsSender = {
      sendDiagnostics() {
        return Promise.reject(new Error("connection disposed"));
      }
    };
    sendDiagnosticsSafely(failingSender, params);
    await delay(20);
    assert.equal(
      rejections.length,
      0,
      "sendDiagnostics rejections must be handled instead of leaking"
    );
  } finally {
    process.off("unhandledRejection", onRejection);
  }
}
