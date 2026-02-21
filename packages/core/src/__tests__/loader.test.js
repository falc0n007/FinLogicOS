'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadModel } = require('../loader');

// Helper: write a model fixture to a temp directory.
function makeTempModel(manifestContent, logicContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finlogicos-test-'));

  fs.writeFileSync(path.join(dir, 'manifest.yaml'), manifestContent, 'utf8');

  if (logicContent !== undefined) {
    fs.writeFileSync(path.join(dir, 'logic.js'), logicContent, 'utf8');
  }

  return dir;
}

const VALID_MANIFEST = `
id: test-model
name: Test Model
version: 1.0.0
inputs:
  - id: revenue
    type: number
outputs:
  - id: profit
    label: Profit
`;

const VALID_LOGIC = `
module.exports = function(inputs) {
  return { profit: inputs.revenue * 0.2 };
};
`;

describe('loadModel', () => {
  test('returns manifest and execute function for a valid model', () => {
    const dir = makeTempModel(VALID_MANIFEST, VALID_LOGIC);
    const { manifest, execute } = loadModel(dir);

    expect(manifest.id).toBe('test-model');
    expect(manifest.name).toBe('Test Model');
    expect(typeof execute).toBe('function');
  });

  test('execute function produces correct output', () => {
    const dir = makeTempModel(VALID_MANIFEST, VALID_LOGIC);
    const { execute } = loadModel(dir);

    const output = execute({ revenue: 1000 });
    expect(output.profit).toBe(200);
  });

  test('throws when manifest.yaml is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finlogicos-test-'));
    expect(() => loadModel(dir)).toThrow('Manifest not found');
  });

  test('throws when logic.js is missing', () => {
    const dir = makeTempModel(VALID_MANIFEST, undefined);
    expect(() => loadModel(dir)).toThrow('logic.js not found');
  });

  test('throws when a required manifest field is missing', () => {
    const badManifest = `
id: test-model
name: Test Model
version: 1.0.0
inputs: []
`;
    const dir = makeTempModel(badManifest, VALID_LOGIC);
    expect(() => loadModel(dir)).toThrow('missing required fields');
  });

  test('throws when inputs is not an array', () => {
    const badManifest = `
id: test-model
name: Test Model
version: 1.0.0
inputs: not-an-array
outputs: []
`;
    const dir = makeTempModel(badManifest, VALID_LOGIC);
    expect(() => loadModel(dir)).toThrow('"inputs" must be an array');
  });

  test('throws when manifest YAML is malformed', () => {
    const dir = makeTempModel(': invalid: yaml: [\n', VALID_LOGIC);
    expect(() => loadModel(dir)).toThrow('Failed to parse manifest.yaml');
  });

  test('throws when logic.js does not export a function', () => {
    const dir = makeTempModel(VALID_MANIFEST, 'module.exports = 42;');
    expect(() => loadModel(dir)).toThrow('must export a single function');
  });
});
