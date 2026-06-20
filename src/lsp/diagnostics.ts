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
  openDocuments: ReadonlyMap<string, CachedDocument>
): Map<string, readonly LspDiagnostic[]> {
  const sourcesByFilePath = new Map<string, string>();
  const uriByFilePath = new Map<string, string>();
  const entries: DocumentEntry[] = [];

  for (const [uri, cached] of openDocuments.entries()) {
    const filePath = uriToFilePath(uri);
    sourcesByFilePath.set(filePath, cached.source);
    uriByFilePath.set(filePath, uri);
    entries.push({
      filePath,
      document: cached.parsed
    });
  }

  const diagnosticsByFilePath = new Map<string, LspDiagnostic[]>();
  for (const entry of entries) {
    diagnosticsByFilePath.set(entry.filePath, []);
  }

  for (const diagnostic of collectWorkspaceDiagnostics(entries)) {
    const source = sourcesByFilePath.get(diagnostic.filePath);
    const diagnostics = diagnosticsByFilePath.get(diagnostic.filePath);
    if (source === undefined || diagnostics === undefined) {
      continue;
    }

    diagnostics.push(toLspDiagnostic(source, diagnostic));
  }

  const diagnosticsByUri = new Map<string, readonly LspDiagnostic[]>();
  for (const [filePath, uri] of uriByFilePath.entries()) {
    diagnosticsByUri.set(uri, diagnosticsByFilePath.get(filePath) ?? []);
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
        character: 0
      },
      end: {
        line: diagnostic.line,
        character: lineText.length
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
