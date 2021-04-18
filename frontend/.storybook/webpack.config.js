const webpack = require('webpack');

module.exports = async ({ config }) => {
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /PersistentFetcher[.]js$/,
      '../../../.storybook/MockPersistentFetcher.js',
    ),
  );
  return config;
};
