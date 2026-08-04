import { fileURLToPath } from "node:url";

export function uriToFilePath(uri: string): string {
  if (!uri.startsWith("file://")) {
    return uri;
  }

  const filePath = fileURLToPath(uri);
  return process.platform === "win32" ? filePath.toLowerCase() : filePath;
}
