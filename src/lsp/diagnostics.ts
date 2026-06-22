import { fileURLToPath } from "node:url";

import {
  DiagnosticSeverity,
  type Diagnostic as LspDiagnostic
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { indexWorkspace } from "../asm/workspace";
import {
  collectWorkspaceDiagnostics,
  type Diagnostic as AsmDiagnostic,
  type DocumentEntry
} from "../asm/diagnostics";

export function collectDiagnosticsByUri(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  allDocuments: ReadonlyMap<string, CachedDocument>
): Map<string, readonly LspDiagnostic[]> {
  const sourcesByFilePath = new Map<string, string>();
  const uriByFilePath = new Map<string, string>();
  const openEntries = new Set<string>();
  const overrides = new Map<string, CachedDocument>();

  for (const [uri, cached] of allDocuments.entries()) {
    const filePath = uriToFilePath(uri);
    sourcesByFilePath.set(filePath, cached.source);
    uriByFilePath.set(filePath, uri);
    overrides.set(filePath, cached);

    if (openDocuments.has(uri)) {
      openEntries.add(filePath);
    }
  }

  const combinedDocuments = new Map<string, CachedDocument>();
  for (const filePath of openEntries) {
    const workspace = indexWorkspace(filePath, overrides);
    for (const [docPath, doc] of workspace.documents.entries()) {
      combinedDocuments.set(docPath, doc);
    }
  }

  const entries: DocumentEntry[] = [];
  for (const [filePath, document] of combinedDocuments.entries()) {
    entries.push({ filePath, document: document.parsed });
  }

  const diagnosticsByFilePath = new Map<string, LspDiagnostic[]>();
  for (const filePath of openEntries) {
    diagnosticsByFilePath.set(filePath, []);
  }

  for (const diagnostic of collectWorkspaceDiagnostics(entries)) {
    if (!openEntries.has(diagnostic.filePath)) {
      continue;
    }

    const source = sourcesByFilePath.get(diagnostic.filePath);
    const diagnostics = diagnosticsByFilePath.get(diagnostic.filePath);
    if (source === undefined || diagnostics === undefined) {
      continue;
    }

    diagnostics.push(toLspDiagnostic(source, diagnostic));
  }

  const diagnosticsByUri = new Map<string, readonly LspDiagnostic[]>();
  for (const filePath of openEntries) {
    const uri = uriByFilePath.get(filePath);
    if (uri !== undefined) {
      diagnosticsByUri.set(uri, diagnosticsByFilePath.get(filePath) ?? []);
    }
  }

  return diagnosticsByUri;
}

function toLspDiagnostic(source: string, diagnostic: AsmDiagnostic): LspDiagnostic {
  const lineText = source.split(/\r?\n/)[diagnostic.line] ?? "";

  return {
    severity: DiagnosticSeverity.Error,
    message: diagnostic.message,
    source: "merls",
    code: diagnostic.code,
    range: {
      start: {
        line: diagnostic.line,
        character: diagnostic.startCharacter ?? 0
      },
      end: {
        line: diagnostic.line,
        character: diagnostic.endCharacter ?? lineText.length
      }
    }
  };
}

function uriToFilePath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }

  return uri;
}
