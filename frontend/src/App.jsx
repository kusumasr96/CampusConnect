import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Attendance from './pages/Attendance';
import Schedule from './pages/Schedule';
import Navbar from './components/Navbar';

const ROLE_HOME = {
  Student: '/schedule',
  Teacher: '/attendance',
  Admin: '/feed'
};
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) return null;
        if (!response.ok) throw new Error(result.error || 'Unable to restore your session.');
        return result.user;
      })
      .then((authenticatedUser) => {
        if (authenticatedUser?.id && ROLE_HOME[authenticatedUser.role]) {
          setUser(authenticatedUser);
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setAuthError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false);
      });

    return () => controller.abort();
  }, []);

  const handleLogin = (authenticatedUser) => {
    setUser(authenticatedUser);
  };
  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('The server could not clear the session cookie.');
      }
    } catch (error) {
      console.error('Logout Error:', error);
    }
    setUser(null);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {user && <Navbar user={user} onLogout={handleLogout} />}
        <main className="max-w-5xl mx-auto px-4 py-6">
          {authLoading ? (
            <div className="py-16 text-center text-sm text-slate-500">Checking your session...</div>
          ) : (
            <>
              {authError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</p>}
              <Routes>
                <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={ROLE_HOME[user.role] || '/feed'} replace />} />
                <Route path="/register" element={!user ? <Register /> : <Navigate to={ROLE_HOME[user.role] || '/feed'} replace />} />
                <Route path="/feed" element={user ? <Feed user={user} /> : <Navigate to="/login" replace />} />
                <Route path="/" element={<Navigate to={user ? '/feed' : '/login'} replace />} />
                <Route path="/attendance" element={user ? <Attendance user={user} /> : <Navigate to="/login" replace />} />
                <Route path="/schedule" element={user ? <Schedule user={user} /> : <Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to={user ? '/feed' : '/login'} replace />} />
              </Routes>
            </>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}
