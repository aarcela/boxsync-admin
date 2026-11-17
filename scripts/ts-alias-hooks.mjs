// Minimal resolve hook so `node --test` can load lib/*.ts directly (Node 24 strips types):
// maps `@/x` to the repo root and adds `.ts` to extensionless imports from .ts files.
import { statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function findTs(base) {
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(isFile) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  let target = null;
  if (specifier.startsWith('@/')) {
    target = findTs(path.join(root, specifier.slice(2)));
  } else if (/^\.\.?\//.test(specifier) && context.parentURL?.endsWith('.ts')) {
    target = findTs(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
  }
  return nextResolve(target ? pathToFileURL(target).href : specifier, context);
}
