import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, FileText, LoaderCircle, Upload } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed');
  return result;
}

const emptyForm = {
  title: '',
  type: 'Cultural',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  venue: '',
  registrationLink: '',
  brochure: null
};

export default function Events() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadEvents = useCallback(async (signal) => {
    try {
      setEvents(await request('/events', { signal }));
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(controller.signal);
    return () => controller.abort();
  }, [loadEvents]);

  const submitEvent = async (event) => {
    event.preventDefault();
    if (!form.brochure) {
      setError('Choose a PDF brochure for the event.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key !== 'brochure' && value !== '') body.append(key, value);
    });
    body.append('brochure', form.brochure);
    try {
      const created = await request('/events', { method: 'POST', body });
      setEvents((current) => [...current, created].sort((a, b) => (
        `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`)
      )));
      setForm(emptyForm);
      event.target.reset();
      setNotice('Event created and published.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Teacher tools</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">College events</h1>
        <p className="mt-1 text-sm text-slate-500">Create events for students and attach a PDF brochure.</p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <form onSubmit={submitEvent} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Event title
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={150} required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Event type
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={inputClass}>
            <option>Cultural</option>
            <option>Technical</option>
            <option>Workshop</option>
            <option>Notice</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Date
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Venue
          <input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} maxLength={100} required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Start time
          <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          End time
          <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Description
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={5000} rows={4} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Registration link
          <input type="url" value={form.registrationLink} onChange={(event) => setForm({ ...form, registrationLink: event.target.value })} placeholder="https://" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          PDF brochure (max 15 MB)
          <input type="file" accept="application/pdf,.pdf" onChange={(event) => setForm({ ...form, brochure: event.target.files?.[0] || null })} required className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700`} />
        </label>
        <div className="sm:col-span-2">
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            <Upload className="h-4 w-4" /> {busy ? 'Publishing...' : 'Create event'}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><CalendarDays className="h-5 w-5 text-indigo-600" /> Published events</h2>
        {loading ? (
          <div className="flex justify-center py-10 text-indigo-600"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No college events yet.</p>
        ) : events.map((item) => (
          <article key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{new Date(`${item.date}T00:00:00`).toLocaleDateString()} · {item.venue}</p>
            </div>
            <div className="flex gap-4 text-sm font-semibold">
              {item.registration_link && <a href={item.registration_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600">Registration <ExternalLink className="h-3.5 w-3.5" /></a>}
              {item.brochure_url && <a href={item.brochure_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-600">Brochure <FileText className="h-3.5 w-3.5" /></a>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
