import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, MessageSquare, Send } from 'lucide-react';

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

export default function Inbox({ user }) {
  const [students, setStudents] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await request('/messages/conversations'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      request('/messages/conversations'),
      user.role === 'Teacher' ? request('/messages/students') : Promise.resolve([])
    ])
      .then(([threads, studentRows]) => {
        if (!active) return;
        setConversations(threads);
        setStudents(studentRows);
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.role]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return undefined;
    }
    let active = true;
    const loadMessages = async () => {
      try {
        const rows = await request(`/messages/conversations/${encodeURIComponent(selectedConversation.id)}/messages`);
        if (active) setMessages(rows);
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    };
    loadMessages();
    const timer = window.setInterval(loadMessages, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedConversation]);

  const startConversation = async (event) => {
    event.preventDefault();
    if (!selectedStudent) return;
    setBusy(true);
    setError('');
    try {
      const thread = await request('/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent })
      });
      await loadConversations();
      setSelectedConversation(thread);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedConversation || !text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await request(
        `/messages/conversations/${encodeURIComponent(selectedConversation.id)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        }
      );
      setMessages((current) => [...current, created]);
      setText('');
      loadConversations();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const otherParticipant = (thread) => user.role === 'Teacher'
    ? thread.student_username || students.find((student) => student.id === thread.student_id)?.username || 'Student'
    : thread.teacher_username || 'Teacher';

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Private messages</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">Teachers can start conversations. Students can reply within an existing teacher-started thread.</p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="grid min-h-[32rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[17rem_1fr]">
        <aside className="border-b border-slate-200 md:border-b-0 md:border-r">
          {user.role === 'Teacher' && (
            <form onSubmit={startConversation} className="space-y-2 border-b border-slate-100 p-3">
              <label className="block text-xs font-semibold text-slate-600">
                Start a student thread
                <select value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm">
                  <option value="">Choose student</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.username}</option>)}
                </select>
              </label>
              <button disabled={busy || !selectedStudent} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? 'Opening...' : 'Open conversation'}
              </button>
            </form>
          )}
          <div className="max-h-72 overflow-y-auto md:max-h-[32rem]">
            {loading ? (
              <div className="flex justify-center p-8 text-indigo-600"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No conversations yet.</p>
            ) : conversations.map((thread) => (
              <button
                type="button"
                key={thread.id}
                onClick={() => setSelectedConversation(thread)}
                className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${
                  selectedConversation?.id === thread.id ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="block truncate text-sm font-semibold text-slate-900">{otherParticipant(thread)}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{thread.latest_message || 'Conversation started'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[24rem] flex-col">
          {selectedConversation ? (
            <>
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="font-semibold text-slate-900">{otherParticipant(selectedConversation)}</h2>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Send the first message in this thread.</p>}
                {messages.map((message) => {
                  const ownMessage = message.sender_id === user.id;
                  return (
                    <div key={message.id} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                      <article className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                        ownMessage ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
                      }`}>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                        <time className={`mt-1 block text-[10px] ${ownMessage ? 'text-indigo-100' : 'text-slate-500'}`} dateTime={message.sent_at}>
                          {new Date(message.sent_at).toLocaleString()}
                        </time>
                      </article>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-3">
                <input value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder="Write a message..." className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                <button disabled={busy || !text.trim()} aria-label="Send message" className="rounded-lg bg-indigo-600 px-3 text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm">Choose a conversation to view messages.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
