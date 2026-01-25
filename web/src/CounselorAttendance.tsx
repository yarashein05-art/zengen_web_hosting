import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/* ================= TYPES ================= */

type AttendanceRecord = {
  id: string;
  users: {
    id: string;
    name: string;
  } | null;
};

type AttendanceSession = {
  id: string;
  topic: string;
  session_attendance: AttendanceRecord[];
};

function CounselorAttendance() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ================= FETCH ATTENDANCE ================= */

  const fetchAttendance = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('friday_sessions')
        .select(`
          id,
          topic,
          session_attendance (
            id,
            users (
              id,
              name
            )
          )
        `)
        .eq('status', 'completed')
        .eq('counselor_id', user.id);

      if (error) throw error;

      // ✅ EXISTING NORMALIZATION (unchanged)
      const normalized: AttendanceSession[] = (data ?? []).map((s: any) => ({
        id: s.id,
        topic: s.topic,
        session_attendance: s.session_attendance ?? [],
      }));

      setSessions(normalized);
    } catch (err) {
      console.error(err);
      setError('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  /* ================= UI ================= */

  if (loading) return <p>Loading attendance…</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1>Session Attendance</h1>

        {/* ✅ NEW: manual refresh (does not change logic) */}
        <button
          onClick={fetchAttendance}
          style={{
            padding: '8px 16px',
            borderRadius: 12,
            border: 'none',
            background: '#008C33',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {sessions.length === 0 && <p>No completed sessions yet.</p>}

      {sessions.map((session) => (
        <div
          key={session.id}
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            marginBottom: 32,
            boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
          }}
        >
          <h3 style={{ marginBottom: 8 }}>{session.topic}</h3>

          {/* ✅ NEW: attendee count (derived, no DB change) */}
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
            Attendees: {session.session_attendance.length}
          </p>

          {session.session_attendance.length === 0 ? (
            <p style={{ color: '#888' }}>No attendees.</p>
          ) : (
            <ul style={{ paddingLeft: 20 }}>
              {session.session_attendance.map((a) => (
                <li key={a.id} style={{ marginBottom: 8 }}>
                  {a.users?.name ?? 'Unknown user'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default CounselorAttendance;
