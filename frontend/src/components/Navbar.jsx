import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Calendar, CheckSquare, LogOut, Menu, X } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/feed" onClick={closeMenu} className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-xl font-bold text-transparent">
          CampusConnect
        </Link>
        <nav className="hidden items-center gap-5 md:flex" aria-label="Main navigation">
          <Link to="/feed" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-indigo-600">
            <Home className="h-4 w-4" /> Feed
          </Link>
          <Link to="/attendance" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-indigo-600">
            <CheckSquare className="h-4 w-4" /> Attendance
          </Link>
          <Link to="/schedule" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-indigo-600">
            <Calendar className="h-4 w-4" /> Schedule
          </Link>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              {user.role}
            </span>
            <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out" className="text-slate-500 transition hover:text-red-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </nav>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {menuOpen && (
        <nav className="space-y-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <Link to="/feed" onClick={closeMenu} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600">
            <Home className="h-4 w-4" /> Feed
          </Link>
          <Link to="/attendance" onClick={closeMenu} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600">
            <CheckSquare className="h-4 w-4" /> Attendance
          </Link>
          <Link to="/schedule" onClick={closeMenu} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600">
            <Calendar className="h-4 w-4" /> Schedule
          </Link>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 pt-3">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{user.role}</span>
            <button type="button" onClick={() => { closeMenu(); onLogout(); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
