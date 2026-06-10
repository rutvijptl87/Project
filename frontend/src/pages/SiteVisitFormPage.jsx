import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, API } from '../lib/api';
import { ArrowLeft, ImagePlus, Trash2, Plus, X, Save, FileText, Loader2, ClipboardList, Camera, MapPin, LocateFixed, Search, Phone, Mail, MessageCircle } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { useAuth } from '../lib/auth';

const COMPLIANCE = [
  { v: 'yes', label: 'Yes', cls: 'badge-settled', color: '#10B981' },
  { v: 'no', label: 'No', cls: 'badge-overdue', color: '#DC2626' },
  { v: 'na', label: 'N/A', cls: 'badge-pending', color: '#9CA3AF' },
];

const SiteVisitFormPage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const presetProjectId = searchParams.get('project_id') || '';
  const isEdit = !!id;
  const fileRef = useRef(null);
  const galleryRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const blank = {
    template_id: '',
    template_name: '',
    job_no: '',
    project_id: presetProjectId,
    inspection_title: '',
    visit_date: new Date().toISOString().slice(0, 10),
    customer: '',
    plot_no: '',
    site_location: '',
    drg_no: '',
    revision: '',
    latitude: null,
    longitude: null,
    geo_accuracy: null,
    checklist: [],
    observations: [],
    photos: [],
    engineer_name: user?.username || '',
    engineer_signature: '',
    site_person_name: '',
    site_person_phone: '',
    site_person_signature: '',
    status: 'submitted',
  };
  const [form, setForm] = useState(blank);

  // Searchable project picker state
  const [projectSearch, setProjectSearch] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');

  // Last 4 digits of a project code (CC-0571 -> 0571). Falls back to the raw code.
  const codeTail = (code) => {
    const m = String(code || '').match(/(\d+)\s*$/);
    return m ? m[1] : (code || '');
  };

  // The "Job No" we surface on a site visit. Prefers the project's explicit
  // `job_no` field, falls back to the project name, then to the code tail.
  const jobNoFor = (p) =>
    (p?.job_no && String(p.job_no).trim()) ||
    (p?.name && String(p.name).trim()) ||
    codeTail(p?.project_code);

  const applyProject = (p) => {
    if (!p) {
      setForm((f) => ({ ...f, project_id: '', job_no: '' }));
      return;
    }
    setForm((f) => ({
      ...f,
      project_id: p.id,
      // Auto-fill the job number with the project's explicit job_no
      job_no: jobNoFor(p),
      // Auto-fill blanks (don't overwrite user-edited values)
      customer: f.customer || p.client_name || '',
      site_location: f.site_location || p.site_location || '',
    }));
    setProjectSearch('');
    setProjectPickerOpen(false);
  };

  // When the engineer types a job number, find the matching project by:
  //   1. exact match on project.job_no  (NEW — user-defined "3324")
  //   2. exact match on project.name    (older convention)
  //   3. 4-digit project_code tail      (legacy)
  // and auto-fill customer + site_location.
  const onJobNoChange = (val) => {
    setForm((f) => ({ ...f, job_no: val }));
    const tail = String(val || '').trim();
    if (!tail) return;
    const lc = tail.toLowerCase();
    const match = projects.find((p) =>
      ((p.job_no || '').trim().toLowerCase() === lc) ||
      ((p.name || '').trim().toLowerCase() === lc) ||
      (codeTail(p.project_code) === tail),
    );
    if (match) {
      setForm((f) => ({
        ...f,
        project_id: match.id,
        customer: match.client_name || f.customer,
        site_location: match.site_location || f.site_location,
      }));
    }
  };

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.project_id) || null,
    [projects, form.project_id],
  );

  const filteredProjects = useMemo(() => {
    const k = projectSearch.trim().toLowerCase();
    if (!k) return projects.slice(0, 50);
    return projects
      .filter((p) => [p.project_code, p.job_no, p.name, p.client_name, p.site_location].some((f) => (f || '').toLowerCase().includes(k)))
      .slice(0, 50);
  }, [projects, projectSearch]);

  const fetchGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsMsg('Geolocation not supported on this device');
      return;
    }
    setGpsBusy(true); setGpsMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setForm((f) => ({ ...f, latitude, longitude, geo_accuracy: accuracy }));
        setGpsBusy(false);
        setGpsMsg(`Located ±${Math.round(accuracy)} m`);
        setTimeout(() => setGpsMsg(''), 4000);
      },
      (err) => {
        setGpsBusy(false);
        setGpsMsg(err.code === 1 ? 'Permission denied — enable location in browser settings.' : (err.message || 'Could not get location'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

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

  // On NEW visits, pre-fill the engineer signature from their saved default
  // (managed in Settings → My Default Signature). On edit we keep whatever the
  // visit already has.
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      try {
        const r = await api.get('/auth/me');
        const sig = r.data?.default_signature;
        if (sig) {
          setForm((f) => (f.engineer_signature ? f : { ...f, engineer_signature: sig }));
        }
      } catch {}
    })();
    // eslint-disable-next-line
  }, [isEdit]);

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

  // Resize an image File to max 1280px on the longest edge, JPEG q=0.82,
  // then burn a watermark (engineer name + ISO timestamp) into the bottom-right
  // so site photos are tamper-evident. Big phone photos (5-8MB) become 200-400KB.
  const compressImage = (file) => new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = width > height ? MAX / width : MAX / height;
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // ---- Watermark (engineer name + timestamp, bottom-right) ----
        try {
          const eng = (form.engineer_name || '').trim() || user?.username || 'Site Engineer';
          const now = new Date();
          const ts = now.toISOString().replace('T', ' ').slice(0, 16);
          const line1 = eng.length > 28 ? eng.slice(0, 28) + '…' : eng;
          const line2 = ts;

          // Font sized to image width so the badge stays readable
          const baseFont = Math.max(12, Math.round(width * 0.018));
          ctx.font = `600 ${baseFont}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          const padX = 10, padY = 6, gap = 2;
          const w1 = ctx.measureText(line1).width;
          const w2 = ctx.measureText(line2).width;
          const boxW = Math.max(w1, w2) + padX * 2;
          const boxH = baseFont * 2 + gap + padY * 2;
          const x = width - boxW - 12;
          const y = height - boxH - 12;

          // Translucent dark backdrop
          ctx.fillStyle = 'rgba(10, 46, 31, 0.7)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, 8);
          else ctx.rect(x, y, boxW, boxH);
          ctx.fill();

          // Subtle white border
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.textBaseline = 'top';
          ctx.fillText(line1, x + padX, y + padY);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = `400 ${baseFont}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.fillText(line2, x + padX, y + padY + baseFont + gap);
        } catch (_e) { /* if watermark fails (e.g. very small canvas), just skip it */ }

        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          const newName = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], newName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });

  // Returns a Promise<GeolocationCoordinates | null> resolved within ~6s.
  // Used per-photo so each shot has its own lat/lng (more granular than the visit-level GPS).
  const getOneShotGps = () => new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 6000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (done) return; done = true; clearTimeout(t); resolve(pos.coords); },
      () => { if (done) return; done = true; clearTimeout(t); resolve(null); },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
  });

  const handlePhotoPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const original of files) {
      try {
        const [file, coords] = await Promise.all([
          compressImage(original),
          // Don't bother re-asking if the visit already has GPS — re-use it as the baseline.
          form.latitude != null
            ? Promise.resolve({ latitude: form.latitude, longitude: form.longitude, accuracy: form.geo_accuracy })
            : getOneShotGps(),
        ]);
        const fd = new FormData();
        fd.append('file', file);
        const r = await api.post('/site-visits/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const photo = {
          url: r.data.url,
          caption: '',
          captured_at: new Date().toISOString(),
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          geo_accuracy: coords?.accuracy ?? null,
        };
        // If the visit doesn't have a GPS yet, promote the first photo's location to it.
        setForm((f) => {
          const promote = f.latitude == null && coords;
          return {
            ...f,
            photos: [...f.photos, photo],
            latitude: promote ? coords.latitude : f.latitude,
            longitude: promote ? coords.longitude : f.longitude,
            geo_accuracy: promote ? coords.accuracy : f.geo_accuracy,
          };
        });
      } catch (err) {
        setError('Upload failed: ' + (err?.response?.data?.detail || err.message));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
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
            <div className="relative mt-1" data-testid="project-picker-wrap">
              <button
                type="button"
                onClick={() => setProjectPickerOpen((o) => !o)}
                className="input w-full text-left flex items-center justify-between"
                data-testid="select-project"
              >
                <span className={selectedProject ? '' : 'opacity-60'}>
                  {selectedProject
                    ? `${codeTail(selectedProject.project_code)} · ${selectedProject.job_no || selectedProject.name}`
                    : '— Select project —'}
                </span>
                <Search size={13} style={{ color: 'var(--cc-text-muted)' }}/>
              </button>
              {projectPickerOpen && (
                <div
                  className="absolute z-30 mt-1 w-full rounded-md shadow-lg overflow-hidden"
                  style={{ background: 'white', border: '1px solid var(--cc-border)' }}
                  data-testid="project-picker-dropdown"
                >
                  <div className="p-2 border-b" style={{ borderColor: 'var(--cc-border)' }}>
                    <input
                      autoFocus
                      type="text"
                      className="input w-full"
                      placeholder="Search by job no, name, customer, site…"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      data-testid="project-picker-search"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {selectedProject && (
                      <button type="button" onClick={() => applyProject(null)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-emerald-50" style={{ color: '#B91C1C' }} data-testid="project-picker-clear">— Clear selection —</button>
                    )}
                    {filteredProjects.length === 0 ? (
                      <div className="px-3 py-3 text-xs italic text-center" style={{ color: 'var(--cc-text-muted)' }}>No projects match.</div>
                    ) : (
                      filteredProjects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyProject(p)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 border-b"
                          style={{ borderColor: 'var(--cc-border)' }}
                          data-testid={`project-picker-option-${codeTail(p.project_code)}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono-data font-bold" style={{ color: 'var(--cc-dark-green)' }}>{codeTail(p.project_code)}</span>
                            {p.job_no && <span className="font-mono-data text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--cc-surface)', color: 'var(--cc-accent)' }}>Job {p.job_no}</span>}
                            <span className="truncate">{p.name}</span>
                          </div>
                          {(p.client_name || p.site_location) && (
                            <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--cc-text-muted)' }}>
                              {p.client_name}{p.client_name && p.site_location ? ' · ' : ''}{p.site_location}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="card p-4 mb-3">
        <h2 className="font-head text-sm font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Inspection Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Inspection Title *</label>
            <input className="input w-full mt-1" value={form.inspection_title} onChange={(e) => setForm({ ...form, inspection_title: e.target.value })} placeholder="e.g. Column casting at G+1 level" data-testid="input-inspection-title"/>
          </div>
          <div>
            <label className="text-xs">Job No <span style={{ color: 'var(--cc-text-muted)' }}>(type 4-digit to auto-fill)</span></label>
            <input className="input w-full mt-1" inputMode="numeric" placeholder="e.g. 0571" value={form.job_no} onChange={(e) => onJobNoChange(e.target.value)} data-testid="input-job-no"/>
          </div>
          <div><label className="text-xs">Visit Date</label><input type="date" className="input w-full mt-1" value={(form.visit_date || '').slice(0, 10)} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} data-testid="input-visit-date"/></div>
          <div>
            <label className="text-xs">Customer</label>
            <input className="input w-full mt-1" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Auto-filled from project" data-testid="input-customer"/>
            {selectedProject && (selectedProject.client_phone || selectedProject.client_email) && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5" data-testid="customer-contact-strip">
                {selectedProject.client_phone && (
                  <>
                    <a href={`tel:${selectedProject.client_phone}`} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full hover:underline" style={{ background: 'var(--cc-surface)', color: 'var(--cc-dark-green)' }} data-testid="customer-phone-call">
                      <Phone size={10}/> {selectedProject.client_phone}
                    </a>
                    <a href={`https://wa.me/${(selectedProject.client_phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full hover:underline" style={{ background: '#D1FAE5', color: '#065F46' }} data-testid="customer-phone-whatsapp">
                      <MessageCircle size={10}/> WhatsApp
                    </a>
                  </>
                )}
                {selectedProject.client_email && (
                  <a href={`mailto:${selectedProject.client_email}`} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full hover:underline" style={{ background: 'var(--cc-surface)', color: 'var(--cc-dark-green)' }} data-testid="customer-email-link">
                    <Mail size={10}/> {selectedProject.client_email}
                  </a>
                )}
              </div>
            )}
          </div>
          <div><label className="text-xs">Site Location</label><input className="input w-full mt-1" value={form.site_location} onChange={(e) => setForm({ ...form, site_location: e.target.value })} placeholder="Auto-filled from project" data-testid="input-site-location"/></div>
          <div><label className="text-xs">DRG No</label><input className="input w-full mt-1" value={form.drg_no} onChange={(e) => setForm({ ...form, drg_no: e.target.value })} data-testid="input-drg-no"/></div>
          <div><label className="text-xs">Revision</label><input className="input w-full mt-1" value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} data-testid="input-revision"/></div>

          {/* GPS row */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>GPS Location <span className="opacity-70">(stamped on PDF for proof-of-presence)</span></label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button
                type="button"
                onClick={fetchGps}
                disabled={gpsBusy}
                className="btn btn-outline btn-sm"
                data-testid="btn-fetch-gps"
              >
                {gpsBusy ? <Loader2 size={13} className="animate-spin"/> : <LocateFixed size={13}/>}
                {form.latitude != null ? 'Re-fetch GPS' : 'Fetch GPS'}
              </button>
              {form.latitude != null && form.longitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono-data hover:underline"
                  style={{ background: 'var(--cc-surface)', color: 'var(--cc-dark-green)' }}
                  data-testid="gps-coords-link"
                >
                  <MapPin size={11}/> {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                  {form.geo_accuracy != null && <span style={{ color: 'var(--cc-text-muted)' }}>· ±{Math.round(form.geo_accuracy)}m</span>}
                </a>
              )}
              {form.latitude != null && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, latitude: null, longitude: null, geo_accuracy: null }))} className="text-xs hover:underline" style={{ color: '#B91C1C' }} data-testid="btn-clear-gps">Clear</button>
              )}
              {gpsMsg && <span className="text-[11px]" style={{ color: gpsMsg.includes('Permission') ? '#B91C1C' : 'var(--cc-accent)' }} data-testid="gps-msg">{gpsMsg}</span>}
            </div>
          </div>
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
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-head text-sm font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}><Camera size={15}/> Photos</h2>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-accent btn-sm" data-testid="btn-add-photo"><Camera size={13}/> Take Photo</button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="btn btn-outline btn-sm" data-testid="btn-add-photo-gallery"><ImagePlus size={13}/> From Gallery</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotoPick} data-testid="input-photo-file"/>
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoPick} data-testid="input-photo-gallery"/>
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
                  {p.latitude != null && p.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase shadow"
                      style={{ background: 'rgba(10,46,31,0.85)', color: 'white' }}
                      title={`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`}
                      data-testid={`photo-gps-${idx}`}
                    >
                      <MapPin size={9}/> GPS
                    </a>
                  )}
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
            <input
              className="input w-full mb-2"
              type="tel"
              inputMode="tel"
              value={form.site_person_phone}
              onChange={(e) => setForm({ ...form, site_person_phone: e.target.value })}
              placeholder="Site person phone (e.g. +91 98xxxxxxxx)"
              data-testid="input-site-person-phone"
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
