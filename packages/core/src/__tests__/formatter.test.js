'use strict';

const { formatOutput } = require('../formatter');
const Decimal = require('decimal.js');

const manifest = {
  outputs: [
    { id: 'revenue',  label: 'Total Revenue',   format: 'currency', prefix: '$' },
    { id: 'margin',   label: 'Profit Margin',    format: 'percent' },
    { id: 'headcount',label: 'Headcount',        format: 'integer' },
    { id: 'ratio',    label: 'Ratio',            format: 'decimal' },
    { id: 'note',     label: 'Note'                                 },
  ],
};

describe('formatOutput', () => {
  test('formats currency with prefix and two decimal places', () => {
    const result = formatOutput(manifest, { revenue: 1234567.5 });
    expect(result.revenue.label).toBe('Total Revenue');
    expect(result.revenue.value).toBe(1234567.5);
    expect(result.revenue.formatted).toContain('$');
    expect(result.revenue.formatted).toContain('1,234,567.50');
  });

  test('formats percent as value * 100 with % sign', () => {
    const result = formatOutput(manifest, { margin: 0.1575 });
    expect(result.margin.formatted).toContain('%');
    expect(result.margin.formatted).toContain('15.75');
  });

  test('formats integer with rounding and comma separator', () => {
    const result = formatOutput(manifest, { headcount: 1234.7 });
    expect(result.headcount.formatted).toBe('1,235');
  });

  test('formats decimal with precision', () => {
    const result = formatOutput(manifest, { ratio: 3.14159 });
    expect(result.ratio.formatted).toContain('3.14159');
  });

  test('unwraps Decimal.js instances', () => {
    const result = formatOutput(manifest, { revenue: new Decimal('9999.99') });
    expect(result.revenue.formatted).toContain('9,999.99');
  });

  test('string output with no format is stringified', () => {
    const result = formatOutput(manifest, { note: 'All good' });
    expect(result.note.formatted).toBe('All good');
  });

  test('null/undefined output value returns N/A', () => {
    const result = formatOutput(manifest, { revenue: null });
    expect(result.revenue.formatted).toBe('N/A');
  });

  test('returns label from manifest', () => {
    const result = formatOutput(manifest, { headcount: 10 });
    expect(result.headcount.label).toBe('Headcount');
  });

  test('throws when manifest has no outputs array', () => {
    expect(() => formatOutput({}, { revenue: 1 })).toThrow('"outputs" array');
  });

  test('throws when outputs is not an object', () => {
    expect(() => formatOutput(manifest, null)).toThrow('plain object');
  });
});
