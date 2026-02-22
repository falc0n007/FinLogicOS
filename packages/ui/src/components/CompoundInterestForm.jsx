/**
 * Minimal, focused input form for the Compound Interest Growth model.
 * Keeps principal, rate, and years upfront; optional fields compact.
 */

function CompoundInterestForm({ values, onChange, errors }) {
  const principal = values.principal ?? '';
  const annualRate = values.annualRate ?? '';
  const years = values.years ?? '';
  const monthlyContribution = values.monthlyContribution ?? '';
  const compoundingFrequency = values.compoundingFrequency ?? 'monthly';

  return (
    <div className="compound-interest-form">
      <div className="compound-interest-row compound-interest-row--main">
        <div className="compound-interest-field">
          <label htmlFor="field-principal" className="compound-interest-label">
            Principal
          </label>
          <input
            id="field-principal"
            type="number"
            className="form-input compound-interest-input"
            placeholder="10,000"
            value={principal}
            onChange={(e) => onChange('principal', e.target.value)}
            step="any"
            min="0"
            aria-invalid={Boolean(errors?.principal)}
            aria-describedby={errors?.principal ? 'field-principal-err' : undefined}
          />
          {errors?.principal && (
            <span id="field-principal-err" className="compound-interest-error" role="alert">
              {errors.principal}
            </span>
          )}
        </div>
        <div className="compound-interest-field">
          <label htmlFor="field-annualRate" className="compound-interest-label">
            Rate (%)
          </label>
          <input
            id="field-annualRate"
            type="number"
            className="form-input compound-interest-input"
            placeholder="7"
            value={annualRate}
            onChange={(e) => onChange('annualRate', e.target.value)}
            step="any"
            min="0"
            aria-invalid={Boolean(errors?.annualRate)}
            aria-describedby={errors?.annualRate ? 'field-annualRate-err' : undefined}
          />
          {errors?.annualRate && (
            <span id="field-annualRate-err" className="compound-interest-error" role="alert">
              {errors.annualRate}
            </span>
          )}
        </div>
        <div className="compound-interest-field">
          <label htmlFor="field-years" className="compound-interest-label">
            Years
          </label>
          <input
            id="field-years"
            type="number"
            className="form-input compound-interest-input"
            placeholder="20"
            value={years}
            onChange={(e) => onChange('years', e.target.value)}
            step="1"
            min="1"
            aria-invalid={Boolean(errors?.years)}
            aria-describedby={errors?.years ? 'field-years-err' : undefined}
          />
          {errors?.years && (
            <span id="field-years-err" className="compound-interest-error" role="alert">
              {errors.years}
            </span>
          )}
        </div>
      </div>
      <div className="compound-interest-row compound-interest-row--optional">
        <span className="compound-interest-optional-label">Optional</span>
        <div className="compound-interest-field compound-interest-field--contribution">
          <label htmlFor="field-monthlyContribution" className="compound-interest-label">
            Monthly contribution
          </label>
          <input
            id="field-monthlyContribution"
            type="number"
            className="form-input compound-interest-input"
            placeholder="0"
            value={monthlyContribution}
            onChange={(e) => onChange('monthlyContribution', e.target.value)}
            step="any"
            min="0"
          />
        </div>
        <div className="compound-interest-field compound-interest-field--frequency">
          <label htmlFor="field-compoundingFrequency" className="compound-interest-label">
            Compounding
          </label>
          <select
            id="field-compoundingFrequency"
            className="form-select compound-interest-select"
            value={compoundingFrequency}
            onChange={(e) => onChange('compoundingFrequency', e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default CompoundInterestForm;
