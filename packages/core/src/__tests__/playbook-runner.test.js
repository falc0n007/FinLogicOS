'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const yaml = require('js-yaml');

const {
  PlaybookRunner,
  PlaybookExecutionError,
  evaluateSafeExpression,
} = require('../playbook-runner');

// ---------------------------------------------------------------------------
// Helpers: build temporary file-system fixtures
// ---------------------------------------------------------------------------

/**
 * Creates a temporary directory tree containing playbook YAML files and
 * minimal model pack directories, then returns the paths.
 *
 * @param {object} opts
 * @param {object} opts.models      - Map of modelId => { manifest, logicSrc }
 * @param {object} opts.playbooks   - Map of playbookId => playbook object
 * @returns {{ modelsDir: string, playbooksDir: string, cleanup: Function }}
 */
function buildFixtures({ models = {}, playbooks = {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-runner-test-'));

  const modelsDir = path.join(root, 'models');
  const playbooksDir = path.join(root, 'playbooks');
  fs.mkdirSync(modelsDir);
  fs.mkdirSync(playbooksDir);

  // Write model packs
  for (const [modelId, { manifest, logicSrc }] of Object.entries(models)) {
    const modelDir = path.join(modelsDir, modelId);
    fs.mkdirSync(modelDir);
    fs.writeFileSync(path.join(modelDir, 'manifest.yaml'), yaml.dump(manifest));
    fs.writeFileSync(path.join(modelDir, 'logic.js'), logicSrc);
  }

  // Write playbooks
  for (const [playbookId, playbook] of Object.entries(playbooks)) {
    fs.writeFileSync(
      path.join(playbooksDir, `${playbookId}.yaml`),
      yaml.dump(playbook)
    );
  }

  return {
    modelsDir,
    playbooksDir,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

// ---------------------------------------------------------------------------
// Shared fixture model definitions
// ---------------------------------------------------------------------------

const DOUBLE_MODEL = {
  manifest: {
    id: 'double-it',
    name: 'Double It',
    version: '1.0.0',
    inputs: [{ id: 'value', type: 'number' }],
    outputs: [{ id: 'result', type: 'number' }],
  },
  logicSrc: `
    module.exports = function(inputs) {
      return { result: inputs.value * 2 };
    };
  `,
};

const ADD_MODEL = {
  manifest: {
    id: 'add-two',
    name: 'Add Two',
    version: '2.0.0',
    inputs: [
      { id: 'a', type: 'number' },
      { id: 'b', type: 'number' },
    ],
    outputs: [{ id: 'sum', type: 'number' }],
  },
  logicSrc: `
    module.exports = function(inputs) {
      return { sum: inputs.a + inputs.b };
    };
  `,
};

const ALWAYS_FAIL_MODEL = {
  manifest: {
    id: 'always-fail',
    name: 'Always Fail',
    version: '1.0.0',
    inputs: [],
    outputs: [],
  },
  logicSrc: `
    module.exports = function() {
      throw new Error('intentional failure');
    };
  `,
};

// ---------------------------------------------------------------------------
// evaluateSafeExpression unit tests
// ---------------------------------------------------------------------------

describe('evaluateSafeExpression', () => {
  test('evaluates numeric literals', () => {
    expect(evaluateSafeExpression('42', {})).toBe(42);
    expect(evaluateSafeExpression('3.14', {})).toBe(3.14);
  });

  test('evaluates basic arithmetic', () => {
    expect(evaluateSafeExpression('2 + 3', {})).toBe(5);
    expect(evaluateSafeExpression('10 - 4', {})).toBe(6);
    expect(evaluateSafeExpression('3 * 4', {})).toBe(12);
    expect(evaluateSafeExpression('15 / 3', {})).toBe(5);
  });

  test('respects operator precedence (* before +)', () => {
    expect(evaluateSafeExpression('2 + 3 * 4', {})).toBe(14);
    expect(evaluateSafeExpression('10 - 2 * 3', {})).toBe(4);
  });

  test('evaluates parenthesised expressions', () => {
    expect(evaluateSafeExpression('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateSafeExpression('(10 - 2) / (2 + 2)', {})).toBe(2);
  });

  test('resolves intake field references', () => {
    expect(evaluateSafeExpression('intake.salary * 0.2', { salary: 100000 })).toBe(20000);
    expect(evaluateSafeExpression('intake.a + intake.b', { a: 7, b: 3 })).toBe(10);
  });

  test('supports unary minus', () => {
    expect(evaluateSafeExpression('-5', {})).toBe(-5);
    expect(evaluateSafeExpression('-intake.x + 10', { x: 3 })).toBe(7);
  });

  test('throws on division by zero', () => {
    expect(() => evaluateSafeExpression('10 / 0', {})).toThrow(/division by zero/i);
  });

  test('throws on unknown intake field', () => {
    expect(() => evaluateSafeExpression('intake.missing', {})).toThrow(/unknown intake field/i);
  });

  test('throws on invalid characters', () => {
    expect(() => evaluateSafeExpression('alert(1)', {})).toThrow();
  });

  test('does not execute arbitrary code via eval-like paths', () => {
    // These must throw a parse error, not execute
    expect(() => evaluateSafeExpression('process.exit(0)', {})).toThrow();
    expect(() => evaluateSafeExpression('require("fs")', {})).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PlaybookRunner constructor
// ---------------------------------------------------------------------------

describe('PlaybookRunner constructor', () => {
  test('throws if modelsDir is missing', () => {
    expect(() => new PlaybookRunner({ playbooksDir: '/tmp' })).toThrow(/modelsDir/);
  });

  test('throws if playbooksDir is missing', () => {
    expect(() => new PlaybookRunner({ modelsDir: '/tmp' })).toThrow(/playbooksDir/);
  });
});

// ---------------------------------------------------------------------------
// Models execute in declared order
// ---------------------------------------------------------------------------

describe('PlaybookRunner.run', () => {
  test('executes models in declared order and captures outputs', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: {
        'double-it': DOUBLE_MODEL,
        'add-two': ADD_MODEL,
      },
      playbooks: {
        'basic-playbook': {
          id: 'basic-playbook',
          version: '1.0.0',
          intake_fields: [
            { id: 'salary', type: 'number' },
          ],
          models: [
            {
              run_id: 'step-double',
              section_label: 'Double Salary',
              model_id: 'double-it',
              input_map: { value: 'intake.salary' },
            },
            {
              run_id: 'step-add',
              section_label: 'Add Constants',
              model_id: 'add-two',
              input_map: { a: 'intake.salary', b: 5000 },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('basic-playbook', { salary: 50000 });

      expect(report.playbook_id).toBe('basic-playbook');
      expect(report.playbook_version).toBe('1.0.0');
      expect(report.sections).toHaveLength(2);

      const [s1, s2] = report.sections;

      expect(s1.model_run_id).toBe('step-double');
      expect(s1.skipped).toBe(false);
      expect(s1.error).toBeNull();
      expect(s1.outputs.result).toBe(100000);

      expect(s2.model_run_id).toBe('step-add');
      expect(s2.outputs.sum).toBe(55000);
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Conditional skip
  // -------------------------------------------------------------------------

  test('skips model when condition evaluates to false', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        conditional: {
          id: 'conditional',
          version: '1.0.0',
          intake_fields: [{ id: 'age', type: 'number' }],
          models: [
            {
              run_id: 'skip-me',
              section_label: 'Should Skip',
              model_id: 'double-it',
              condition: 'intake.age > 65',
              input_map: { value: 'intake.age' },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('conditional', { age: 30 });

      expect(report.sections[0].skipped).toBe(true);
      expect(report.sections[0].outputs).toBeNull();
      expect(report.summary.skipped).toBe(1);
      expect(report.summary.executed).toBe(0);
    } finally {
      cleanup();
    }
  });

  test('runs model when condition evaluates to true', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        conditional: {
          id: 'conditional',
          version: '1.0.0',
          intake_fields: [{ id: 'age', type: 'number' }],
          models: [
            {
              run_id: 'run-me',
              model_id: 'double-it',
              condition: 'intake.age >= 18',
              input_map: { value: 'intake.age' },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('conditional', { age: 25 });

      expect(report.sections[0].skipped).toBe(false);
      expect(report.sections[0].outputs.result).toBe(50);
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // warn_and_continue (default on_error behaviour)
  // -------------------------------------------------------------------------

  test('warn_and_continue produces partial report when a step fails', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: {
        'always-fail': ALWAYS_FAIL_MODEL,
        'double-it': DOUBLE_MODEL,
      },
      playbooks: {
        partial: {
          id: 'partial',
          version: '1.0.0',
          intake_fields: [{ id: 'value', type: 'number' }],
          models: [
            {
              run_id: 'step-fail',
              model_id: 'always-fail',
              input_map: {},
              on_error: 'warn_and_continue',
            },
            {
              run_id: 'step-ok',
              model_id: 'double-it',
              input_map: { value: 'intake.value' },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('partial', { value: 10 });

      expect(report.sections).toHaveLength(2);
      expect(report.sections[0].error).not.toBeNull();
      expect(report.sections[0].outputs).toBeNull();
      expect(report.sections[1].error).toBeNull();
      expect(report.sections[1].outputs.result).toBe(20);

      expect(report.summary.failed).toBe(1);
      expect(report.summary.executed).toBe(1);
      expect(report.summary.success).toBe(false);
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // abort on_error
  // -------------------------------------------------------------------------

  test('abort throws PlaybookExecutionError on first model failure', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: {
        'always-fail': ALWAYS_FAIL_MODEL,
        'double-it': DOUBLE_MODEL,
      },
      playbooks: {
        abort: {
          id: 'abort',
          version: '1.0.0',
          intake_fields: [{ id: 'value', type: 'number' }],
          models: [
            {
              run_id: 'step-fail',
              model_id: 'always-fail',
              input_map: {},
              on_error: 'abort',
            },
            {
              run_id: 'step-never-reached',
              model_id: 'double-it',
              input_map: { value: 'intake.value' },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      expect(() => runner.run('abort', { value: 10 })).toThrow(
        PlaybookExecutionError
      );
    } finally {
      cleanup();
    }
  });

  test('abort error context contains playbook_id and model_run_id', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'always-fail': ALWAYS_FAIL_MODEL },
      playbooks: {
        abort: {
          id: 'abort-ctx',
          version: '1.0.0',
          models: [
            {
              run_id: 'failing-step',
              model_id: 'always-fail',
              input_map: {},
              on_error: 'abort',
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      let caught;
      try {
        runner.run('abort', {});
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PlaybookExecutionError);
      expect(caught.context.playbook_id).toBe('abort-ctx');
      expect(caught.context.model_run_id).toBe('failing-step');
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Derived expressions in input_map
  // -------------------------------------------------------------------------

  test('derived expressions evaluate correctly in input_map', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        derived: {
          id: 'derived',
          version: '1.0.0',
          intake_fields: [{ id: 'income', type: 'number' }],
          models: [
            {
              run_id: 'step-derived',
              model_id: 'double-it',
              input_map: {
                value: { derived: 'intake.income * 0.8' },
              },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('derived', { income: 100000 });

      expect(report.sections[0].inputs.value).toBeCloseTo(80000);
      // double-it returns value * 2
      expect(report.sections[0].outputs.result).toBeCloseTo(160000);
    } finally {
      cleanup();
    }
  });

  test('derived expression with parentheses and multiple ops', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        derived2: {
          id: 'derived2',
          version: '1.0.0',
          intake_fields: [
            { id: 'gross', type: 'number' },
            { id: 'deduction', type: 'number' },
          ],
          models: [
            {
              run_id: 'step',
              model_id: 'double-it',
              input_map: {
                value: { derived: '(intake.gross - intake.deduction) / 2' },
              },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('derived2', { gross: 120000, deduction: 20000 });

      expect(report.sections[0].inputs.value).toBe(50000);
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Invalid derived expressions must not execute code
  // -------------------------------------------------------------------------

  test('invalid derived expression produces an error, not code execution', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        invalid: {
          id: 'invalid',
          version: '1.0.0',
          intake_fields: [{ id: 'x', type: 'number' }],
          models: [
            {
              run_id: 'step',
              model_id: 'double-it',
              // Attempt to use forbidden identifier in derived expression
              input_map: {
                value: { derived: 'process.exit(0)' },
              },
              on_error: 'warn_and_continue',
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      // Should not throw (warn_and_continue), but section must have an error
      const report = runner.run('invalid', { x: 1 });
      expect(report.sections[0].error).not.toBeNull();
      expect(report.sections[0].outputs).toBeNull();
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Report shape
  // -------------------------------------------------------------------------

  test('report has correct top-level shape', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        shape: {
          id: 'shape-test',
          version: '2.1.0',
          models: [
            {
              run_id: 'step1',
              model_id: 'double-it',
              input_map: { value: 10 },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      const report = runner.run('shape', {});

      expect(report).toMatchObject({
        playbook_id: 'shape-test',
        playbook_version: '2.1.0',
        executed_at: expect.any(String),
        intake_inputs: {},
        sections: expect.any(Array),
        summary: expect.objectContaining({
          total_steps: expect.any(Number),
          executed: expect.any(Number),
          skipped: expect.any(Number),
          failed: expect.any(Number),
          success: expect.any(Boolean),
        }),
      });

      // executed_at must be valid ISO 8601
      expect(() => new Date(report.executed_at)).not.toThrow();
      expect(new Date(report.executed_at).toISOString()).toBe(report.executed_at);
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Playbook not found
  // -------------------------------------------------------------------------

  test('throws when playbook YAML does not exist', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({});

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      expect(() => runner.run('no-such-playbook', {})).toThrow(/Playbook not found/);
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Intake validation
  // -------------------------------------------------------------------------

  test('throws when required intake field is missing', () => {
    const { modelsDir, playbooksDir, cleanup } = buildFixtures({
      models: { 'double-it': DOUBLE_MODEL },
      playbooks: {
        intake: {
          id: 'intake-test',
          version: '1.0.0',
          intake_fields: [{ id: 'salary', type: 'number' }],
          models: [
            {
              run_id: 'step',
              model_id: 'double-it',
              input_map: { value: 'intake.salary' },
            },
          ],
        },
      },
    });

    try {
      const runner = new PlaybookRunner({ modelsDir, playbooksDir });
      expect(() => runner.run('intake', {})).toThrow(/intake.*salary/i);
    } finally {
      cleanup();
    }
  });
});
