const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// WebRTC 124 imports a legacy subpath absent from event-target-shim's exports.
// Resolve it through the package's public entry point, preserving its v6 instance.
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(context, moduleName === 'event-target-shim/index' ? 'event-target-shim' : moduleName, platform);
module.exports = config;
