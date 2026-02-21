'use strict';

const { SnapshotStore } = require('../snapshot');

describe('SnapshotStore', () => {
  let store;

  beforeEach(() => {
    // Use an in-memory database for test isolation.
    store = new SnapshotStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  test('saves a snapshot and returns an integer id', () => {
    const id = store.save('model-a', { x: 1 }, { result: 10 });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  test('list returns all snapshots when no modelId given', () => {
    store.save('model-a', { x: 1 }, { result: 10 });
    store.save('model-b', { x: 2 }, { result: 20 });

    const all = store.list();
    expect(all).toHaveLength(2);
  });

  test('list returns snapshots filtered by modelId', () => {
    store.save('model-a', { x: 1 }, { result: 10 });
    store.save('model-a', { x: 2 }, { result: 20 });
    store.save('model-b', { x: 3 }, { result: 30 });

    const modelA = store.list('model-a');
    expect(modelA).toHaveLength(2);
    expect(modelA.every((s) => s.model_id === 'model-a')).toBe(true);
  });

  test('list returns an empty array when no snapshots match', () => {
    const results = store.list('non-existent-model');
    expect(results).toEqual([]);
  });

  test('snapshot row has all expected fields', () => {
    store.save('model-a', { revenue: 5000 }, { profit: 1000 });
    const [snap] = store.list('model-a');

    expect(snap).toHaveProperty('id');
    expect(snap).toHaveProperty('model_id', 'model-a');
    expect(snap).toHaveProperty('inputs');
    expect(snap).toHaveProperty('outputs');
    expect(snap).toHaveProperty('created_at');

    expect(snap.inputs).toEqual({ revenue: 5000 });
    expect(snap.outputs).toEqual({ profit: 1000 });
  });

  test('created_at is a valid ISO 8601 string', () => {
    store.save('model-a', {}, {});
    const [snap] = store.list('model-a');

    const date = new Date(snap.created_at);
    expect(date.toISOString()).toBe(snap.created_at);
  });

  test('list returns results newest first', () => {
    store.save('model-a', { n: 1 }, { r: 1 });
    store.save('model-a', { n: 2 }, { r: 2 });
    store.save('model-a', { n: 3 }, { r: 3 });

    const snaps = store.list('model-a');
    // newest (id 3) should be first
    expect(snaps[0].inputs.n).toBe(3);
    expect(snaps[2].inputs.n).toBe(1);
  });

  test('inputs and outputs are JSON-parsed back to objects', () => {
    const inputs = { a: 1, b: 'hello', c: true };
    const outputs = { x: [1, 2, 3], y: { nested: true } };
    store.save('model-a', inputs, outputs);
    const [snap] = store.list('model-a');
    expect(snap.inputs).toEqual(inputs);
    expect(snap.outputs).toEqual(outputs);
  });

  test('throws when modelId is not a string', () => {
    expect(() => store.save(null, {}, {})).toThrow(TypeError);
  });

  test('throws when inputs is not an object', () => {
    expect(() => store.save('model-a', 'bad', {})).toThrow(TypeError);
  });

  test('throws when outputs is not an object', () => {
    expect(() => store.save('model-a', {}, 42)).toThrow(TypeError);
  });
});
