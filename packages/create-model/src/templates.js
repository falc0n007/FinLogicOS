'use strict';

const yaml = require('js-yaml');

/**
 * Generates a pre-filled manifest.yaml string for the given model metadata.
 *
 * @param {string} name     - The model name (e.g. "my-tax-model")
 * @param {string} category - The model category (e.g. "tax")
 * @param {string} author   - The author handle (e.g. "@username")
 * @returns {string} YAML-formatted manifest content
 */
function generateManifest(name, category, author) {
  const manifest = {
    id: name,
    name: name,
    version: '1.0.0',
    category: category,
    author: author,
    inputs: [],
    outputs: [],
  };

  return yaml.dump(manifest, { lineWidth: -1 });
}

/**
 * Generates a logic.js stub for the given model name.
 *
 * @param {string} name - The model name
 * @returns {string} JavaScript stub content
 */
function generateLogic(name) {
  return [
    "'use strict';",
    '',
    '/**',
    ' * ' + name + ' model logic.',
    ' *',
    ' * @param {Object} inputs - The validated input values defined in manifest.yaml',
    ' * @returns {Object} The computed output values defined in manifest.yaml',
    ' */',
    'module.exports = function (inputs) {',
    '  /* your logic here */',
    '  return {};',
    '};',
    '',
  ].join('\n');
}

/**
 * Generates a logic.test.js Jest test stub for the given model name.
 *
 * @param {string} name - The model name
 * @returns {string} Jest test stub content
 */
function generateTest(name) {
  return [
    "'use strict';",
    '',
    "const logic = require('./logic');",
    '',
    "describe('" + name + "', () => {",
    "  test('should return expected output', () => {",
    '    const inputs = {};',
    '    const result = logic(inputs);',
    '    expect(result).toBeDefined();',
    '  });',
    '});',
    '',
  ].join('\n');
}

/**
 * Generates a README.md stub for the given model name and category.
 *
 * @param {string} name     - The model name
 * @param {string} category - The model category
 * @returns {string} Markdown stub content
 */
function generateReadme(name, category) {
  return [
    '# ' + name,
    '',
    '**Category:** ' + category,
    '',
    '## Description',
    '',
    '<!-- Describe what this model calculates and the financial logic it encodes. -->',
    '',
    '## Inputs',
    '',
    '| Name | Type | Description |',
    '|------|------|-------------|',
    '| -    | -    | -           |',
    '',
    '## Outputs',
    '',
    '| Name | Type | Description |',
    '|------|------|-------------|',
    '| -    | -    | -           |',
    '',
    '## Usage',
    '',
    '```js',
    "const logic = require('./logic');",
    '',
    'const result = logic({',
    '  // provide input values here',
    '});',
    '',
    'console.log(result);',
    '```',
    '',
    '## Testing',
    '',
    '```bash',
    'npm test',
    '```',
    '',
  ].join('\n');
}

/**
 * Generates a package.json string for the given model name.
 *
 * @param {string} name - The model name
 * @returns {string} JSON-formatted package.json content
 */
function generatePackageJson(name) {
  const pkg = {
    name: name,
    version: '1.0.0',
    description: '',
    main: 'logic.js',
    scripts: {
      test: 'jest',
    },
    dependencies: {
      'decimal.js': '^10.4.3',
    },
    devDependencies: {
      jest: '^29.7.0',
    },
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}

module.exports = {
  generateManifest,
  generateLogic,
  generateTest,
  generateReadme,
  generatePackageJson,
};
