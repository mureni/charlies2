/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: "no-unresolved",
      severity: "error",
      from: {},
      to: {
        couldNotResolve: true
      }
    },
    {
      name: "no-deprecated-core",
      severity: "warn",
      from: {},
      to: {
        dependencyTypes: ["core"],
        path: "^(domain|sys|punycode|_linklist)$"
      }
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "^src/index\\.ts$",
          "^src/admin-portal/index\\.ts$",
          "^src/types/.*\\.d\\.ts$"
        ]
      },
      to: {}
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules"
    },
    tsConfig: {
      fileName: "tsconfig.json"
    },
    tsPreCompilationDeps: true,
    moduleSystems: ["es6", "cjs"],
    enhancedResolveOptions: {
      extensions: [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]
    }
  }
};
