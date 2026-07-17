import { fileURLToPath } from "node:url";

import {
  DiagnosticSeverity,
  type Diagnostic as LspDiagnostic
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import {
  collectWorkspaceDiagnostics,
  type Diagnostic as AsmDiagnostic,
  type DocumentEntry
} from "../asm/diagnostics";

export function collectDiagnosticsByUri(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  indexedDocuments: ReadonlyMap<string, CachedDocument>
): Map<string, readonly LspDiagnostic[]> {
  const entriesByFilePath = new Map<string, DocumentEntry>();
  const sourcesByFilePath = new Map<string, string>();
  const uriByFilePath = new Map<string, string>();
  const openEntries = new Set<string>();

  for (const [uri, cached] of indexedDocuments.entries()) {
    const filePath = uriToFilePath(uri);
    const isOpen = openDocuments.has(uri);

    if (!entriesByFilePath.has(filePath) || isOpen) {
      entriesByFilePath.set(filePath, { filePath, document: cached.parsed });
      sourcesByFilePath.set(filePath, cached.source);
      uriByFilePath.set(filePath, uri);
    }

    if (isOpen) {
      openEntries.add(filePath);
      uriByFilePath.set(filePath, uri);
    }
  }

  const entries = [...entriesByFilePath.values()];

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
  const filePath = uri.startsWith("file://") ? fileURLToPath(uri) : uri;
  return process.platform === "win32" ? filePath.toLowerCase() : filePath;
}
