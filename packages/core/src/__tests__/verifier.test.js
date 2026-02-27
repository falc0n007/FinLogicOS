'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { hashFile, hashBuffer, verifyPack } = require('../verifier');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'finlogic-verifier-test-'));
}

function writeFile(dir, name, content) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ---------------------------------------------------------------------------
// hashBuffer
// ---------------------------------------------------------------------------

describe('hashBuffer', () => {
  test('returns SHA-256 hex digest of a Buffer', () => {
    const buf = Buffer.from('hello world');
    const result = hashBuffer(buf);
    expect(result).toBe(sha256('hello world'));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  test('returns SHA-256 hex digest of a string', () => {
    const result = hashBuffer('hello world');
    expect(result).toBe(sha256('hello world'));
  });

  test('different inputs produce different digests', () => {
    expect(hashBuffer('aaa')).not.toBe(hashBuffer('bbb'));
  });
});

// ---------------------------------------------------------------------------
// hashFile
// ---------------------------------------------------------------------------

describe('hashFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns SHA-256 hex digest of a file', () => {
    const content = 'id: test\nname: Test\n';
    const filePath = writeFile(tmpDir, 'manifest.yaml', content);
    expect(hashFile(filePath)).toBe(sha256(content));
  });

  test('different file contents produce different digests', () => {
    const p1 = writeFile(tmpDir, 'a.txt', 'alpha');
    const p2 = writeFile(tmpDir, 'b.txt', 'beta');
    expect(hashFile(p1)).not.toBe(hashFile(p2));
  });

  test('same content in different files produces same digest', () => {
    const p1 = writeFile(tmpDir, 'a.txt', 'same content');
    const p2 = writeFile(tmpDir, 'b.txt', 'same content');
    expect(hashFile(p1)).toBe(hashFile(p2));
  });
});

// ---------------------------------------------------------------------------
// verifyPack
// ---------------------------------------------------------------------------

describe('verifyPack', () => {
  let tmpDir;
  const manifestContent = 'id: my-pack\nname: My Pack\nversion: 1.0.0\n';
  const logicContent = 'module.exports = function(inputs) { return {}; };\n';

  beforeEach(() => {
    tmpDir = makeTempDir();
    writeFile(tmpDir, 'manifest.yaml', manifestContent);
    writeFile(tmpDir, 'logic.js', logicContent);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns { valid: null, errors: ["Pack not in registry"] } when registryEntry is null', () => {
    const result = verifyPack(tmpDir, null);
    expect(result.valid).toBeNull();
    expect(result.errors).toEqual(['Pack not in registry']);
  });

  test('returns { valid: null } when registryEntry is undefined', () => {
    const result = verifyPack(tmpDir, undefined);
    expect(result.valid).toBeNull();
    expect(result.errors).toEqual(['Pack not in registry']);
  });

  test('returns { valid: true, errors: [] } when hashes match', () => {
    const registryEntry = {
      manifest_sha256: sha256(manifestContent),
      logic_sha256: sha256(logicContent),
    };
    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('returns { valid: false } when manifest hash does not match', () => {
    const registryEntry = {
      manifest_sha256: 'a'.repeat(64),
      logic_sha256: sha256(logicContent),
    };
    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/manifest\.yaml hash mismatch/);
  });

  test('returns { valid: false } when logic hash does not match', () => {
    const registryEntry = {
      manifest_sha256: sha256(manifestContent),
      logic_sha256: 'b'.repeat(64),
    };
    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/logic\.js hash mismatch/);
  });

  test('detects tampered manifest.yaml', () => {
    const registryEntry = {
      manifest_sha256: sha256(manifestContent),
      logic_sha256: sha256(logicContent),
    };

    // Tamper with the manifest after computing the expected hash
    writeFile(tmpDir, 'manifest.yaml', manifestContent + '\ntampered: true\n');

    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/manifest\.yaml hash mismatch/);
  });

  test('detects tampered logic.js', () => {
    const registryEntry = {
      manifest_sha256: sha256(manifestContent),
      logic_sha256: sha256(logicContent),
    };

    // Tamper with logic.js after computing the expected hash
    writeFile(tmpDir, 'logic.js', logicContent + '// injected\n');

    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/logic\.js hash mismatch/);
  });

  test('reports error when manifest.yaml is missing', () => {
    fs.unlinkSync(path.join(tmpDir, 'manifest.yaml'));
    const registryEntry = {
      manifest_sha256: sha256(manifestContent),
      logic_sha256: sha256(logicContent),
    };
    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('manifest.yaml not found'))).toBe(true);
  });

  test('reports error when logic.js is missing', () => {
    fs.unlinkSync(path.join(tmpDir, 'logic.js'));
    const registryEntry = {
      manifest_sha256: sha256(manifestContent),
      logic_sha256: sha256(logicContent),
    };
    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('logic.js not found'))).toBe(true);
  });

  test('accumulates multiple errors when both files are tampered', () => {
    const registryEntry = {
      manifest_sha256: 'a'.repeat(64),
      logic_sha256: 'b'.repeat(64),
    };
    const result = verifyPack(tmpDir, registryEntry);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});
