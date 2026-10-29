import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, LoaderCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getLocalDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'The request could not be completed');
  }
  return result;
}

function AttendanceStatus({ percentage }) {
  const isLow = Number(percentage) < 75;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isLow ? 'text-rose-700' : 'text-emerald-700'}`}>
      {isLow ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {isLow ? 'Below 75% requirement' : 'Good standing'}
    </span>
  );
}

export default function Attendance({ user }) {
  const isTeacher = user?.role === 'Teacher';
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(getLocalDate);
  const [attendanceStatus, setAttendanceStatus] = useState('Present');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [studentStats, setStudentStats] = useState(null);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isTeacher) {
        const teacherSubjects = await request('/attendance/subjects');
        setSubjects(teacherSubjects);
        setSelectedSubjectId((current) => (
          teacherSubjects.some((subject) => subject.subject_id === current)
            ? current
            : teacherSubjects[0]?.subject_id || ''
        ));
      } else {
        setSubjects(await request('/attendance/my-attendance'));
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.subject_id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );
  const selectedStudent = useMemo(
    () => selectedSubject?.students?.find((student) => student.id === selectedStudentId),
    [selectedSubject, selectedStudentId]
  );

  const handleSubjectChange = (event) => {
    setSelectedSubjectId(event.target.value);
    setSelectedStudentId('');
    setStudentStats(null);
    setSuccess('');
  };

  const handleMarkAttendance = async (event) => {
    event.preventDefault();
    if (!selectedStudentId || !selectedSubjectId || !attendanceDate) {
      setError('Choose a subject, student, and date.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await request('/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          subjectId: selectedSubjectId,
          date: attendanceDate,
          status: attendanceStatus
        })
      });
      setStudentStats(result);
      setSuccess(
        `Attendance saved. ${result.currentPercentage}% (${result.attendedClasses} of ${result.totalClasses} classes).` +
        (result.warningTriggered ? ' A below-75% notification was sent to the student.' : '')
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Academics</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {isTeacher ? 'Mark attendance' : 'My attendance'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTeacher
              ? 'Record a student’s class attendance and review their current percentage.'
              : 'Subject-wise attendance calculated from classes recorded by your instructors.'}
          </p>
        </div>
        <span className="w-fit rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          Minimum requirement: 75%
        </span>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={loadAttendance} className="shrink-0 font-semibold underline">Try again</button>
        </div>
      )}
      {success && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-indigo-600" aria-label="Loading attendance">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      ) : isTeacher ? (
        subjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <ClipboardCheck className="mx-auto h-9 w-9 text-slate-400" />
            <h2 className="mt-3 font-semibold text-slate-900">No assigned subjects</h2>
            <p className="mt-1 text-sm text-slate-500">Subjects assigned to your teacher account will appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <form onSubmit={handleMarkAttendance} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Subject</span>
                  <select
                    value={selectedSubjectId}
                    onChange={handleSubjectChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    {subjects.map((subject) => (
                      <option key={subject.subject_id} value={subject.subject_id}>
                        {subject.subject_code} — {subject.subject_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Student</span>
                  <select
                    value={selectedStudentId}
                    onChange={(event) => { setSelectedStudentId(event.target.value); setStudentStats(null); setSuccess(''); }}
                    required
                    disabled={!selectedSubject?.students?.length}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                  >
                    <option value="" disabled>
                      {selectedSubject?.students?.length ? 'Choose a student' : 'No students in this cohort'}
                    </option>
                    {(selectedSubject?.students || []).map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name || student.username} ({student.username})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Class date</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Attendance</span>
                  <select
                    value={attendanceStatus}
                    onChange={(event) => setAttendanceStatus(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                </label>
              </div>
              <button
                type="submit"
                disabled={saving || !selectedSubject?.students?.length}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save attendance'}
              </button>
            </form>

            {studentStats && selectedStudent && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{selectedSubject.subject_code}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">{selectedStudent.full_name || selectedStudent.username}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Attended {studentStats.attendedClasses} of {studentStats.totalClasses} classes
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={`text-2xl font-bold ${studentStats.currentPercentage < 75 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {studentStats.currentPercentage}%
                    </p>
                    <AttendanceStatus percentage={studentStats.currentPercentage} />
                  </div>
                </div>
              </section>
            )}
          </div>
        )
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <ClipboardCheck className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-900">No attendance records yet</h2>
          <p className="mt-1 text-sm text-slate-500">Your subject percentages will appear after your instructors record classes.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {subjects.map((subject) => {
            const percentage = Number(subject.percentage);
            const isLow = percentage < 75;
            return (
              <article
                key={subject.subject_id}
                className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                  isLow ? 'border-rose-200' : 'border-slate-200'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold tracking-wider text-indigo-600">{subject.subject_code}</span>
                  <h2 className="mt-1 font-semibold text-slate-900">{subject.subject_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Attended {subject.attended_classes} of {subject.total_classes} classes
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className={`text-2xl font-bold ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {percentage.toFixed(2)}%
                  </p>
                  <AttendanceStatus percentage={percentage} />
                  {isLow && (
                    <p className="mt-1 text-xs text-rose-600">Attendance warning — below required 75%</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
