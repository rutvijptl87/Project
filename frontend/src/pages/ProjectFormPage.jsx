import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save } from 'lucide-react';
import InlinePicker from '../components/InlinePicker';

const ProjectFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [architects, setArchitects] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [form, setForm] = useState({
    name: '',
    job_no: '',
    client_id: '',
    architect_id: '',
    site_location: '',
    quoted_amount: 0,
    status: 'Outstanding',
    notes: '',
    assigned_engineer_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    (async () => {
      const [c, a, u] = await Promise.all([
        api.get('/clients'),
        api.get('/architects'),
        api.get('/auth/users/directory').catch(() => ({ data: [] })),
      ]);
      setClients(c.data);
      setArchitects(a.data);
      setEngineers((u.data || []).filter((x) => x.role === 'engineer' || x.role === 'draftsman'));
      if (isEdit) {
        try {
          const r = await api.get(`/projects/${id}`);
          const p = r.data;
          setForm({
            name: p.name || '',
            job_no: p.job_no || '',
            client_id: p.client_id || '',
            architect_id: p.architect_id || '',
            site_location: p.site_location || '',
            quoted_amount: p.quoted_amount || 0,
            status: p.status || 'Outstanding',
            notes: p.notes || '',
            assigned_engineer_ids: p.assigned_engineer_ids || [],
          });
        } catch (e) {
          setError('Could not load project');
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [id, isEdit]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Job Number is required');
    setSaving(true);
    try {
      const jobNumber = form.name.trim();
      const payload = {
        name: jobNumber,
        // Mirror the entered job number into job_no so Site Visit auto-fill
        // and existing job_no-based search keep working.
        job_no: jobNumber,
        client_id: form.client_id || null,
        architect_id: form.architect_id || null,
        site_location: form.site_location,
        quoted_amount: parseFloat(form.quoted_amount || 0),
        status: form.status,
        notes: form.notes,
        assigned_engineer_ids: form.assigned_engineer_ids || [],
      };
      if (isEdit) await api.put(`/projects/${id}`, payload);
      else await api.post('/projects', payload);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-8">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="project-form-page">
      <Link to="/" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3" data-testid="btn-back">
        <ArrowLeft size={14} /> Back to Projects
      </Link>
      <h1 className="font-head text-3xl font-extrabold mb-1" style={{ color: 'var(--cc-dark-green)' }}>
        {isEdit ? 'Edit Project' : 'New Project'}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>Fill in the details below. Project ID is auto-generated.</p>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4" data-testid="project-form">
        <div>
          <label className="label">Job Number *</label>
          <input className="input" inputMode="numeric" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. 3324" data-testid="form-name" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Client</label>
            <InlinePicker
              entityType="client"
              value={form.client_id}
              onChange={(v) => update('client_id', v)}
              items={clients}
              onItemsChange={setClients}
              testIdPrefix="project-form-client-"
            />
          </div>
          <div>
            <label className="label">Architect</label>
            <InlinePicker
              entityType="architect"
              value={form.architect_id}
              onChange={(v) => update('architect_id', v)}
              items={architects}
              onItemsChange={setArchitects}
              testIdPrefix="project-form-architect-"
            />
          </div>
        </div>

        <div>
          <label className="label">Site Location</label>
          <textarea className="textarea" rows={2} value={form.site_location} onChange={(e) => update('site_location', e.target.value)} placeholder="Plot No - ... MIDC, ..." data-testid="form-site" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Quoted Amount (₹)</label>
            <input type="number" step="0.01" className="input" value={form.quoted_amount} onChange={(e) => update('quoted_amount', e.target.value)} data-testid="form-quoted" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)} data-testid="form-status">
              <option value="Outstanding">Outstanding</option>
              <option value="Settled">Settled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Assigned Site Engineers</label>
          {engineers.length === 0 ? (
            <div className="text-xs italic p-2 rounded" style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }}>
              No engineer users yet. Add one from Settings → User Management with role "Site Engineer".
            </div>
          ) : (
            <div className="rounded-md p-2 flex flex-wrap gap-2" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }} data-testid="assigned-engineers">
              {engineers.map((e) => {
                const checked = form.assigned_engineer_ids.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer text-xs"
                    style={{
                      background: checked ? 'var(--cc-dark-green)' : 'white',
                      color: checked ? 'white' : 'var(--cc-text)',
                      border: '1px solid var(--cc-border)',
                    }}
                    data-testid={`engineer-chip-${e.username}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => update('assigned_engineer_ids',
                        checked
                          ? form.assigned_engineer_ids.filter((id) => id !== e.id)
                          : [...form.assigned_engineer_ids, e.id])}
                      className="hidden"
                    />
                    {checked ? '✓' : '+'} {e.username}
                  </label>
                );
              })}
            </div>
          )}
          <div className="text-[11px] mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            Engineers can only see projects they are assigned to. Leave empty to keep this project admin/draftsman-only.
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="textarea" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} data-testid="form-notes" />
        </div>

        {error && <div className="text-sm text-red-600" data-testid="form-error">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          <Link to="/" className="btn btn-outline" data-testid="btn-cancel">Cancel</Link>
          <button type="submit" disabled={saving} className="btn btn-primary" data-testid="btn-save-project">
            <Save size={15} /> {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Project')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectFormPage;
