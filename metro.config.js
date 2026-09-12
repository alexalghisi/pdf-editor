const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('pdf');

// pdf-lib is compiled with tslib's importHelpers and expects the CommonJS
// shape (a synthesized default carrying __extends and friends). With package
// exports enabled, Metro otherwise resolves tslib to its ESM build, whose
// missing default makes pdf-lib throw "Cannot destructure property
// '__extends' of 'n.default'" at load time on web. Pin tslib to its CJS entry.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/tslib/tslib.js'),
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
