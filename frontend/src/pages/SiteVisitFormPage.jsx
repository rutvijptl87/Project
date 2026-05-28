import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, API } from '../lib/api';
import { ArrowLeft, ImagePlus, Trash2, Plus, X, Save, FileText, Loader2, ClipboardList, Camera } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';

const COMPLIANCE = [
  { v: 'yes', label: 'Yes', cls: 'badge-settled', color: '#10B981' },
  { v: 'no', label: 'No', cls: 'badge-overdue', color: '#DC2626' },
  { v: 'na', label: 'N/A', cls: 'badge-pending', color: '#9CA3AF' },
];

const SiteVisitFormPage = () => {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const fileRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const blank = {
    template_id: '',
    template_name: '',
    job_no: '',
    project_id: '',
    inspection_title: '',
    visit_date: new Date().toISOString().slice(0, 10),
    customer: '',
    plot_no: '',
    drg_no: '',
    revision: '',
    checklist: [],
    observations: [],
    photos: [],
    engineer_name: '',
    engineer_signature: '',
    site_person_name: '',
    site_person_signature: '',
    status: 'submitted',
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([
          api.get('/site-visit-templates'),
          api.get('/projects', { params: { include_archived: false } }),
        ]);
        setTemplates(t.data || []);
        setProjects(p.data || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/site-visits/${id}`);
        setForm({ ...blank, ...r.data });
      } catch (e) {
        setError('Could not load this site visit');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [id]);

  const pickTemplate = (tid) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) {
      setForm((f) => ({ ...f, template_id: '', template_name: '' }));
      return;
    }
    setForm((f) => ({
      ...f,
      template_id: t.id,
      template_name: t.name,
      inspection_title: f.inspection_title || t.name,
      checklist: (t.checklist || []).map((label) => ({ label, compliance: 'yes', remark: '' })),
    }));
  };

  const updateChecklistItem = (idx, patch) => {
    setForm((f) => ({
      ...f,
      checklist: f.checklist.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };
  const addChecklistItem = () => setForm((f) => ({ ...f, checklist: [...f.checklist, { label: '', compliance: 'yes', remark: '' }] }));
  const removeChecklistItem = (idx) => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));

  const addObservation = () => setForm((f) => ({ ...f, observations: [...f.observations, ''] }));
  const updateObservation = (idx, val) => setForm((f) => ({ ...f, observations: f.observations.map((o, i) => (i === idx ? val : o)) }));
  const removeObservation = (idx) => setForm((f) => ({ ...f, observations: f.observations.filter((_, i) => i !== idx) }));

  const handlePhotoPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const r = await api.post('/site-visits/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setForm((f) => ({ ...f, photos: [...f.photos, { url: r.data.url, caption: '' }] }));
      } catch (err) {
        setError('Upload failed: ' + (err?.response?.data?.detail || err.message));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = (idx) => setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  const updatePhotoCaption = (idx, caption) => setForm((f) => ({ ...f, photos: f.photos.map((p, i) => (i === idx ? { ...p, caption } : p)) }));

  const canSubmit = useMemo(() => form.inspection_title.trim().length > 1, [form.inspection_title]);

  const onSubmit = async (status) => {
    if (!canSubmit) { setError('Inspection title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, status };
      const r = isEdit
        ? await api.put(`/site-visits/${id}`, payload)
        : await api.post('/site-visits', payload);
      nav(`/site-visits/${r.data.id}`);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-[900px] mx-auto px-4 py-8 text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>;
  }

  return (
    <div className="max-w-[900px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32" data-testid="site-visit-form-page">
      <button onClick={() => nav(-1)} className="text-sm flex items-center gap-1 mb-3 hover:underline" style={{ color: 'var(--cc-text-muted)' }} data-testid="btn-form-back">
        <ArrowLeft size={14}/> Back
      </button>

      <h1 className="font-head text-2xl sm:text-3xl font-extrabold mb-4" style={{ color: 'var(--cc-dark-green)' }}>
        {isEdit ? `Edit ${form.visit_code || 'Site Visit'}` : 'New Site Visit'}
      </h1>

      {error && (
        <div className="rounded-md p-2.5 text-sm mb-3" style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }} data-testid="form-error">{error}</div>
      )}

      {/* Template + project */}
      <div className="card p-4 mb-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Inspection Template</label>
            <select
              value={form.template_id || ''}
              onChange={(e) => pickTemplate(e.target.value)}
              className="select w-full mt-1"
              data-testid="select-template"
            >
              <option value="">— Free form (no template) —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.checklist?.length || 0})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Linked Project (optional)</label>
            <select
              value={form.project_id || ''}
              onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              className="select w-full mt-1"
              data-testid="select-project"
            >
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} · {p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="card p-4 mb-3">
        <h2 className="font-head text-sm font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Inspection Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Inspection Title *</label>
            <input className="input w-full mt-1" value={form.inspection_title} onChange={(e) => setForm({ ...form, inspection_title: e.target.value })} placeholder="e.g. Column casting at G+1 level" data-testid="input-title"/>
          </div>
          <div><label className="text-xs">Job No</label><input className="input w-full mt-1" value={form.job_no} onChange={(e) => setForm({ ...form, job_no: e.target.value })} data-testid="input-job-no"/></div>
          <div><label className="text-xs">Visit Date</label><input type="date" className="input w-full mt-1" value={(form.visit_date || '').slice(0, 10)} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} data-testid="input-visit-date"/></div>
          <div><label className="text-xs">Customer</label><input className="input w-full mt-1" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} data-testid="input-customer"/></div>
          <div><label className="text-xs">Plot No</label><input className="input w-full mt-1" value={form.plot_no} onChange={(e) => setForm({ ...form, plot_no: e.target.value })} data-testid="input-plot-no"/></div>
          <div><label className="text-xs">DRG No</label><input className="input w-full mt-1" value={form.drg_no} onChange={(e) => setForm({ ...form, drg_no: e.target.value })} data-testid="input-drg-no"/></div>
          <div><label className="text-xs">Revision</label><input className="input w-full mt-1" value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} data-testid="input-revision"/></div>
        </div>
      </div>

      {/* Checklist */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head text-sm font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}><ClipboardList size={15}/> Checklist</h2>
          <button type="button" onClick={addChecklistItem} className="btn btn-outline btn-sm" data-testid="btn-add-checklist"><Plus size={13}/> Add item</button>
        </div>
        {form.checklist.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--cc-text-muted)' }}>Pick a template above to auto-load checklist items, or click "Add item" for a free-form one.</p>
        ) : (
          <div className="space-y-2.5">
            {form.checklist.map((c, idx) => (
              <div key={idx} className="rounded-md p-2.5" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }} data-testid={`checklist-item-${idx}`}>
                <div className="flex items-start gap-2">
                  <input
                    className="input flex-1"
                    value={c.label}
                    onChange={(e) => updateChecklistItem(idx, { label: e.target.value })}
                    placeholder="Item description"
                    data-testid={`checklist-label-${idx}`}
                  />
                  <button type="button" onClick={() => removeChecklistItem(idx)} className="btn btn-outline btn-sm" title="Remove" data-testid={`checklist-remove-${idx}`}><Trash2 size={13}/></button>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--cc-border)' }}>
                    {COMPLIANCE.map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateChecklistItem(idx, { compliance: opt.v })}
                        className="px-3 py-1 text-xs font-semibold"
                        style={{
                          background: c.compliance === opt.v ? opt.color : 'transparent',
                          color: c.compliance === opt.v ? '#fff' : 'var(--cc-text)',
                        }}
                        data-testid={`checklist-compliance-${idx}-${opt.v}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input flex-1 min-w-[160px]"
                    value={c.remark || ''}
                    onChange={(e) => updateChecklistItem(idx, { remark: e.target.value })}
                    placeholder="Remark (optional)"
                    data-testid={`checklist-remark-${idx}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Observations */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head text-sm font-bold" style={{ color: 'var(--cc-dark-green)' }}>Observations</h2>
          <button type="button" onClick={addObservation} className="btn btn-outline btn-sm" data-testid="btn-add-observation"><Plus size={13}/> Add</button>
        </div>
        {form.observations.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--cc-text-muted)' }}>Free-text notes you want to record.</p>
        ) : (
          <div className="space-y-2">
            {form.observations.map((o, idx) => (
              <div key={idx} className="flex gap-2" data-testid={`observation-row-${idx}`}>
                <span className="text-xs mt-2.5 font-mono-data w-5 text-right">{idx + 1}.</span>
                <textarea
                  className="textarea flex-1"
                  rows={2}
                  value={o}
                  onChange={(e) => updateObservation(idx, e.target.value)}
                  placeholder="What did you observe?"
                  data-testid={`observation-text-${idx}`}
                />
                <button type="button" onClick={() => removeObservation(idx)} className="btn btn-outline btn-sm self-start mt-0.5" data-testid={`observation-remove-${idx}`}><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photos */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head text-sm font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}><Camera size={15}/> Photos</h2>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-accent btn-sm" data-testid="btn-add-photo"><ImagePlus size={13}/> Add photo</button>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotoPick} data-testid="input-photo-file"/>
        </div>
        {form.photos.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--cc-text-muted)' }}>Photos taken on site will show here. You can capture from camera or pick from gallery.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {form.photos.map((p, idx) => {
              const src = p.url ? `${process.env.REACT_APP_BACKEND_URL}${p.url}` : p.data_url;
              return (
                <div key={idx} className="rounded-md overflow-hidden relative group" style={{ border: '1px solid var(--cc-border)' }} data-testid={`photo-card-${idx}`}>
                  <img src={src} alt={`photo-${idx + 1}`} className="block w-full h-32 object-cover" />
                  <button type="button" onClick={() => removePhoto(idx)} className="absolute top-1 right-1 rounded-full p-1 shadow" style={{ background: 'rgba(220,38,38,0.92)', color: 'white' }} data-testid={`photo-remove-${idx}`}>
                    <X size={12}/>
                  </button>
                  <input
                    className="input w-full rounded-none border-x-0 border-b-0 text-xs"
                    value={p.caption || ''}
                    onChange={(e) => updatePhotoCaption(idx, e.target.value)}
                    placeholder="Caption…"
                    data-testid={`photo-caption-${idx}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Signatures */}
      <div className="card p-4 mb-3">
        <h2 className="font-head text-sm font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Signatures</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <input
              className="input w-full mb-2"
              value={form.engineer_name}
              onChange={(e) => setForm({ ...form, engineer_name: e.target.value })}
              placeholder="Structural engineer name"
              data-testid="input-engineer-name"
            />
            <SignaturePad
              value={form.engineer_signature}
              onChange={(v) => setForm((f) => ({ ...f, engineer_signature: v }))}
              label="Engineer signature"
              testId="sign-engineer"
            />
          </div>
          <div>
            <input
              className="input w-full mb-2"
              value={form.site_person_name}
              onChange={(e) => setForm({ ...form, site_person_name: e.target.value })}
              placeholder="Site person name"
              data-testid="input-site-person-name"
            />
            <SignaturePad
              value={form.site_person_signature}
              onChange={(v) => setForm((f) => ({ ...f, site_person_signature: v }))}
              label="Site person signature"
              testId="sign-site-person"
            />
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t" style={{ borderColor: 'var(--cc-border)' }}>
        <div className="max-w-[900px] mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2 justify-end">
          <button onClick={() => onSubmit('draft')} disabled={saving || !canSubmit} className="btn btn-outline" data-testid="btn-save-draft">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save draft
          </button>
          <button onClick={() => onSubmit('submitted')} disabled={saving || !canSubmit} className="btn btn-accent" data-testid="btn-submit-visit">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>} Submit & Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default SiteVisitFormPage;
