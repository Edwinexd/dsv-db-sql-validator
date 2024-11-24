module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Needed for sql.js
      webpackConfig.resolve.fallback = {
        fs: require.resolve("browserify-fs"),
        stream: require.resolve("stream-browserify"),
        crypto: require.resolve("crypto-browserify"),
        vm: false,
      };
  
      // Add the 'module' configuration for handling .wasm files
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: "javascript/auto",
      });
  
      return webpackConfig;
    },
  },
};
  