import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ACCOUNT_TYPES = ['Student', 'Teacher', 'Admin'];

export default function Register() {
  const [accountType, setAccountType] = useState('Student');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const normalizedUsername = username.trim();
    const collegeEmail = email.trim().toLowerCase();
    if (!ACCOUNT_TYPES.includes(accountType)) {
      setError('Select a valid account type.');
      return;
    }
    if (!normalizedUsername || normalizedUsername.length > 50) {
      setError('Username must contain between 1 and 50 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collegeEmail)) {
      setError('Enter a valid college email address.');
      return;
    }
    if (new TextEncoder().encode(password).length < 8 || new TextEncoder().encode(password).length > 72) {
      setError('Password must be between 8 and 72 bytes.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          username: normalizedUsername,
          collegeEmail,
          password
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Unable to register. Please try again.');
      }
      setEmail(collegeEmail);
      setSuccess(true);
    } catch (registrationError) {
      setError(registrationError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-center text-2xl font-bold text-slate-900">Register account</h1>
      <p className="mb-6 text-center text-xs text-slate-500">
        Registration is limited to college emails in the authorized records.
      </p>

      {success ? (
        <div role="status" className="rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-800">
          Registration successful for <strong>{email}</strong>. You can now log in.
          <div className="mt-3">
            <Link to="/login" className="font-semibold underline">Go to login</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="register-account-type" className="mb-1 block text-xs font-semibold text-slate-700">Account type</label>
            <select
              id="register-account-type"
              value={accountType}
              onChange={(event) => setAccountType(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="register-username" className="mb-1 block text-xs font-semibold text-slate-700">Username</label>
            <input
              id="register-username"
              type="text"
              autoComplete="username"
              required
              minLength={1}
              maxLength={50}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label htmlFor="register-email" className="mb-1 block text-xs font-semibold text-slate-700">Official college email</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              maxLength={150}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="must match an authorized college record"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-500">Your email and account type are checked against the college whitelist.</p>
          </div>
          <div>
            <label htmlFor="register-password" className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? 'Creating account...' : 'Verify & create account'}
          </button>
        </form>
      )}
      {!success && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Already registered? <Link to="/login" className="font-semibold text-indigo-600">Log in</Link>
        </p>
      )}
    </div>
  );
}
