/**
 * Components may only use design tokens for color, typography, shadows and gradients.
 * Raw values live in src/design/tokens.css and fonts.css, which are exempt.
 * @type {import("stylelint").Config}
 */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-declaration-strict-value"],
  ignoreFiles: ["dist/**", "src/design/tokens.css", "src/design/fonts.css"],
  rules: {
    "scale-unlimited/declaration-strict-value": [
      [
        "/color$/",
        "background",
        "background-image",
        "box-shadow",
        "text-shadow",
        "font-family",
        "fill",
        "stroke",
      ],
      {
        ignoreValues: ["transparent", "inherit", "currentcolor", "none", "initial", "unset"],
        ignoreFunctions: false,
        disableFix: true,
      },
    ],
    "import-notation": "string",
    // CSS Modules use camelCase class names so they read naturally in TSX.
    "selector-class-pattern": "^[a-z][a-zA-Z0-9]*$",
  },
};
