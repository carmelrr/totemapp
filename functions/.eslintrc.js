module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: ["eslint:recommended", "google"],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { allowTemplateLiterals: true }],
    // Disable problematic rules for cross-platform development
    "linebreak-style": "off",
    "indent": "off",
    "object-curly-spacing": "off",
    "max-len": "off",
    "no-trailing-spaces": "off",
    "padded-blocks": "off",
    "comma-dangle": "off",
    "quote-props": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
