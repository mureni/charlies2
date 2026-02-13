const path = require('path');
const graph = require('../.review/audit-graph.json');

const inbound = new Map(graph.files.map((f) => [f.path, 0]));

const resolveAlias = (fromFile, mod) => {
  if (mod.startsWith('@/')) {
    const candidate = `src/${mod.slice(2)}.ts`;
    return inbound.has(candidate) ? candidate : null;
  }
  if (mod.startsWith('./') || mod.startsWith('../')) {
    const abs = path.resolve(process.cwd(), fromFile, '..', mod);
    const withTs = abs.endsWith('.ts') ? abs : `${abs}.ts`;
    const rel = path.relative(process.cwd(), withTs).replace(/\\/g, '/');
    return inbound.has(rel) ? rel : null;
  }
  return null;
};

for (const imp of graph.imports) {
  const target = resolveAlias(imp.file, imp.module);
  if (!target) continue;
  inbound.set(target, inbound.get(target) + 1);
}

const zeros = [...inbound.entries()]
  .filter(([, count]) => count === 0)
  .map(([file]) => file)
  .sort();

console.log(zeros.join('\n'));
