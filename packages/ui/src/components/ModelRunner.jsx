import { useState, useEffect, useRef } from 'react';
import ResultsDisplay from './ResultsDisplay.jsx';
import { IconArrowLeft } from '../icons/IconArrowLeft.jsx';
import { IconPlay } from '../icons/IconPlay.jsx';
import DebtListInput from './DebtListInput.jsx';
import CompoundInterestForm from './CompoundInterestForm.jsx';
import {
  getCachedInputs,
  setCachedInputs,
  clearCachedInputs,
  mergeCachedWithDefaults,
} from '../data/inputCache.js';

// ---------------------------------------------------------------------------
// Build the initial form state from the model's input schema
// ---------------------------------------------------------------------------

function buildInitialValues(inputs) {
  const values = {};
  for (const input of inputs) {
    if (input.default !== undefined) {
      values[input.id] = String(input.default);
    } else if (input.type === 'enum') {
      values[input.id] = input.values[0];
    } else {
      values[input.id] = '';
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Coerce form string values to the types the model logic expects
// ---------------------------------------------------------------------------

function coerceValues(inputs, rawValues) {
  const coerced = {};
  for (const input of inputs) {
    const raw = rawValues[input.id];
    if (input.type === 'number') {
      coerced[input.id] = raw === '' ? (input.default ?? 0) : Number(raw);
    } else if (input.type === 'debt-list') {
      coerced[input.id] = raw || '[]';
    } else {
      coerced[input.id] = raw;
    }
  }
  return coerced;
}

// ---------------------------------------------------------------------------
// Individual field renderer
// ---------------------------------------------------------------------------

function FormField({ input, value, onChange, error }) {
  const fieldId = `field-${input.id}`;
  const hasError = Boolean(error);

  return (
    <div className={`form-field${hasError ? ' form-field--error' : ''}`}>
      <label htmlFor={fieldId} className="form-label">
        {input.label}
        {input.required && <span className="form-required" aria-label="required"> *</span>}
      </label>

      {input.type === 'enum' && (
        <select
          id={fieldId}
          className="form-select"
          value={value}
          onChange={(e) => onChange(input.id, e.target.value)}
          aria-describedby={`${fieldId}-desc`}
        >
          {input.values.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )}

      {input.type === 'debt-list' && (
        <DebtListInput value={value} onChange={onChange} inputId={input.id} />
      )}

      {input.type === 'textarea' && (
        <textarea
          id={fieldId}
          className="form-textarea"
          value={value}
          onChange={(e) => onChange(input.id, e.target.value)}
          rows={4}
          placeholder={input.placeholder ?? ''}
          aria-describedby={`${fieldId}-desc`}
          spellCheck={false}
        />
      )}

      {(input.type === 'number' || input.type === 'text') && (
        <input
          id={fieldId}
          className="form-input"
          type={input.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(input.id, e.target.value)}
          placeholder={input.placeholder ?? ''}
          aria-describedby={`${fieldId}-desc`}
          step={input.type === 'number' ? 'any' : undefined}
        />
      )}

      {input.description && (
        <p id={`${fieldId}-desc`} className="form-hint">
          {input.description}
        </p>
      )}

      {hasError && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CACHE_DEBOUNCE_MS = 600;
const COMPOUND_INTEREST_RUN_DEBOUNCE_MS = 280;

export default function ModelRunner({
  model,
  results,
  onResults,
  onBack,
  prefillValues = null,
}) {
  const defaults = buildInitialValues(model.inputs);
  const [values, setValues] = useState(() =>
    mergeCachedWithDefaults(model.inputs, getCachedInputs(model.id), defaults)
  );
  const [errors, setErrors] = useState({});
  const [runError, setRunError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const cacheTimeoutRef = useRef(null);
  const autoRunTimeoutRef = useRef(null);

  useEffect(() => {
    if (!prefillValues) return;
    setValues((prev) => ({ ...prev, ...prefillValues }));
  }, [prefillValues]);

  // Persist inputs to localStorage (debounced) so partial fills survive refresh
  useEffect(() => {
    if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    cacheTimeoutRef.current = setTimeout(() => {
      setCachedInputs(model.id, values);
      cacheTimeoutRef.current = null;
    }, CACHE_DEBOUNCE_MS);
    return () => {
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    };
  }, [model.id, values]);

  // Compound interest: run model when inputs change so the graph updates without clicking Run
  useEffect(() => {
    if (model.id !== 'compound-interest-growth') return;

    if (autoRunTimeoutRef.current) clearTimeout(autoRunTimeoutRef.current);
    autoRunTimeoutRef.current = setTimeout(() => {
      autoRunTimeoutRef.current = null;

      const validationErrors = {};
      for (const input of model.inputs) {
        const raw = values[input.id];
        if (input.required) {
          if (raw === '' || raw === undefined || raw === null) {
            validationErrors[input.id] = `${input.label} is required.`;
          } else if (input.type === 'number' && isNaN(Number(raw))) {
            validationErrors[input.id] = `${input.label} must be a valid number.`;
          }
        }
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});
      setRunError(null);
      try {
        const coerced = coerceValues(model.inputs, values);
        const output = model.run(coerced);
        onResults(output);
      } catch (err) {
        setRunError(err.message ?? 'An unexpected error occurred.');
      }
    }, COMPOUND_INTEREST_RUN_DEBOUNCE_MS);

    return () => {
      if (autoRunTimeoutRef.current) clearTimeout(autoRunTimeoutRef.current);
    };
  }, [model.id, model.inputs, model.run, values, onResults]);

  function handleChange(id, value) {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function validate() {
    const nextErrors = {};
    for (const input of model.inputs) {
      const raw = values[input.id];
      if (input.required) {
        if (raw === '' || raw === undefined || raw === null) {
          nextErrors[input.id] = `${input.label} is required.`;
        } else if (input.type === 'number' && isNaN(Number(raw))) {
          nextErrors[input.id] = `${input.label} must be a valid number.`;
        }
      }
    }
    return nextErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setRunError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsRunning(true);
    try {
      const coerced = coerceValues(model.inputs, values);
      const output = model.run(coerced);
      setCachedInputs(model.id, values);
      onResults(output);
    } catch (err) {
      setRunError(err.message ?? 'An unexpected error occurred.');
    } finally {
      setIsRunning(false);
    }
  }

  function handleReset() {
    clearCachedInputs(model.id);
    setValues(buildInitialValues(model.inputs));
    setErrors({});
    setRunError(null);
    onResults(null);
  }

  return (
    <div className="model-runner">
      <div className="runner-header">
        <button className="btn-back" onClick={onBack} aria-label="Back to model list">
          <IconArrowLeft className="btn-back-icon" aria-hidden="true" />
          All Simulations
        </button>
        <div className="runner-title-group">
          <h2 className="runner-title">{model.name}</h2>
          <span className={`model-card-badge model-card-badge--${model.category}`}>
            {model.category}
          </span>
        </div>
        <p className="runner-description">{model.description}</p>
      </div>

      <div className="runner-body">
        <form
          className="runner-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label={`${model.name} input form`}
        >
          <fieldset className="form-fieldset">
            <legend className="form-legend">Model Inputs</legend>

            {model.id === 'compound-interest-growth' ? (
              <CompoundInterestForm
                values={values}
                onChange={handleChange}
                errors={errors}
              />
            ) : (
              model.inputs.map((input) => (
                <FormField
                  key={input.id}
                  input={input}
                  value={values[input.id] ?? ''}
                  onChange={handleChange}
                  error={errors[input.id]}
                />
              ))
            )}
          </fieldset>

          {runError && (
            <div className="run-error" role="alert">
              <strong>Error:</strong> {runError}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={isRunning}
              aria-busy={isRunning}
            >
              <IconPlay className="btn-icon" aria-hidden="true" />
              {isRunning ? 'Running…' : 'Run Model'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </form>

        {results && (
          <div className="runner-results">
            <ResultsDisplay model={model} results={results} />
          </div>
        )}
      </div>
    </div>
  );
}
