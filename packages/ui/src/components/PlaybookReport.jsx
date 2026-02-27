import { useParams, useNavigate } from 'react-router-dom';

/**
 * PlaybookReport — displays the results of running a playbook.
 * Currently shows a placeholder since the playbook model packs
 * referenced by the playbooks are not yet implemented in the browser.
 */
export default function PlaybookReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const intakeKey = `finlogic-playbook-intake-${id}`;
  const rawIntake = localStorage.getItem(intakeKey);
  const intake = rawIntake ? JSON.parse(rawIntake) : null;

  if (!intake) {
    return (
      <div className="playbook-report-page">
        <p>No intake data found. Please fill in the playbook form first.</p>
        <button className="btn btn-secondary" onClick={() => navigate(`/playbooks/${id}`)}>
          Go to Intake Form
        </button>
      </div>
    );
  }

  const playbookName = id
    .replace('playbook-', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="playbook-report-page">
      <button className="btn btn-secondary" onClick={() => navigate('/playbooks')}>
        Back to Playbooks
      </button>

      <h2>{playbookName} Report</h2>

      <div className="playbook-report-notice">
        <p>
          Playbook model execution is available in the CLI via the PlaybookRunner.
          Browser-side execution requires implementing browser-compatible versions
          of each playbook model pack.
        </p>
      </div>

      <div className="playbook-report-intake">
        <h3>Your Inputs</h3>
        <table className="playbook-intake-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(intake).map(([key, value]) => (
              <tr key={key}>
                <td>{key.replace(/_/g, ' ')}</td>
                <td>
                  {typeof value === 'number'
                    ? value.toLocaleString('en-US')
                    : String(value ?? '-')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="playbook-report-actions">
        <h3>Next Steps</h3>
        <p>
          Use the CLI to run this playbook with full model execution:
        </p>
        <code className="playbook-cli-hint">
          finlogic playbook run {id}
        </code>
      </div>
    </div>
  );
}
