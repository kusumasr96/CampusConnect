import React, { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, FileText, LoaderCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, signal) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', signal });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to load campus information');
  return result;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function CampusDashboard() {
  const [events, setEvents] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [type, setType] = useState('');
  const [semester, setSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams();
    if (type) query.set('type', type);
    if (semester) query.set('semester', semester);
    const queryString = query.toString();
    Promise.all([
      request('/events', controller.signal),
      request(`/timetables${queryString ? `?${queryString}` : ''}`, controller.signal)
    ])
      .then(([eventRows, timetableRows]) => {
        setEvents(eventRows);
        setTimetables(timetableRows);
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, semester]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Student campus view</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Events & timetables</h1>
        <p className="mt-1 text-sm text-slate-500">College events and timetable documents for the 2024 batch.</p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-16 text-indigo-600"><LoaderCircle className="h-7 w-7 animate-spin" /></div>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">College events</h2>
            </div>
            {events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No events have been published yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {events.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{event.title}</h3>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{event.type}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{formatDate(event.date)} · {event.start_time.slice(0, 5)} · {event.venue}</p>
                    {event.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                      {event.registration_link && (
                        <a href={event.registration_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
                          Register <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {event.brochure_url && (
                        <a href={event.brochure_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-700">
                          Brochure <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">2024 batch timetables</h2>
                <p className="text-sm text-slate-500">Filter by timetable type and semester.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-slate-600">
                  Type
                  <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">All types</option>
                    <option value="class">Class</option>
                    <option value="test">Test</option>
                    <option value="exam">Exam</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Semester
                  <select value={semester} onChange={(event) => setSemester(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">All semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <option value={item} key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
            </div>
            {timetables.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No timetable documents match these filters.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {timetables.map((item) => (
                  <a key={item.id} href={item.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{item.title}</span>
                      <span className="mt-1 block text-xs capitalize text-slate-500">{item.type} · Semester {item.semester}</span>
                    </span>
                    <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
                  </a>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
