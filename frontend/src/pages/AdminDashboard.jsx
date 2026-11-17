import React, { useEffect, useState } from 'react';
import { LoaderCircle, Send, Shield, Upload, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed');
  return result;
}

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [broadcast, setBroadcast] = useState('');
  const [timetable, setTimetable] = useState({ title: '', type: 'exam', semester: '1', file: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    request('/admin/users')
      .then((result) => { if (active) setUsers(result); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoadingUsers(false); });
    return () => { active = false; };
  }, []);

  const sendBroadcast = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcast })
      });
      setBroadcast('');
      setNotice(`Notification delivered to ${result.deliveredCount} active students and teachers.`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadTimetable = async (event) => {
    event.preventDefault();
    if (!timetable.file) {
      setError('Choose a timetable PDF or image.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const formData = new FormData();
    formData.append('title', timetable.title);
    formData.append('type', timetable.type);
    formData.append('semester', timetable.semester);
    formData.append('file', timetable.file);
    try {
      await request('/admin/timetables', { method: 'POST', body: formData });
      setTimetable({ title: '', type: 'exam', semester: '1', file: null });
      event.target.reset();
      setNotice('2024 batch timetable uploaded.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-indigo-300" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Administration</p>
            <h1 className="mt-1 text-2xl font-bold">Admin dashboard</h1>
          </div>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2" aria-label="Admin dashboard sections">
        {[
          ['users', 'User directory'],
          ['broadcast', 'Broadcast'],
          ['timetables', 'Timetable uploads']
        ].map(([tab, label]) => (
          <button
            type="button"
            key={tab}
            onClick={() => { setActiveTab(tab); setError(''); setNotice(''); }}
            aria-pressed={activeTab === tab}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {activeTab === 'users' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Users className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold">Registered accounts ({users.length})</h2>
          </div>
          {loadingUsers ? (
            <div className="flex justify-center py-12 text-indigo-600"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
          ) : users.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No accounts have registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Account</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((account) => (
                    <tr key={account.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{account.username}</td>
                      <td className="px-5 py-3 text-slate-600">{account.college_email}</td>
                      <td className="px-5 py-3">{account.role}</td>
                      <td className="px-5 py-3">{account.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="px-5 py-3 text-slate-500">{new Date(account.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'broadcast' && (
        <form onSubmit={sendBroadcast} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">College-wide notification</h2>
            <p className="mt-1 text-sm text-slate-500">This will create an unread notification for every active student and teacher.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Message
            <textarea
              value={broadcast}
              onChange={(event) => setBroadcast(event.target.value)}
              maxLength={2000}
              required
              rows={5}
              className={fieldClass}
            />
          </label>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            <Send className="h-4 w-4" /> {busy ? 'Sending...' : 'Send broadcast'}
          </button>
        </form>
      )}

      {activeTab === 'timetables' && (
        <form onSubmit={uploadTimetable} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-semibold text-slate-900">Upload a 2024 batch timetable</h2>
            <p className="mt-1 text-sm text-slate-500">PDF and common image formats are stored in Cloudinary.</p>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Title
            <input value={timetable.title} onChange={(event) => setTimetable({ ...timetable, title: event.target.value })} maxLength={150} required className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Timetable type
            <select value={timetable.type} onChange={(event) => setTimetable({ ...timetable, type: event.target.value })} className={fieldClass}>
              <option value="exam">Exam</option>
              <option value="test">Test</option>
              <option value="class">Class</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Semester
            <input type="number" min="1" step="1" value={timetable.semester} onChange={(event) => setTimetable({ ...timetable, semester: event.target.value })} required className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            PDF or image
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setTimetable({ ...timetable, file: event.target.files?.[0] || null })} required className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700`} />
          </label>
          <div className="sm:col-span-2">
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <Upload className="h-4 w-4" /> {busy ? 'Uploading...' : 'Upload timetable'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
