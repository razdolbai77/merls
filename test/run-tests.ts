import { runBootstrapTest } from "./bootstrap.test";
import { runDocumentModelTest } from "./document-model.test";
import { runExpressionTest } from "./expression.test";
import { runFixtureCorpusTest } from "./fixture-corpus.test";
import { runLexerTest } from "./lexer.test";
import { runLineParserTest } from "./line-parser.test";
import { runLocalLabelScopeTest } from "./local-labels.test";
import { runMetadataTableTest } from "./metadata.test";
import { runInitializeHandshakeTest } from "./server-initialize.test";
import { runServerEntrypointTest } from "./server-entrypoint.test";
import { runSymbolsTest } from "./symbols.test";
import { runSyntaxShapeTest } from "./syntax-shape.test";
import { runWorkspaceGraphTest } from "./workspace.test";

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
  },
  {
    name: "lexer tokenizes fixture comments labels mnemonics directives and literals",
    run: runLexerTest
  },
  {
    name: "expression parser handles numeric forms modifiers arithmetic and indexed operands",
    run: runExpressionTest
  },
  {
    name: "line parser recognizes equates instructions directives data and malformed lines",
    run: runLineParserTest
  },
  {
    name: "document model preserves line structure and tolerates malformed lines",
    run: runDocumentModelTest
  },
  {
    name: "symbol collection indexes labels equates and named data definitions",
    run: runSymbolsTest
  },
  {
    name: "local label scope resolves Merlin local definitions and references",
    run: runLocalLabelScopeTest
  },
  {
    name: "workspace indexing follows Merlin include directives and merges symbols",
    run: runWorkspaceGraphTest
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
