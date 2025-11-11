module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks",
    "import",
    "unused-imports",
    "prettier"
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended"
  ],
  settings: {
    react: {
      version: "detect"
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"]
      },
      typescript: {
        project: "./tsconfig.base.json"
      }
    }
  },
  rules: {
    "prettier/prettier": [
      "error",
      {
        singleQuote: true,
        trailingComma: "all",
        semi: true,
        printWidth: 100
      }
    ],
    "unused-imports/no-unused-imports": "error",
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": ["warn"],
    "import/order": [
      "warn",
      {
        "groups": [["builtin", "external", "internal"]],
        "newlines-between": "always"
      }
    ]
  },
  ignorePatterns: ["node_modules", "dist", "build", ".turbo"]
};
