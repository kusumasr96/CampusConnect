import React, { useCallback, useEffect, useState } from 'react';
import { Armchair, Building2, Calendar, Clock3, LoaderCircle, MapPin } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function getMyExams(signal) {
  const response = await fetch(`${API_BASE}/schedule/my-exams`, {
    credentials: 'include',
    signal
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Failed to load your exam schedule');
  }
  return result;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(time) {
  const [hours, minutes] = time.split(':');
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function Schedule({ user }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      setExams(await getMyExams(signal));
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (user?.role !== 'Student') {
      setExams([]);
      setLoading(false);
      return () => controller.abort();
    }

    loadSchedule(controller.signal);
    return () => controller.abort();
  }, [loadSchedule, user?.role]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Private student view</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">My examination schedule</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your assigned exam times, rooms, and seats. Other students’ seating details are not shown.
        </p>
      </header>

      {user?.role !== 'Student' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Exam seating allocations are available only in the signed-in student’s private view.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 text-indigo-600" aria-label="Loading exam schedule">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              const controller = new AbortController();
              loadSchedule(controller.signal);
            }}
            className="shrink-0 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Calendar className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-900">No exam seating assigned yet</h2>
          <p className="mt-1 text-sm text-slate-500">Your exam date, room, and seat will appear here when available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <article key={exam.schedule_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 sm:px-6">
                <h2 className="font-semibold text-slate-900">{exam.subject_or_exam}</h2>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span>{formatDate(exam.date)}</span>
                </div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Exam time</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatTime(exam.start_time)} – {formatTime(exam.end_time)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Room</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{exam.room_no}</p>
                    <p className="text-xs text-slate-500">{exam.building}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-indigo-50 p-3.5">
                  <Armchair className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <div>
                    <p className="text-xs font-medium text-indigo-700">Your seat</p>
                    <p className="mt-1 text-sm font-bold text-indigo-900">{exam.seat_no}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
                <Building2 className="h-3.5 w-3.5" />
                <span>Seating details are private to your account.</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
