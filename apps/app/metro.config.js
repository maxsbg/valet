const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @jsquash/webp ships its libwebp encoder as a WASM asset.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');

module.exports = config;
