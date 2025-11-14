const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Permet à Expo de résoudre correctement dans un monorepo
config.watchFolders = [path.resolve(__dirname)];
config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, "node_modules"),
    path.resolve(__dirname, "../../node_modules"),
];

module.exports = config;