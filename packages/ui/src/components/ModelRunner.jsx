import { useState } from 'react';
import ResultsDisplay from './ResultsDisplay.jsx';
import { IconArrowLeft } from '../icons/IconArrowLeft.jsx';
import { IconPlay } from '../icons/IconPlay.jsx';

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

export default function ModelRunner({ model, results, onResults, onBack }) {
  const [values, setValues] = useState(() => buildInitialValues(model.inputs));
  const [errors, setErrors] = useState({});
  const [runError, setRunError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

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
      onResults(output);
    } catch (err) {
      setRunError(err.message ?? 'An unexpected error occurred.');
    } finally {
      setIsRunning(false);
    }
  }

  function handleReset() {
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
          All Models
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

            {model.inputs.map((input) => (
              <FormField
                key={input.id}
                input={input}
                value={values[input.id] ?? ''}
                onChange={handleChange}
                error={errors[input.id]}
              />
            ))}
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
