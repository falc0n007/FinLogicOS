'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { loadModel } = require('./loader');
const { createSandbox } = require('./sandbox');
const { validateInputs } = require('./validator');

/**
 * Thrown when a playbook model step fails and its on_error policy is 'abort'.
 */
class PlaybookExecutionError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'PlaybookExecutionError';
    this.context = context || {};
  }
}

// ---------------------------------------------------------------------------
// Safe arithmetic expression parser
//
// Supports: numeric literals, +, -, *, /, unary minus, parentheses, and
// `intake.{field}` references. Does NOT use eval() or new Function().
// ---------------------------------------------------------------------------

/**
 * Token types used by the expression lexer.
 */
const TOKEN = {
  NUMBER: 'NUMBER',
  INTAKE_REF: 'INTAKE_REF',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF',
};

/**
 * Tokenises an arithmetic expression string into a flat token array.
 *
 * @param {string} expr
 * @returns {Array<{type: string, value: *}>}
 * @throws {Error} On unrecognised characters.
 */
function tokenise(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numeric literal (integers and decimals, including leading dot)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) {
        throw new Error(`Invalid numeric literal: "${num}"`);
      }
      tokens.push({ type: TOKEN.NUMBER, value: parsed });
      continue;
    }

    // intake.{field} reference
    if (expr.startsWith('intake.', i)) {
      i += 'intake.'.length;
      let field = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        field += expr[i++];
      }
      if (!field) {
        throw new Error('intake. reference must be followed by a field name');
      }
      tokens.push({ type: TOKEN.INTAKE_REF, value: field });
      continue;
    }

    switch (ch) {
      case '+': tokens.push({ type: TOKEN.PLUS });   i++; break;
      case '-': tokens.push({ type: TOKEN.MINUS });  i++; break;
      case '*': tokens.push({ type: TOKEN.STAR });   i++; break;
      case '/': tokens.push({ type: TOKEN.SLASH });  i++; break;
      case '(': tokens.push({ type: TOKEN.LPAREN }); i++; break;
      case ')': tokens.push({ type: TOKEN.RPAREN }); i++; break;
      default:
        throw new Error(
          `Unexpected character "${ch}" at position ${i} in expression: "${expr}"`
        );
    }
  }

  tokens.push({ type: TOKEN.EOF });
  return tokens;
}

/**
 * Recursive-descent parser that evaluates an arithmetic expression.
 *
 * Grammar (standard operator precedence):
 *   expr   = term  (('+' | '-') term)*
 *   term   = factor (('*' | '/') factor)*
 *   factor = NUMBER | INTAKE_REF | '(' expr ')' | '-' factor
 *
 * @param {Array<{type: string, value: *}>} tokens - Token stream from tokenise().
 * @param {object} intakeInputs                    - Resolved intake field values.
 * @returns {number}
 */
function parseExpression(tokens, intakeInputs) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume(expectedType) {
    const tok = tokens[pos];
    if (expectedType && tok.type !== expectedType) {
      throw new Error(
        `Expected token ${expectedType} but got ${tok.type}`
      );
    }
    pos++;
    return tok;
  }

  function parseExpr() {
    let left = parseTerm();

    while (peek().type === TOKEN.PLUS || peek().type === TOKEN.MINUS) {
      const op = consume();
      const right = parseTerm();
      left = op.type === TOKEN.PLUS ? left + right : left - right;
    }

    return left;
  }

  function parseTerm() {
    let left = parseFactor();

    while (peek().type === TOKEN.STAR || peek().type === TOKEN.SLASH) {
      const op = consume();
      const right = parseFactor();
      if (op.type === TOKEN.SLASH) {
        if (right === 0) {
          throw new Error('Division by zero in derived expression');
        }
        left = left / right;
      } else {
        left = left * right;
      }
    }

    return left;
  }

  function parseFactor() {
    const tok = peek();

    if (tok.type === TOKEN.NUMBER) {
      consume();
      return tok.value;
    }

    if (tok.type === TOKEN.INTAKE_REF) {
      consume();
      const fieldName = tok.value;
      if (!(fieldName in intakeInputs)) {
        throw new Error(
          `Derived expression references unknown intake field: "${fieldName}"`
        );
      }
      const val = intakeInputs[fieldName];
      if (typeof val !== 'number' || !isFinite(val)) {
        throw new Error(
          `Intake field "${fieldName}" used in derived expression must be a finite number, got ${typeof val}`
        );
      }
      return val;
    }

    if (tok.type === TOKEN.LPAREN) {
      consume(TOKEN.LPAREN);
      const val = parseExpr();
      consume(TOKEN.RPAREN);
      return val;
    }

    if (tok.type === TOKEN.MINUS) {
      consume(TOKEN.MINUS);
      return -parseFactor();
    }

    throw new Error(
      `Unexpected token "${tok.type}" while parsing expression`
    );
  }

  const result = parseExpr();

  if (peek().type !== TOKEN.EOF) {
    throw new Error(
      `Unexpected token "${peek().type}" after expression end`
    );
  }

  return result;
}

