import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Playbook intake field definitions — hardcoded browser-side equivalents
 * of the playbook.yaml intake_fields for each playbook.
 */
const PLAYBOOK_INTAKE = {
  'playbook-home-purchase': {
    name: 'Home Purchase Playbook',
    fields: [
      { id: 'annual_income', label: 'Annual gross household income', type: 'number', required: true },
      { id: 'monthly_expenses', label: 'Monthly essential expenses', type: 'number', required: true },
      { id: 'total_savings', label: 'Total liquid savings', type: 'number', required: true },
      { id: 'target_home_price', label: 'Target home price', type: 'number', required: true },
      { id: 'down_payment_pct', label: 'Down payment %', type: 'number', default: 20 },
      { id: 'mortgage_rate', label: '30-year fixed rate (%)', type: 'number', required: true },
      { id: 'monthly_rent', label: 'Current monthly rent', type: 'number', required: true },
      { id: 'state', label: 'State', type: 'string', required: true },
    ],
  },
  'playbook-new-child': {
    name: 'New Child Playbook',
    fields: [
      { id: 'annual_income', label: 'Annual household income', type: 'number', required: true },
      { id: 'monthly_expenses', label: 'Monthly expenses', type: 'number', required: true },
      { id: 'current_life_insurance_coverage', label: 'Life insurance coverage', type: 'number', required: true },
      { id: 'number_of_children_after', label: 'Total children after', type: 'number', required: true },
      { id: 'childcare_cost_monthly', label: 'Monthly childcare cost', type: 'number', required: true },
      { id: 'parental_leave_weeks_paid', label: 'Paid leave weeks', type: 'number', required: true },
      { id: 'parental_leave_weeks_unpaid', label: 'Unpaid leave weeks', type: 'number', default: 0 },
      { id: 'state', label: 'State', type: 'string', required: true },
    ],
  },
  'playbook-freelance-launch': {
    name: 'Freelance Launch Playbook',
    fields: [
      { id: 'projected_freelance_revenue', label: 'Projected freelance revenue', type: 'number', required: true },
      { id: 'current_employed_salary', label: 'Current salary', type: 'number', required: true },
      { id: 'filing_status', label: 'Filing status', type: 'enum', options: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'], required: true },
      { id: 'state', label: 'State', type: 'string', required: true },
      { id: 'current_emergency_fund', label: 'Emergency fund balance', type: 'number', required: true },
      { id: 'current_monthly_expenses', label: 'Monthly expenses', type: 'number', required: true },
      { id: 'current_health_insurance_cost', label: 'Health insurance cost/mo', type: 'number', required: true },
      { id: 'freelance_business_expenses', label: 'Annual business expenses', type: 'number', default: 0 },
    ],
  },
  'playbook-inheritance': {
    name: 'Inheritance Playbook',
    fields: [
      { id: 'inheritance_amount', label: 'Inheritance amount', type: 'number', required: true },
      { id: 'asset_type', label: 'Asset type', type: 'enum', options: ['cash', 'brokerage', 'ira', 'real_estate', 'business'], required: true },
      { id: 'filing_status', label: 'Filing status', type: 'enum', options: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'], required: true },
      { id: 'state', label: 'State', type: 'string', required: true },
      { id: 'relationship_to_decedent', label: 'Relationship', type: 'enum', options: ['spouse', 'child', 'sibling', 'other_relative', 'non_relative'], required: true },
      { id: 'annual_income', label: 'Annual income', type: 'number', required: true },
    ],
  },
};

export default function PlaybookIntakeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const playbook = PLAYBOOK_INTAKE[id];

  const [values, setValues] = useState(() => {
    if (!playbook) return {};
    const init = {};
    for (const f of playbook.fields) {
      init[f.id] = f.default !== undefined ? String(f.default) : '';
    }
    return init;
  });

  if (!playbook) {
    return (
      <div className="playbook-intake-page">
        <button type="button" className="btn-back" onClick={() => navigate('/strategy')}>
          <svg className="btn-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Playbooks
        </button>
        <div className="empty-state">
          <p className="empty-state-text">Playbook not found.</p>
        </div>
      </div>
    );
  }

  const allRequiredFilled = playbook.fields
    .filter((f) => f.required)
    .every((f) => values[f.id] && values[f.id].trim() !== '');

  function handleChange(fieldId, value) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleRun(e) {
    e.preventDefault();
    // Store intake inputs and navigate to report (placeholder for now)
    const intakeKey = `finlogic-playbook-intake-${id}`;
    const coerced = {};
    for (const f of playbook.fields) {
      const raw = values[f.id];
      if (f.type === 'number') {
        coerced[f.id] = raw !== '' ? parseFloat(raw) : (f.default ?? null);
      } else {
        coerced[f.id] = raw || (f.default ?? null);
      }
    }
    localStorage.setItem(intakeKey, JSON.stringify(coerced));
    navigate(`/strategy/playbooks/${id}/report`);
  }

  return (
    <div className="playbook-intake-page">
      <button type="button" className="btn-back" onClick={() => navigate('/strategy')}>
        <svg className="btn-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Playbooks
      </button>

      <div className="playbook-intake-header">
        <h2 className="page-title">{playbook.name}</h2>
        <p className="playbook-intake-subtitle">Fill in the fields below, then run the playbook.</p>
      </div>

      <form onSubmit={handleRun} className="playbook-intake-form">
        <div className="playbook-intake-fields">
          {playbook.fields.map((field) => (
            <div key={field.id} className="form-field">
              <label htmlFor={`pb-${field.id}`} className="form-label">
                {field.label}
                {field.required && <span className="form-required" aria-hidden="true"> *</span>}
              </label>
              {field.type === 'enum' ? (
                <select
                  id={`pb-${field.id}`}
                  className="form-select"
                  value={values[field.id]}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`pb-${field.id}`}
                  className="form-input"
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={values[field.id]}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  step={field.type === 'number' ? 'any' : undefined}
                  placeholder={field.default !== undefined ? String(field.default) : ''}
                />
              )}
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={!allRequiredFilled}>
            Run Playbook
          </button>
        </div>
      </form>
    </div>
  );
}
