/** Jest config for class-planning unit tests (TypeScript, pure functions only). */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/features/classes/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // The tests only exercise pure modules; no transform of RN/Expo needed.
  transformIgnorePatterns: ["/node_modules/"],
};