/**
 * Evaluates a safe arithmetic expression string.
 *
 * @param {string} expr         - The expression to evaluate.
 * @param {object} intakeInputs - Resolved intake field values.
 * @returns {number}
 * @throws {Error} If the expression is invalid or references unknown fields.
 */
function evaluateSafeExpression(expr, intakeInputs) {
  if (typeof expr !== 'string' || !expr.trim()) {
    throw new Error('Expression must be a non-empty string');
  }
  const tokens = tokenise(expr);
  return parseExpression(tokens, intakeInputs);
}

// ---------------------------------------------------------------------------
// Condition evaluation
//
// Supports simple comparisons of the form:
//   intake.{field} <op> <number>
//   <number> <op> intake.{field}
//   intake.{field} <op> intake.{field2}
//
// Operators: ==, !=, >, >=, <, <=
// Also supports the literal strings 'true' and 'false'.
// ---------------------------------------------------------------------------

const CONDITION_RE =
  /^\s*(intake\.[a-zA-Z0-9_]+|-?[0-9.]+)\s*(==|!=|>=|<=|>|<)\s*(intake\.[a-zA-Z0-9_]+|-?[0-9.]+)\s*$/;

/**
 * Resolves a condition operand to a number or string from intakeInputs.
 *
 * @param {string} operand
 * @param {object} intakeInputs
 * @returns {*}
 */
function resolveOperand(operand, intakeInputs) {
  if (operand.startsWith('intake.')) {
    const field = operand.slice('intake.'.length);
    if (!(field in intakeInputs)) {
      throw new Error(`Condition references unknown intake field: "${field}"`);
    }
    return intakeInputs[field];
  }
  const n = parseFloat(operand);
  if (!isNaN(n)) return n;
  throw new Error(`Unrecognised condition operand: "${operand}"`);
}

/**
 * Evaluates a condition string.
 *
 * Returns true if the condition passes, false if it fails. Throws on
 * malformed conditions so authoring mistakes surface immediately.
 *
 * @param {string|boolean} condition
 * @param {object} intakeInputs
 * @returns {boolean}
 */
function evaluateCondition(condition, intakeInputs) {
  if (typeof condition === 'boolean') return condition;
  if (condition === 'true') return true;
  if (condition === 'false') return false;
  if (typeof condition !== 'string') {
    throw new Error(`Condition must be a string or boolean, got ${typeof condition}`);
  }

  const match = condition.match(CONDITION_RE);
  if (!match) {
    throw new Error(
      `Unsupported condition syntax: "${condition}". ` +
      'Use the form: intake.field <op> number or intake.field <op> intake.field2'
    );
  }

  const [, lhsRaw, op, rhsRaw] = match;
  const lhs = resolveOperand(lhsRaw.trim(), intakeInputs);
  const rhs = resolveOperand(rhsRaw.trim(), intakeInputs);

  switch (op) {
    case '==': return lhs == rhs;  // eslint-disable-line eqeqeq
    case '!=': return lhs != rhs;  // eslint-disable-line eqeqeq
    case '>':  return lhs > rhs;
    case '>=': return lhs >= rhs;
    case '<':  return lhs < rhs;
    case '<=': return lhs <= rhs;
    default:
      throw new Error(`Unknown comparison operator: "${op}"`);
  }
}

// ---------------------------------------------------------------------------
// Input mapping
// ---------------------------------------------------------------------------

/**
 * Resolves a single input_map value to a concrete value.
 *
 * Supported reference forms:
 *   - "intake.{field}"       => value from intakeInputs
 *   - { derived: "expr" }    => result of safe arithmetic expression
 *   - any scalar             => used directly
 *
 * @param {*} mapping         - The mapping spec from the playbook YAML.
 * @param {object} intakeInputs
 * @returns {*}
 */
function resolveInputMapping(mapping, intakeInputs) {
  // Object with a derived expression
  if (mapping !== null && typeof mapping === 'object' && 'derived' in mapping) {
    return evaluateSafeExpression(String(mapping.derived), intakeInputs);
  }

  // String "intake.field" reference
  if (typeof mapping === 'string' && mapping.startsWith('intake.')) {
    const field = mapping.slice('intake.'.length);
    if (!(field in intakeInputs)) {
      throw new Error(
        `input_map references unknown intake field: "${field}"`
      );
    }
    return intakeInputs[field];
  }

  // Literal scalar value
  return mapping;
}

