import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to load notifications');
  return result;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      const result = await request('/notifications');
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const markRead = async (notification) => {
    if (notification.is_read) return;
    try {
      await request(`/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' });
      setNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, is_read: true }
        : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (markError) {
      setError(markError.message);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((current) => !current); loadNotifications(); }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 z-50 mt-2 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
          </header>
          {error && <p role="alert" className="px-4 py-3 text-xs text-rose-700">{error}</p>}
          {!error && notifications.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">You have no notifications.</p>
          )}
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => markRead(notification)}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                    notification.is_read ? 'bg-white' : 'bg-indigo-50/60'
                  }`}
                >
                  <span className="block whitespace-pre-wrap text-sm text-slate-800">{notification.message}</span>
                  <time className="mt-1 block text-xs text-slate-500" dateTime={notification.created_at}>
                    {new Date(notification.created_at).toLocaleString()}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
