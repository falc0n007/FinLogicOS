'use strict';

const { createSandbox } = require('../sandbox');

describe('createSandbox', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  // --- Correct execution ---

  test('executes simple arithmetic and returns output', () => {
    const code = `
      module.exports = function(inputs) {
        return { result: inputs.a + inputs.b };
      };
    `;
    const { result } = sandbox.execute(code, { a: 3, b: 4 });
    expect(result).toBe(7);
  });

  test('provides Decimal.js for high-precision arithmetic', () => {
    const code = `
      module.exports = function(inputs) {
        const val = new Decimal(inputs.x).times(inputs.y);
        return { result: val.toNumber() };
      };
    `;
    const { result } = sandbox.execute(code, { x: '0.1', y: '0.2' });
    // Decimal.js avoids 0.1 * 0.2 = 0.020000000000000004
    expect(result).toBeCloseTo(0.02, 10);
  });

  test('provides Math object', () => {
    const code = `
      module.exports = function(inputs) {
        return { result: Math.sqrt(inputs.n) };
      };
    `;
    const { result } = sandbox.execute(code, { n: 9 });
    expect(result).toBe(3);
  });

  test('provides JSON object', () => {
    const code = `
      module.exports = function(inputs) {
        const str = JSON.stringify({ val: inputs.val });
        return { result: JSON.parse(str).val };
      };
    `;
    const { result } = sandbox.execute(code, { val: 42 });
    expect(result).toBe(42);
  });

  test('inputs are accessible inside the sandbox', () => {
    const code = `
      module.exports = function(inputs) {
        return { echo: inputs.msg };
      };
    `;
    const { echo } = sandbox.execute(code, { msg: 'hello' });
    expect(echo).toBe('hello');
  });

  // --- Security: blocked globals ---

  test('throws when code accesses process', () => {
    const code = `
      module.exports = function() {
        return { env: process.env };
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  test('throws when code accesses require', () => {
    const code = `
      module.exports = function() {
        const fs = require('fs');
        return { ok: true };
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  test('throws when code accesses global', () => {
    const code = `
      module.exports = function() {
        return { val: global.process.version };
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  test('throws when code accesses globalThis', () => {
    const code = `
      module.exports = function() {
        return { val: globalThis.process.version };
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  test('throws when code accesses Buffer', () => {
    const code = `
      module.exports = function() {
        return { val: Buffer.from('hello').toString('hex') };
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  test('throws when code accesses fetch', () => {
    const code = `
      module.exports = function() {
        fetch('https://example.com');
        return {};
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  test('throws when code uses Function constructor', () => {
    const code = `
      module.exports = function() {
        const fn = new Function('return process');
        return { val: fn() };
      };
    `;
    expect(() => sandbox.execute(code, {})).toThrow();
  });

  // --- Timeout ---

  test('throws on infinite loop after timeout', () => {
    const code = `
      module.exports = function() {
        while (true) {}
      };
    `;
    const fastSandbox = createSandbox({ timeoutMs: 200 });
    expect(() => fastSandbox.execute(code, {})).toThrow(/timed out/i);
  });

  // --- Error cases ---

  test('throws when logicCode is not a string', () => {
    expect(() => sandbox.execute(42, {})).toThrow(TypeError);
  });

  test('throws when inputs is not an object', () => {
    expect(() => sandbox.execute('module.exports = fn => ({});', null)).toThrow(TypeError);
  });

  test('throws when logic does not return an object', () => {
    const code = `module.exports = function() { return 42; };`;
    expect(() => sandbox.execute(code, {})).toThrow(/plain object/);
  });

  test('fresh context per execution - no state leakage between calls', () => {
    const code = `
      module.exports = function(inputs) {
        if (typeof __sharedState !== 'undefined') {
          return { leaked: true };
        }
        __sharedState = 'polluted';
        return { leaked: false };
      };
    `;
    const first = sandbox.execute(code, {});
    const second = sandbox.execute(code, {});
    expect(first.leaked).toBe(false);
    // If the context were shared, second call would see __sharedState and return true.
    expect(second.leaked).toBe(false);
  });
});
