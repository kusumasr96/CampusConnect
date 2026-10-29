import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ROLE_HOME = {
  Student: '/schedule',
  Teacher: '/attendance',
  Admin: '/feed'
};

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const collegeEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collegeEmail)) {
      setError('Enter a valid college email address.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collegeEmail, password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Unable to log in. Please try again.');
      }

      const user = result.user;
      if (!user?.id || !ROLE_HOME[user.role]) {
        throw new Error('The server returned an invalid account role. Please contact support.');
      }

      // The server stores JWTs in HTTP-only cookies; the browser never handles token values.
      onLogin(user);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-center text-2xl font-bold text-slate-900">Log in to CampusConnect</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Use your registered college account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-xs font-semibold text-slate-700">College email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            maxLength={150}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name.branch@college.edu"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        Need to register? <Link to="/register" className="font-semibold text-indigo-600">Sign up with college record</Link>
      </p>
    </div>
  );
}