/**
 * Builds a resolved inputs object for a model step using the step's
 * input_map and the provided intake inputs.
 *
 * @param {object} inputMap     - Key/value map from the playbook step.
 * @param {object} intakeInputs - Validated intake field values.
 * @returns {object}
 */
function resolveInputMap(inputMap, intakeInputs) {
  if (!inputMap || typeof inputMap !== 'object') {
    return {};
  }

  const resolved = {};
  for (const [key, mapping] of Object.entries(inputMap)) {
    resolved[key] = resolveInputMapping(mapping, intakeInputs);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// PlaybookRunner
// ---------------------------------------------------------------------------

/**
 * Loads and executes all model steps declared in a playbook manifest in order,
 * returning a structured PlaybookReport.
 */
class PlaybookRunner {
  /**
   * @param {object} options
   * @param {string} options.modelsDir    - Absolute path to the root directory
   *                                        containing model pack sub-directories.
   * @param {string} options.playbooksDir - Absolute path to the directory
   *                                        containing playbook YAML files.
   */
  constructor({ modelsDir, playbooksDir }) {
    if (!modelsDir || typeof modelsDir !== 'string') {
      throw new TypeError('PlaybookRunner requires a non-empty modelsDir string');
    }
    if (!playbooksDir || typeof playbooksDir !== 'string') {
      throw new TypeError('PlaybookRunner requires a non-empty playbooksDir string');
    }
    this.modelsDir = path.resolve(modelsDir);
    this.playbooksDir = path.resolve(playbooksDir);
  }

  /**
   * Runs all model steps in the named playbook against the supplied intake inputs.
   *
   * @param {string} playbookId   - Filename stem (without .yaml) of the playbook.
   * @param {object} intakeInputs - Key/value object matching the playbook's
   *                                intake_fields declarations.
   * @returns {object} PlaybookReport
   * @throws {PlaybookExecutionError} If a step with on_error='abort' fails.
   * @throws {Error} If the playbook file is missing or malformed.
   */
  run(playbookId, intakeInputs) {
    // --- Load playbook YAML ---
    const playbookPath = path.join(this.playbooksDir, `${playbookId}.yaml`);

    if (!fs.existsSync(playbookPath)) {
      throw new Error(`Playbook not found: ${playbookPath}`);
    }

    let playbook;
    try {
      const raw = fs.readFileSync(playbookPath, 'utf8');
      playbook = yaml.load(raw);
    } catch (err) {
      throw new Error(`Failed to parse playbook YAML: ${err.message}`);
    }

    if (!playbook || typeof playbook !== 'object') {
      throw new Error('Playbook YAML must be a non-empty object');
    }

    // --- Validate required playbook fields ---
    if (!playbook.id) {
      throw new Error('Playbook YAML must declare an "id" field');
    }
    if (!playbook.version) {
      throw new Error('Playbook YAML must declare a "version" field');
    }
    if (!Array.isArray(playbook.models) || playbook.models.length === 0) {
      throw new Error('Playbook YAML must declare a non-empty "models" array');
    }

    // --- Validate intake inputs against playbook's intake_fields schema ---
    if (Array.isArray(playbook.intake_fields)) {
      const intakeErrors = this._validateIntakeInputs(
        playbook.intake_fields,
        intakeInputs
      );
      if (intakeErrors.length > 0) {
        const err = new Error(
          `Playbook intake validation failed:\n  ${intakeErrors.join('\n  ')}`
        );
        err.errors = intakeErrors;
        throw err;
      }
    }

    const sandbox = createSandbox();
    const sections = [];

    // --- Execute each model step in order ---
    for (const step of playbook.models) {
      const modelRunId = step.run_id || step.model_id;
      const sectionLabel = step.section_label || step.model_id;
      const onError = step.on_error || 'warn_and_continue';

      // Evaluate condition (default: run)
      let skipped = false;
      if (step.condition !== undefined && step.condition !== null) {
        try {
          const condResult = evaluateCondition(step.condition, intakeInputs);
          if (!condResult) {
            skipped = true;
          }
        } catch (condErr) {
          const errMsg = `Condition evaluation error for step "${modelRunId}": ${condErr.message}`;
          if (onError === 'abort') {
            throw new PlaybookExecutionError(errMsg, {
              playbook_id: playbook.id,
              model_run_id: modelRunId,
            });
          }
          sections.push({
            section_label: sectionLabel,
            model_run_id: modelRunId,
            model_id: step.model_id,
            model_version: null,
            inputs: {},
            outputs: null,
            error: errMsg,
            skipped: false,
          });
          continue;
        }
      }

      if (skipped) {
        sections.push({
          section_label: sectionLabel,
          model_run_id: modelRunId,
          model_id: step.model_id,
          model_version: null,
          inputs: {},
          outputs: null,
          error: null,
          skipped: true,
        });
        continue;
      }

      // Resolve input mapping
      let resolvedInputs;
      try {
        resolvedInputs = resolveInputMap(step.input_map, intakeInputs);
      } catch (mapErr) {
        const errMsg = `Input mapping error for step "${modelRunId}": ${mapErr.message}`;
        if (onError === 'abort') {
          throw new PlaybookExecutionError(errMsg, {
            playbook_id: playbook.id,
            model_run_id: modelRunId,
          });
        }
        sections.push({
          section_label: sectionLabel,
          model_run_id: modelRunId,
          model_id: step.model_id,
          model_version: null,
          inputs: {},
          outputs: null,
          error: errMsg,
          skipped: false,
        });
        continue;
      }

      // Load and execute the model
      let modelManifest = null;
      let outputs = null;
      let stepError = null;

      try {
        const modelDir = path.join(this.modelsDir, step.model_id);
        const { manifest, execute } = loadModel(modelDir);
        modelManifest = manifest;

        // Validate resolved inputs against the model's declared schema
        const validation = validateInputs(manifest, resolvedInputs);
        if (!validation.valid) {
          throw new Error(
            `Input validation failed: ${validation.errors.join('; ')}`
          );
        }

        const logicCode = fs.readFileSync(
          path.join(path.resolve(modelDir), 'logic.js'),
          'utf8'
        );

        outputs = sandbox.execute(logicCode, resolvedInputs);
      } catch (execErr) {
        stepError = execErr.message;

        if (onError === 'abort') {
          throw new PlaybookExecutionError(
            `Step "${modelRunId}" failed: ${execErr.message}`,
            {
              playbook_id: playbook.id,
              model_run_id: modelRunId,
              model_id: step.model_id,
            }
          );
        }
      }

      sections.push({
        section_label: sectionLabel,
        model_run_id: modelRunId,
        model_id: step.model_id,
        model_version: modelManifest ? modelManifest.version : null,
        inputs: resolvedInputs,
        outputs: stepError ? null : outputs,
        error: stepError || null,
        skipped: false,
      });
    }

    // --- Build summary ---
    const summary = this._buildSummary(sections);

    return {
      playbook_id: playbook.id,
      playbook_version: String(playbook.version),
      intake_inputs: intakeInputs,
      executed_at: new Date().toISOString(),
      sections,
      summary,
    };
  }

  /**
   * Validates intake inputs against the playbook's intake_fields schema.
   *
   * @param {Array}  intakeFields - Declared intake field definitions.
   * @param {object} inputs       - User-supplied intake values.
   * @returns {string[]} Array of error messages (empty if valid).
   */
  _validateIntakeInputs(intakeFields, inputs) {
    const errors = [];

    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
      return ['intakeInputs must be a plain object'];
    }

    for (const fieldDef of intakeFields) {
      const { id, type } = fieldDef;

      if (!(id in inputs)) {
        errors.push(`Missing required intake field: "${id}"`);
        continue;
      }

      const value = inputs[id];

      if (type === 'number') {
        if (typeof value !== 'number' || !isFinite(value)) {
          errors.push(
            `Intake field "${id}" must be a finite number, got ${typeof value}`
          );
        }
      } else if (type === 'string') {
        if (typeof value !== 'string') {
          errors.push(
            `Intake field "${id}" must be a string, got ${typeof value}`
          );
        }
      } else if (type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(
            `Intake field "${id}" must be a boolean, got ${typeof value}`
          );
        }
      }
    }

    return errors;
  }

  /**
   * Builds a high-level summary from the completed section results.
   *
   * @param {Array} sections
   * @returns {object}
   */
  _buildSummary(sections) {
    const total = sections.length;
    const executed = sections.filter((s) => !s.skipped && !s.error).length;
    const skipped = sections.filter((s) => s.skipped).length;
    const failed = sections.filter((s) => !s.skipped && s.error !== null).length;

    return {
      total_steps: total,
      executed,
      skipped,
      failed,
      success: failed === 0,
    };
  }
}

module.exports = { PlaybookRunner, PlaybookExecutionError, evaluateSafeExpression };
