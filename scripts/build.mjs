#!/usr/bin/env node
/**
 * Bundles modular source into a single self-contained index.html.
 * Three.js remains the only external dependency (via import map CDN).
 * @module build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const STYLES = path.join(ROOT, 'styles', 'main.css');
const TEMPLATE = path.join(SRC, 'template.html');
const OUT = path.join(ROOT, 'index.html');

/** @type {Set<string>} */
const visited = new Set();

/**
 * Resolve a module path relative to importer.
 * @param {string} importerDir
 * @param {string} specifier
 * @returns {string|null}
 */
function resolveLocal(importerDir, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;
  let resolved = path.resolve(importerDir, specifier);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    resolved = path.join(resolved, 'index.js');
  }
  if (!resolved.endsWith('.js') && fs.existsSync(resolved + '.js')) {
    resolved += '.js';
  }
  return fs.existsSync(resolved) ? resolved : null;
}

/**
 * Strip import/export and collect external imports.
 * @param {string} code
 * @param {Set<string>} externals
 * @returns {string}
 */
function transformModule(code, externals) {
  const lines = code.split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^import\s+/.test(trimmed)) {
      const m = trimmed.match(/^import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/);
      if (m && !m[1].startsWith('.')) {
        externals.add(m[1]);
      }
      continue;
    }
    if (/^export\s+default\s+/.test(trimmed)) {
      out.push(line.replace(/^export\s+default\s+/, ''));
      continue;
    }
    if (/^export\s+\{/.test(trimmed) || /^export\s+(const|let|var|function|class)\s+/.test(trimmed)) {
      out.push(line.replace(/^export\s+/, ''));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Recursively bundle a module entry point.
 * @param {string} filePath
 * @param {Set<string>} externals
 * @returns {string}
 */
function bundleModule(filePath, externals) {
  const normalized = path.normalize(filePath);
  if (visited.has(normalized)) return '';
  visited.add(normalized);

  let code = fs.readFileSync(normalized, 'utf8');
  const dir = path.dirname(normalized);

  const importRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;
  let match;
  const localImports = [];
  while ((match = importRegex.exec(code)) !== null) {
    const spec = match[1];
    if (spec.startsWith('.')) {
      localImports.push({ spec, resolved: resolveLocal(dir, spec) });
    } else {
      externals.add(spec);
    }
  }

  let bundled = '';
  for (const imp of localImports) {
    if (imp.resolved) {
      bundled += bundleModule(imp.resolved, externals) + '\n';
    }
  }
  bundled += transformModule(code, externals) + '\n';
  return bundled;
}

function build() {
  visited.clear();
  const externals = new Set();
  const jsBundle = bundleModule(path.join(SRC, 'main.js'), externals);
  const css = fs.readFileSync(STYLES, 'utf8');
  let html = fs.readFileSync(TEMPLATE, 'utf8');

  const importMap = {
    imports: {
      three: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
      'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/',
    },
  };

  html = html
    .replace('<!-- STYLES -->', `<style>\n${css}\n</style>`)
    .replace('<!-- IMPORT_MAP -->', `<script type="importmap">\n${JSON.stringify(importMap, null, 2)}\n</script>`)
    .replace('<!-- APP_SCRIPT -->', `<script type="module">\n${jsBundle}\n</script>`);

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Built ${OUT} (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(`External imports: ${[...externals].join(', ')}`);
}

build();
