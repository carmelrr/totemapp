module.exports = function (api) {
  api.cache(true);

  const plugins = [
    ["module-resolver", { root: ["./"], alias: { "@": "./src" } }],
    "react-native-reanimated/plugin",
  ];

  // Strip all console.* calls in production builds
  // Prevents performance overhead and sensitive data leakage (uids, emails)
  if (process.env.NODE_ENV === "production" || process.env.BABEL_ENV === "production") {
    plugins.unshift("transform-remove-console");
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
