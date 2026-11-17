import React, { useEffect, useState } from 'react';
import { LoaderCircle, Upload, UserCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed');
  return result;
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    request('/profile/me')
      .then((result) => { if (active) setProfile(result); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const saveAvatar = async (event) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    const body = new FormData();
    body.append('avatar', file);
    try {
      const updatedProfile = await request('/profile/avatar', { method: 'POST', body });
      setProfile((current) => ({ ...current, ...updatedProfile }));
      setFile(null);
      event.target.reset();
      setNotice('Profile picture updated.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Account settings</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Your profile</h1>
      </header>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? (
        <div className="flex justify-center py-16 text-indigo-600"><LoaderCircle className="h-7 w-7 animate-spin" /></div>
      ) : profile ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {previewUrl || profile.avatar_url ? (
              <img src={previewUrl || profile.avatar_url} alt={`${profile.username}'s profile`} className="h-28 w-28 rounded-full object-cover ring-4 ring-indigo-50" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <UserCircle className="h-16 w-16" />
              </div>
            )}
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{profile.username}</h2>
            <p className="text-sm text-slate-500">{profile.college_email}</p>
            <span className="mt-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{profile.role}</span>
          </div>
          <form onSubmit={saveAvatar} className="mx-auto mt-6 max-w-md space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Profile picture
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700"
              />
              <span className="mt-1 block text-xs text-slate-500">JPEG, PNG, GIF or WebP; up to 10 MB.</span>
            </label>
            <button disabled={busy || !file} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              <Upload className="h-4 w-4" /> {busy ? 'Uploading...' : 'Save picture'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
