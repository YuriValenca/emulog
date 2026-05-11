// webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  // Configure o Webpack para tratar o crypto como um módulo vazio
  config.resolve.fallback = { crypto: false };
  return config;
};
