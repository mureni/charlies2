const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = process.cwd();
const srcRoot = path.join(root, "src");
const outDir = path.join(root, ".review");
const outJson = path.join(outDir, "audit-graph.json");
const outDot = path.join(outDir, "audit-graph.dot");

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile() && full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
};

const rel = (p) => path.relative(root, p).replace(/\\/g, "/");

const files = walkFiles(srcRoot);

const graph = {
  generatedAt: new Date().toISOString(),
  root: rel(root),
  files: [],
  imports: [],
  functions: [],
  variables: [],
  calls: [],
};

const fileIdFor = new Map();
files.forEach((file, i) => fileIdFor.set(file, `file:${i}`));

graph.files = files.map((file) => ({
  id: fileIdFor.get(file),
  path: rel(file),
}));

const textAt = (source, node) => source.text.slice(node.pos, node.end).trim();

const addImport = (file, moduleName, isTypeOnly) => {
  graph.imports.push({
    from: fileIdFor.get(file),
    file: rel(file),
    module: moduleName,
    typeOnly: Boolean(isTypeOnly),
  });
};

const addVariable = (file, name, kind, node, parentFunction) => {
  const source = node.getSourceFile();
  const lc = source.getLineAndCharacterOfPosition(node.getStart());
  graph.variables.push({
    id: `var:${rel(file)}:${name}:${node.pos}`,
    file: rel(file),
    name,
    kind,
    line: lc.line + 1,
    inFunction: parentFunction || null,
  });
};

const addFunction = (file, name, kind, node, parentFunction) => {
  const source = node.getSourceFile();
  const lc = source.getLineAndCharacterOfPosition(node.getStart());
  const id = `fn:${rel(file)}:${name}:${node.pos}`;
  graph.functions.push({
    id,
    file: rel(file),
    name,
    kind,
    line: lc.line + 1,
    parent: parentFunction || null,
  });
  return id;
};

const addCall = (file, fromFn, toName, node) => {
  const source = node.getSourceFile();
  const lc = source.getLineAndCharacterOfPosition(node.getStart());
  graph.calls.push({
    file: rel(file),
    from: fromFn || null,
    to: toName,
    line: lc.line + 1,
  });
};

for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

  source.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleName = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : "<unknown>";
      const isTypeOnly = node.importClause ? node.importClause.isTypeOnly : false;
      addImport(file, moduleName, isTypeOnly);
    }
  });

  const fnStack = [];

  const currentFn = () => (fnStack.length ? fnStack[fnStack.length - 1] : null);

  const nameFromVarDecl = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return null;
  };

  const methodName = (node) => {
    if (node.name && ts.isIdentifier(node.name)) return node.name.text;
    if (node.name && ts.isStringLiteral(node.name)) return node.name.text;
    return "<anonymous-method>";
  };

  const visit = (node) => {
    let pushedFn = false;

    if (ts.isFunctionDeclaration(node) && node.name) {
      const id = addFunction(file, node.name.text, "function", node, currentFn());
      fnStack.push(id);
      pushedFn = true;
    } else if (ts.isMethodDeclaration(node)) {
      const id = addFunction(file, methodName(node), "method", node, currentFn());
      fnStack.push(id);
      pushedFn = true;
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const parent = node.parent;
      let name = "<anonymous>";
      if (ts.isVariableDeclaration(parent)) {
        const varName = nameFromVarDecl(parent);
        if (varName) name = varName;
      } else if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
        name = parent.name.text;
      }
      const kind = ts.isArrowFunction(node) ? "arrow" : "function-expression";
      const id = addFunction(file, name, kind, node, currentFn());
      fnStack.push(id);
      pushedFn = true;
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const declList = node.parent && node.parent.parent && ts.isVariableStatement(node.parent.parent)
        ? node.parent.parent.declarationList
        : null;
      let kind = "var";
      if (declList) {
        if (declList.flags & ts.NodeFlags.Const) kind = "const";
        else if (declList.flags & ts.NodeFlags.Let) kind = "let";
      }
      addVariable(file, node.name.text, kind, node, currentFn());
    }

    if (ts.isCallExpression(node)) {
      let toName = "<call>";
      if (ts.isIdentifier(node.expression)) {
        toName = node.expression.text;
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        toName = `${node.expression.expression.getText(source)}.${node.expression.name.getText(source)}`;
      } else {
        toName = textAt(source, node.expression).slice(0, 80);
      }
      addCall(file, currentFn(), toName, node);
    }

    ts.forEachChild(node, visit);

    if (pushedFn) fnStack.pop();
  };

  visit(source);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(graph, null, 2), "utf8");

// Build a compact DOT focused on file-level dependencies.
const dotLines = [
  "digraph audit_graph {",
  "  rankdir=LR;",
  "  node [shape=box, fontsize=10];",
];

const fileNodeId = (id) => id.replace(/[^a-zA-Z0-9_]/g, "_");

for (const file of graph.files) {
  dotLines.push(`  ${fileNodeId(file.id)} [label=\"${file.path}\"];`);
}

for (const imp of graph.imports) {
  const fromId = fileNodeId(imp.from);
  const target = imp.module;
  // Only draw edges for local aliases and relative imports.
  if (target.startsWith("@/") || target.startsWith("./") || target.startsWith("../")) {
    dotLines.push(`  ${fromId} -> \"${target}\";`);
  }
}

dotLines.push("}");
fs.writeFileSync(outDot, dotLines.join("\n"), "utf8");

console.log(`Wrote ${rel(outJson)} and ${rel(outDot)}`);
console.log(`Files: ${graph.files.length}, functions: ${graph.functions.length}, variables: ${graph.variables.length}, imports: ${graph.imports.length}, calls: ${graph.calls.length}`);
