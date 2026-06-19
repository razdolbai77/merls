import { runBootstrapTest } from "./bootstrap.test";
import { runFixtureCorpusTest } from "./fixture-corpus.test";
import { runMetadataTableTest } from "./metadata.test";
import { runInitializeHandshakeTest } from "./server-initialize.test";
import { runServerEntrypointTest } from "./server-entrypoint.test";
import { runSyntaxShapeTest } from "./syntax-shape.test";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [
  {
    name: "workspace bootstrap exposes the project name",
    run: runBootstrapTest
  },
  {
    name: "server entrypoint exposes callable startup helpers",
    run: runServerEntrypointTest
  },
  {
    name: "server process answers initialize",
    run: runInitializeHandshakeTest
  },
  {
    name: "positive fixture corpus includes upstream Merlin32 samples",
    run: runFixtureCorpusTest
  },
  {
    name: "shared opcode and directive metadata covers 6502 and Merlin syntax",
    run: runMetadataTableTest
  },
  {
    name: "token kinds and line shapes cover Merlin syntax categories",
    run: runSyntaxShapeTest
  }
];

async function main(): Promise<void> {
  let failures = 0;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${test.name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main();
