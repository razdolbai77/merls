#!/usr/bin/env node

import { startServer } from "./server";

const usage = "Usage: merls --stdio";

export function runCli(argv: readonly string[]): number {
  if (argv.length === 1 && argv[0] === "--stdio") {
    startServer();
    return 0;
  }

  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    process.stdout.write(`${usage}\n`);
    return 0;
  }

  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { version } = require("../../package.json");
    process.stdout.write(`${version}\n`);
    return 0;
  }

  process.stderr.write(`${usage}\n`);
  return 1;
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}
