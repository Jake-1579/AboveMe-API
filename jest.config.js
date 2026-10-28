/** @type {import("jest").Config} */
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  clearMocks: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    // cookie (used by Fastify's inject) only ships ESM, so compile it to CommonJS
    "node_modules[\\\\/]cookie[\\\\/].+\\.js$": [
      "ts-jest",
      { tsconfig: { allowJs: true, module: "CommonJS" } },
    ],
  },
  transformIgnorePatterns: ["node_modules[\\\\/](?!cookie[\\\\/])"],
  // Source imports use ".js" extensions (NodeNext); point them at the .ts files
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
