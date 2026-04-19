import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save } from 'lucide-react';

const ProjectFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [architects, setArchitects] = useState([]);
  const [form, setForm] = useState({
    name: '',
    client_id: '',
    architect_id: '',
    site_location: '',
    quoted_amount: 0,
    status: 'Outstanding',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    (async () => {
      const [c, a] = await Promise.all([api.get('/clients'), api.get('/architects')]);
      setClients(c.data);
      setArchitects(a.data);
      if (isEdit) {
        try {
          const r = await api.get(`/projects/${id}`);
          const p = r.data;
          setForm({
            name: p.name || '',
            client_id: p.client_id || '',
            architect_id: p.architect_id || '',
            site_location: p.site_location || '',
            quoted_amount: p.quoted_amount || 0,
            status: p.status || 'Outstanding',
            notes: p.notes || '',
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
    if (!form.name.trim()) return setError('Project name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        client_id: form.client_id || null,
        architect_id: form.architect_id || null,
        site_location: form.site_location,
        quoted_amount: parseFloat(form.quoted_amount || 0),
        status: form.status,
        notes: form.notes,
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
          <label className="label">Project Name *</label>
          <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Acceptance & Supervision" data-testid="form-name" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Client</label>
            <select className="select" value={form.client_id} onChange={(e) => update('client_id', e.target.value)} data-testid="form-client">
              <option value="">None</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Link to="/clients" className="text-xs mt-1 inline-block" style={{ color: 'var(--cc-accent)' }}>+ Manage clients</Link>
          </div>
          <div>
            <label className="label">Architect</label>
            <select className="select" value={form.architect_id} onChange={(e) => update('architect_id', e.target.value)} data-testid="form-architect">
              <option value="">None</option>
              {architects.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Link to="/architects" className="text-xs mt-1 inline-block" style={{ color: 'var(--cc-accent)' }}>+ Manage architects</Link>
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
