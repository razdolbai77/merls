import { runBootstrapTest } from "./bootstrap.test";
import { runCliContractTest } from "./cli-contract.test";
import { runCocConfigTest } from "./coc-config.test";
import { runCompletionTest } from "./completion.test";
import { runDefinitionReferencesTest } from "./definition-references.test";
import { runMacroDefinitionReferencesIntegrationTest } from "./macro-definition-references.test";
import { runDiskCacheMergeTest } from "./disk-cache-merge.test";
import { runDiagnosticsTest } from "./diagnostics.test";
import { runDiagnosticsPublishTest } from "./diagnostics-publish.test";
import { runDiskCacheEvictionTest } from "./disk-cache-eviction.test";
import { runCompletionSuppressionTest } from "./completion-suppression.test";
import { runUriToFilePathTest } from "./uri.test";
import { runIsLocalLabelTest } from "./is-local-label.test";
import { runUniqueLocationsTest } from "./unique-locations.test";
import { runMacroParameterPatternTest } from "./macro-parameter-pattern.test";
import { runLspDiagnosticsTest } from "./lsp-diagnostics.test";
import { runDocumentModelTest } from "./document-model.test";
import { runDocumentSymbolTest } from "./document-symbol.test";
import { runExpressionTest } from "./expression.test";
import { runFixtureCorpusTest } from "./fixture-corpus.test";
import { runHoverTest } from "./hover.test";
import { runLexerTest } from "./lexer.test";
import { runLineParserTest } from "./line-parser.test";
import { runMacroParserTest } from "./macro-parser.test";
import { runMacroSeparatorTest } from "./macro-separators.test";
import { runMacroIndexTest } from "./macro-index.test";
import { runMacroDiagnosticsTest } from "./macro-diagnostics.test";
import { runPublishDiagnosticsTest } from "./publish-diagnostics.test";
import { runExpansionTest } from "./expansion.test";
import { runMacroReferencesTest } from "./macro-references.test";
import { runLocalLabelScopeTest } from "./local-labels.test";
import { runMetadataTableTest } from "./metadata.test";
import {
  runWorkspaceGraphTest,
  runWorkspaceCaseInsensitiveLookupTest,
  runMacroFolderUseTest,
  runIncludeTargetTest,
  runUntitledWorkspaceTest
} from "./workspace.test";
import { runJsonRpcClientTest } from "./json-rpc-client.test";
import { runInitializeHandshakeTest } from "./server-initialize.test";
import { runServerEntrypointTest } from "./server-entrypoint.test";
import { runSymbolsTest } from "./symbols.test";
import { runVariableTest } from "./variables.test";
import { runSyntaxShapeTest } from "./syntax-shape.test";
import {
  runMacroFolderWorkspaceSymbolTest,
  runWorkspaceSymbolTest
} from "./workspace-symbol.test";
import { runSemanticTokensTest } from "./semantic-tokens.test";
import { runFormattingTest } from "./formatting.test";
import { runRenameTest } from "./rename.test";
import { runFoldingTest } from "./folding.test";
import { runDocumentLinksTest } from "./document-links.test";
import { runDocumentHighlightsTest } from "./document-highlights.test";
import { runInlayHintsTest } from "./inlay-hints.test";
import { runSignatureHelpTest } from "./signature-help.test";
import { runMacroSignatureTest } from "./macro-signature.test";
import { runCallHierarchyTest } from "./call-hierarchy.test";
import { runCodeLensTest } from "./code-lens.test";
import { runSelectionRangeTest, runSelectionRangeBoundsTest } from "./selection-range.test";
import { runWatchedFilesTest } from "./watched-files.test";
import { runPerformanceTest } from "./performance.test";
import { runPositionsTest } from "./positions.test";

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
    name: "untitled documents do not resolve disk include paths",
    run: runUntitledWorkspaceTest
  },
  {
    name: "shared text-position helpers locate first last and offset matches",
    run: runPositionsTest
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
    name: "lexer distinguishes macro argument separators from comments",
    run: runMacroSeparatorTest
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
    name: "Merlin variables are reassignable symbols",
    run: runVariableTest
  },
  {
    name: "workspace indexing follows Merlin include directives and merges symbols",
    run: runWorkspaceGraphTest
  },
  {
    name: "workspace indexing resolves include lookups case-insensitively on win32",
    run: runWorkspaceCaseInsensitiveLookupTest
  },
  {
    name: "workspace resolves USE through configured macro folder",
    run: runMacroFolderUseTest
  },
  {
    name: "include targets parse paths with optional ranges",
    run: runIncludeTargetTest
  },
  {
    name: "diagnostics report duplicates unresolved refs malformed lines and unknown syntax",
    run: runDiagnosticsTest
  },
  {
    name: "LSP diagnostics deduplicate URI aliases for one file",
    run: runLspDiagnosticsTest
  },
  {
    name: "macro diagnostics report stable messages and ranges",
    run: runMacroDiagnosticsTest
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
    name: "server resolves USE through configured macro folder",
    run: runMacroFolderWorkspaceSymbolTest
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
    name: "uri to file path helpers normalize win32 case consistently",
    run: runUriToFilePathTest
  },
  {
    name: "isLocalLabel identifies Merlin local label prefixes",
    run: runIsLocalLabelTest
  },
  {
    name: "macro parameter pattern matches positional placeholders",
    run: runMacroParameterPatternTest
  },
  {
    name: "uniqueLocations keeps first occurrence of each location",
    run: runUniqueLocationsTest
  },
  {
    name: "server returns opcode directive and symbol completions",
    run: runCompletionTest
  },
  {
    name: "completion suppresses results at the comment and string boundaries",
    run: runCompletionSuppressionTest
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
    name: "macro signature renderer shares positional parameter labels",
    run: runMacroSignatureTest
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
    name: "server computes code lenses for reference counts",
    run: runCodeLensTest
  },
  {
    name: "server provides smart selection ranges",
    run: runSelectionRangeTest
  },
  {
    name: "selection ranges survive out-of-bounds positions",
    run: runSelectionRangeBoundsTest
  },
  {
    name: "server handles watched files changes",
    run: runWatchedFilesTest
  },
  {
    name: "disk cache merge keeps unsaved buffers and avoids case duplicates",
    run: runDiskCacheMergeTest
  },
  {
    name: "disk cache evicts paths unreachable from open documents",
    run: runDiskCacheEvictionTest
  },
  {
    name: "sendDiagnostics rejections are handled without unhandled rejection events",
    run: runDiagnosticsPublishTest
  },
  {
    name: "JSON-RPC test client rejects timed out and failed requests",
    run: runJsonRpcClientTest
  },
  {
    name: "parser and diagnostic layer processes large macro-heavy files responsively",
    run: runPerformanceTest
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
