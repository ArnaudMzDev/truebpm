// apps/mobile/metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// ✅ Autorise Metro à suivre les dossiers du monorepo
config.watchFolders = [workspaceRoot];

// ✅ Empêche Metro de remonter trop haut (problème pnpm)
config.resolver.disableHierarchicalLookup = true;

// ✅ Indique explicitement où sont les node_modules
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
];

// ✅ Extensions que Metro doit comprendre
config.resolver.sourceExts = [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "cjs",
];

// ✅ Déclare tes modules internes TrueBPM
const packages = ["ui", "types", "config"];

for (const pkg of packages) {
    config.resolver.extraNodeModules[`@truebpm/${pkg}`] = path.resolve(
        workspaceRoot,
        `packages/${pkg}`
    );
}

module.exports = config;