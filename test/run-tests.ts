import { runBootstrapTest } from "./bootstrap.test";
import { runCliContractTest } from "./cli-contract.test";
import { runCocConfigTest } from "./coc-config.test";
import { runCompletionTest } from "./completion.test";
import { runDefinitionReferencesTest } from "./definition-references.test";
import { runMacroDefinitionReferencesIntegrationTest } from "./macro-definition-references.test";
import { runDiagnosticsTest } from "./diagnostics.test";
import { runDocumentModelTest } from "./document-model.test";
import { runDocumentSymbolTest } from "./document-symbol.test";
import { runExpressionTest } from "./expression.test";
import { runFixtureCorpusTest } from "./fixture-corpus.test";
import { runHoverTest } from "./hover.test";
import { runLexerTest } from "./lexer.test";
import { runLineParserTest } from "./line-parser.test";
import { runMacroParserTest } from "./macro-parser.test";
import { runMacroIndexTest } from "./macro-index.test";
import { runMacroDiagnosticsTest } from "./macro-diagnostics.test";
import { runMacroSubstitutionTest } from "./macro-substitution.test";
import { runExpansionTest } from "./expansion.test";
import { runMacroReferencesTest } from "./macro-references.test";
import { runLocalLabelScopeTest } from "./local-labels.test";
import { runMetadataTableTest } from "./metadata.test";
import { runPublishDiagnosticsTest } from "./publish-diagnostics.test";
import { runInitializeHandshakeTest } from "./server-initialize.test";
import { runServerEntrypointTest } from "./server-entrypoint.test";
import { runSymbolsTest } from "./symbols.test";
import { runSyntaxShapeTest } from "./syntax-shape.test";
import { runWorkspaceGraphTest } from "./workspace.test";
import { runWorkspaceSymbolTest } from "./workspace-symbol.test";
import { runSemanticTokensTest } from "./semantic-tokens.test";
import { runFormattingTest } from "./formatting.test";
import { runRenameTest } from "./rename.test";
import { runFoldingTest } from "./folding.test";
import { runDocumentLinksTest } from "./document-links.test";
import { runDocumentHighlightsTest } from "./document-highlights.test";
import { runInlayHintsTest } from "./inlay-hints.test";
import { runSignatureHelpTest } from "./signature-help.test";
import { runCallHierarchyTest } from "./call-hierarchy.test";
import { runCodeActionsTest } from "./code-actions.test";
import { runCodeLensTest } from "./code-lens.test";
import { runSelectionRangeTest } from "./selection-range.test";
import { runWatchedFilesTest } from "./watched-files.test";

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
    name: "cli contract exposes a packaged stdio entrypoint",
    run: runCliContractTest
  },
  {
    name: "coc.nvim example targets the packaged stdio CLI contract",
    run: runCocConfigTest
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
    name: "parser recognizes macro definition regions and parameter placeholders",
    run: runMacroParserTest
  },
  {
    name: "macro index collects macro definitions for documents and workspaces",
    run: runMacroIndexTest
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
  },
  {
    name: "diagnostics report duplicates unresolved refs malformed lines and unsupported 65816 syntax",
    run: runDiagnosticsTest
  },
  {
    name: "macro diagnostics report stable messages and ranges",
    run: runMacroDiagnosticsTest
  },
  {
    name: "macro substitution maps call arguments onto parameter placeholders",
    run: runMacroSubstitutionTest
  },
  {
    name: "expansion layer produces virtual expanded macro body",
    run: runExpansionTest
  },
  {
    name: "macro-expanded references are attributed to call-site argument symbols",
    run: runMacroReferencesTest
  },
  {
    name: "server returns document symbols for Merlin labels equates and data definitions",
    run: runDocumentSymbolTest
  },
  {
    name: "server returns workspace symbols across open Merlin documents",
    run: runWorkspaceSymbolTest
  },
  {
    name: "server resolves definitions and references for Merlin symbols",
    run: runDefinitionReferencesTest
  },
  {
    name: "macro-aware definitions and references resolve at call-site symbols",
    run: runMacroDefinitionReferencesIntegrationTest
  },
  {
    name: "server returns hover information for opcodes directives and symbols",
    run: runHoverTest
  },
  {
    name: "server returns opcode directive and symbol completions",
    run: runCompletionTest
  },
  {
    name: "server publishes and clears diagnostics for open Merlin documents",
    run: runPublishDiagnosticsTest
  },
  {
    name: "server returns semantic tokens for highlighting",
    run: runSemanticTokensTest
  },
  {
    name: "server formats assembly code aligning fields",
    run: runFormattingTest
  },
  {
    name: "server builds workspace edits for symbol renames",
    run: runRenameTest
  },
  {
    name: "server computes folding ranges for comments, macros, and data",
    run: runFoldingTest
  },
  {
    name: "server resolves document links for include directives",
    run: runDocumentLinksTest
  },
  {
    name: "server computes document highlights for symbols",
    run: runDocumentHighlightsTest
  },
  {
    name: "server computes inlay hints for equates",
    run: runInlayHintsTest
  },
  {
    name: "server provides signature help for macros",
    run: runSignatureHelpTest
  },
  {
    name: "server computes call hierarchy",
    run: runCallHierarchyTest
  },
  {
    name: "server provides code actions for quick fixes",
    run: runCodeActionsTest
  },
  {
    name: "server computes code lenses for reference counts",
    run: runCodeLensTest
  },
  {
    name: "server provides smart selection ranges",
    run: runSelectionRangeTest
  },
  {
    name: "server handles watched files changes",
    run: runWatchedFilesTest
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
