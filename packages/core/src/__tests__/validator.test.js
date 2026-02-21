'use strict';

const { validateInputs } = require('../validator');

const manifest = {
  id: 'test-model',
  name: 'Test',
  version: '1.0.0',
  inputs: [
    { id: 'revenue', type: 'number' },
    { id: 'label', type: 'string' },
    { id: 'active', type: 'boolean' },
    { id: 'mode', type: 'enum', values: ['simple', 'detailed', 'expert'] },
  ],
  outputs: [],
};

const validInputs = {
  revenue: 10000,
  label: 'Q1 2026',
  active: true,
  mode: 'simple',
};

describe('validateInputs', () => {
  test('returns valid=true for correct inputs', () => {
    const { valid, errors } = validateInputs(manifest, validInputs);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('returns error when a required input is missing', () => {
    const { revenue, ...rest } = validInputs;
    const { valid, errors } = validateInputs(manifest, rest);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"revenue"') && e.includes('Missing'))).toBe(true);
  });

  test('returns error when number input receives a string', () => {
    const { valid, errors } = validateInputs(manifest, {
      ...validInputs,
      revenue: 'not-a-number',
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"revenue"') && e.includes('number'))).toBe(true);
  });

  test('returns error when number input receives Infinity', () => {
    const { valid, errors } = validateInputs(manifest, {
      ...validInputs,
      revenue: Infinity,
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"revenue"'))).toBe(true);
  });

  test('returns error when string input receives a number', () => {
    const { valid, errors } = validateInputs(manifest, {
      ...validInputs,
      label: 99,
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"label"') && e.includes('string'))).toBe(true);
  });

  test('returns error when boolean input receives a string', () => {
    const { valid, errors } = validateInputs(manifest, {
      ...validInputs,
      active: 'yes',
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"active"') && e.includes('boolean'))).toBe(true);
  });

  test('returns error when enum input receives an unlisted value', () => {
    const { valid, errors } = validateInputs(manifest, {
      ...validInputs,
      mode: 'turbo',
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"mode"') && e.includes('"turbo"'))).toBe(true);
  });

  test('accepts all valid enum values', () => {
    for (const mode of ['simple', 'detailed', 'expert']) {
      const { valid } = validateInputs(manifest, { ...validInputs, mode });
      expect(valid).toBe(true);
    }
  });

  test('collects multiple errors in one pass', () => {
    const { valid, errors } = validateInputs(manifest, {
      revenue: 'bad',
      label: 42,
      active: 'yes',
      mode: 'unknown',
    });
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  test('returns error when inputs is not an object', () => {
    const { valid, errors } = validateInputs(manifest, 'not-an-object');
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/plain object/);
  });

  test('returns error when manifest has no inputs array', () => {
    const { valid, errors } = validateInputs({}, validInputs);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/valid "inputs" array/);
  });

  test('extra keys in inputs are silently ignored', () => {
    const { valid } = validateInputs(manifest, {
      ...validInputs,
      extraKey: 'ignored',
    });
    expect(valid).toBe(true);
  });
});
