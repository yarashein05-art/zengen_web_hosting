import { useEffect, useState } from 'react';
import avatarIcon from '../assets/counselor.png';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import CounselorAttendance from '../CounselorAttendance';

type FridaySession = {
  id: string;
  topic: string;
  description: string | null;
  starts_at: string;
  zoom_link: string | null;
  created_at: string;
  status: 'scheduled' | 'completed';
};
type CounselorMessage = {
  id: string;
  message: string;
  created_at: string;
  replied: boolean;
  users: {
    name: string;
    email: string;
  };
};


/* ================= HELPERS ================= */
const canMarkDone = (startsAt: string, status: string) => {
  if (status !== 'scheduled') return false;

  // Parse as LOCAL time (force no timezone shift)
  const start = new Date(startsAt);
  const localStart = new Date(
    start.getTime() + start.getTimezoneOffset() * 60000
  );

  const oneHourLater = new Date(
    localStart.getTime() + 60 * 60 * 1000
  );

  return new Date() >= oneHourLater;
};
const getNextFriday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  today.setDate(today.getDate() + diff);
  return today.toISOString().slice(0, 10);
};
function CounselorDashboard() {
  const [messages, setMessages] = useState<CounselorMessage[]>([]);
const unreadCount = messages.filter(m => !m.replied).length;
  const fetchMessages = async () => {
  const { data } = await supabase
  .from('counselor_messages')
  .select(`
    id,
    message,
    created_at,
    replied,
    users (
      name,
      email
    )
  `)
  .order('created_at', { ascending: false });


  if (error) {
    console.error('❌ Fetch messages error:', error);
    return;
  }

  console.log('✅ Messages fetched:', data);
  setMessages(data ?? []);
};
const replyByEmail = async (msg: CounselorMessage) => {
  window.location.href = `mailto:${msg.users.email}?subject=Session Support Reply`;

  await supabase
    .from('counselor_messages')
    .update({ replied: true })
    .eq('id', msg.id);

  fetchMessages();
};
  const navigate = useNavigate();
  const handleMarkDone = async () => {
  if (!upcoming) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const { error } = await supabase
      .from('friday_sessions')
      .update({ status: 'completed' })
      .eq('id', upcoming.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Session marked as completed ✅');
    fetchUpcoming(); // 🔄 refresh state
  } catch {
    setError('Failed to mark session as completed');
  } finally {
    setLoading(false);
  }
};
  const handleLogout = async () => {
  await supabase.auth.signOut();
  navigate('/');
};
  const [tab, setTab] = useState<
    'schedule'  | 'attendance' | 'messages'
  >('schedule');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [completedSessions, setCompletedSessions] = useState<FridaySession[]>([]);

  const [upcoming, setUpcoming] = useState<FridaySession | null>(null);

  // FORM STATE
  const [topic, setTopic] = useState('');
  const [sessionDate, setSessionDate] = useState(getNextFriday());
  const [sessionTime, setSessionTime] = useState('19:00');
  const [description, setDescription] = useState('');
  const [zoomLink, setZoomLink] = useState('');

  const [isEditing, setIsEditing] = useState(true);const formatLocalDateTime = (iso: string) => {
  const d = new Date(iso);

  // Prevent browser timezone re-shift
  const local = new Date(
    d.getTime() + d.getTimezoneOffset() * 60000
  );

  return local.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};


  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  /* ================= LOAD UPCOMING SESSION ================= */
const fetchUpcoming = async () => {
  resetMessages();
  setLoading(true);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error();

    const { data, error } = await supabase
      .from('friday_sessions')
      .select('*')
      .eq('counselor_id', user.id)
      .order('starts_at', { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const scheduled =
      data?.find((s) => s.status === 'scheduled') ?? null;

    const completed =
      data?.filter((s) => s.status === 'completed') ?? [];

    setUpcoming(scheduled);
    setCompletedSessions(completed);

    if (scheduled) {
      const dt = new Date(scheduled.starts_at);
      setTopic(scheduled.topic);
      setSessionDate(dt.toISOString().slice(0, 10));
      setSessionTime(dt.toISOString().slice(11, 16));
      setDescription(scheduled.description ?? '');
      setZoomLink(scheduled.zoom_link ?? '');
      setIsEditing(false);
    } else {
      // 🔓 No upcoming session → unlock form
      setIsEditing(true);
      setTopic('');
      setDescription('');
      setZoomLink('');
      setSessionDate(getNextFriday());
      setSessionTime('19:00');
    }
  } catch {
    setError('Failed to load sessions.');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchUpcoming();
    
  }, []);
  useEffect(() => {
  fetchMessages(); // ✅ fetch immediately for badge
}, []);
  useEffect(() => {
  if (tab === 'messages') {
    fetchMessages();
  }

}, [tab]);

  /* ================= SAVE / UPDATE SESSION ================= */
const extractZoomMeetingId = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    // Example pathname: "/j/86738693243"
    const parts = parsed.pathname.split('/').filter(Boolean);

    // Find "j" or "s"
    const index = parts.findIndex((p) => p === 'j' || p === 's');

    if (index !== -1 && parts[index + 1]) {
      return parts[index + 1];
    }

    return null;
  } catch {
    return null;
  }
};

  const handleSaveSession = async () => {
    console.log('SAVE CLICKED');
console.log('zoomLink state:', zoomLink);
    resetMessages();

    if (
      !topic.trim() ||
      !sessionDate ||
      !sessionTime ||
      !zoomLink.trim() ||
      !description.trim()
    ) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error();

     // ✅ build LOCAL datetime string (no Date(), no offset, no ISO)
const startsAt = `${sessionDate}T${sessionTime}:00`;

// week calculation can still use Date safely
const weekDate = new Date(`${sessionDate}T00:00:00`);
weekDate.setDate(weekDate.getDate() - weekDate.getDay() + 1);

const meetingId = extractZoomMeetingId(zoomLink.trim());

if (!meetingId) {
  setError('Invalid Zoom link. Please use a Zoom meeting link.');
  setLoading(false);
  return;
}

const payload = {
  topic: topic.trim(),
  description: description.trim(),
  starts_at: startsAt,
  session_week: weekDate.toISOString().slice(0, 10),
  zoom_link: zoomLink.trim(),
  zoom_meeting_id: meetingId, // ✅ ADD THIS
  counselor_id: user.id,
  status: 'scheduled',
};

      if (upcoming) {
        await supabase
          .from('friday_sessions')
          .update(payload)
          .eq('id', upcoming.id);
      } else {
        await supabase.from('friday_sessions').insert(payload);
      }

      setSuccess('Session saved successfully ✅');
      setIsEditing(false);
      fetchUpcoming();
    } catch {
      setError('Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE SESSION ================= */

  const handleDeleteSession = async () => {
  if (!upcoming) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error();

    const { error } = await supabase
      .from('friday_sessions')
      .delete()
      .eq('id', upcoming.id)
      .eq('counselor_id', user.id); // 🔑 REQUIRED FOR RLS

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Session deleted successfully 🗑️');

    setUpcoming(null);
    setIsEditing(true);
    setTopic('');
    setDescription('');
    setZoomLink('');
    setSessionDate(getNextFriday());
    setSessionTime('19:00');
  } catch {
    setError('Failed to delete session');
  } finally {
    setLoading(false);
  }
};

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFDBFF',
        color: '#008C33',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* NAVBAR */}
      <nav
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 60px',
    flexWrap: 'wrap',
    gap: 16,
  }}
>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={avatarIcon} style={{ width: 90 }} />
          <h1 style={{ margin: 0, fontWeight: 700 }}>Counselor Dashboard</h1>
        </div>

        <div
  style={{
    display: 'flex',
    gap: 14,
    fontSize: 16,
    fontWeight: 600,
    flexWrap: 'wrap',
    justifyContent: 'center',
  }}
>          <NavTab active={tab === 'schedule'} onClick={() => setTab('schedule')}>
            Schedule
          </NavTab>
        <NavTab active={tab === 'attendance'} onClick={() => setTab('attendance')}>
  Attendance
</NavTab>
         <NavTab active={tab === 'messages'} onClick={() => setTab('messages')}>
  Messages
  {unreadCount > 0 && (
    <span
      style={{
        backgroundColor: '#e74c3c',
        color: '#fff',
        borderRadius: '50%',
        padding: '2px 7px',
        fontSize: 12,
        fontWeight: 700,
        marginLeft: 8,
        display: 'inline-block',
        minWidth: 20,
        textAlign: 'center',
      }}
    >
      {unreadCount}
    </span>
  )}
</NavTab>
           <span
    onClick={handleLogout}
    style={{
      cursor: 'pointer',
      color: '#e74c3c',
      fontWeight: 700,
      marginLeft: 12,
    }}
  >
    Logout
  </span>
        </div>
      </nav>

      {/* CONTENT */}
      <section style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
  {/* ================= SCHEDULE TAB ================= */}
  {tab === 'schedule' && (
    <div
  style={{
    maxWidth: 1320,
    display: 'flex',
    gap: 24,
    margin: '0 auto',
    flexWrap: 'wrap',
    justifyContent: 'center',
  }}
>
      {/* FORM */}
      <div
        style={{
          flex: '1 1 420px',
maxWidth: '100%',
          backgroundColor: 'rgba(255,255,255,0.65)',
          borderRadius: 28,
          padding: 48,
          opacity: upcoming && !isEditing ? 0.5 : 1,
        }}
      >
        <h2>Schedule Weekly Session</h2>

        <label style={labelStyle}>Topic</label>
        <input disabled={!isEditing} value={topic} onChange={(e) => setTopic(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Date</label>
        <input type="date" disabled={!isEditing} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Time</label>
        <input type="time" disabled={!isEditing} value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Zoom Link</label>
        <input disabled={!isEditing} value={zoomLink} onChange={(e) => setZoomLink(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Description</label>
        <textarea disabled={!isEditing} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />

        {isEditing && (
          <button onClick={handleSaveSession} disabled={loading} style={primaryBtnStyle(loading)}>
            {loading ? 'Saving...' : 'Save Session'}
          </button>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: '#008C33' }}>{success}</p>}
      </div>

      {upcoming && (
  <div
    style={{
      flex: '1 1 280px',
maxWidth: '100%',
      background: '#fff',
      borderRadius: 24,
      padding: 24,
      boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
    }}
  >
    <h3>Upcoming Session</h3>
    <p><strong>{upcoming.topic}</strong></p>
    <p>{formatLocalDateTime(upcoming.starts_at)}</p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      {upcoming.status === 'completed' && (
        <div
          style={{
            background: '#e8f8ee',
            color: '#008C33',
            padding: 12,
            borderRadius: 12,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          ✅ Session Completed
        </div>
      )}

      {canMarkDone(upcoming.starts_at, upcoming.status) && (
        <button
          onClick={handleMarkDone}
          disabled={loading}
          style={{
            ...primaryBtnStyle(loading),
            backgroundColor: '#27ae60',
          }}
        >
          Mark Session as Done
        </button>
      )}

      {upcoming.status === 'scheduled' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setIsEditing(true)}
            style={primaryBtnStyle(false)}
          >
            Edit
          </button>

          <button
            onClick={handleDeleteSession}
            style={{
              ...primaryBtnStyle(false),
              backgroundColor: '#e74c3c',
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  </div>
)}
      {/* COMPLETED SESSIONS */}
      {completedSessions.length > 0 && (
        <div
          style={{
            flex: '1 1 300px',
maxWidth: '100%',
            background: '#fff',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
          }}
        >
          <h3>Completed Sessions</h3>
          {completedSessions.map((s) => (
            <div key={s.id} style={{ marginTop: 12, padding: 12, borderRadius: 14, background: '#e8f8ee' }}>
              <strong>{s.topic}</strong>
              <div style={{ fontSize: 13 }}>{formatLocalDateTime(s.starts_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}

  {/* ================= ATTENDANCE TAB ================= */}
  {tab === 'attendance' && (
    <div style={{ width: '100%', maxWidth: 1320 }}>
      <CounselorAttendance />
    </div>
  )}
  {tab === 'messages' && (
  <div style={{ width: '100%', maxWidth: 900 }}>
    {messages.length === 0 ? (
      <p>No messages yet</p>
    ) : (
      messages.map(msg => (
        <div
  key={msg.id}
  onClick={() => replyByEmail(msg)}
  style={{
    background: '#fff',
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    cursor: 'pointer',
    opacity: msg.replied ? 0.5 : 1,
    boxShadow: msg.replied
      ? 'none'
      : '0 8px 24px rgba(0,140,51,0.35)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    transition: 'all 0.3s ease',
  }}
>
  {/* LEFT SIDE */}
  <div>
    <div style={{ fontWeight: 700, color: '#008C33' }}>
      {msg.users.name}
    </div>

    <div style={{ fontSize: 14, marginTop: 6 }}>
      {msg.message}
    </div>
  </div>

  {/* RIGHT SIDE – TIME */}
  <div
    style={{
      fontSize: 12,
      color: '#6b6b6b',
      marginLeft: 16,
    }}
  >
    {new Date(msg.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}
  </div>
</div>

      ))
    )}
  </div>
)}
</section>
      
    </div>
  );
  
}

/* ================= UI HELPERS ================= */

function NavTab({ active, onClick, children }: any) {
  return (
    <span
      onClick={onClick}
      style={{
        cursor: 'pointer',
        color: active ? '#008C33' : '#517861',
        borderBottom: active ? '3px solid #008C33' : 'none',
        paddingBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

const labelStyle = { fontSize: 15, marginBottom: 8, display: 'block', fontWeight: 500 };

const inputStyle = {
  width: '100%',
  padding: 16,
  borderRadius: 14,
  border: 'none',
  marginBottom: 22,
};

const primaryBtnStyle = (disabled: boolean) => ({
  width: '100%',
  padding: 16,
  borderRadius: 14,
  border: 'none',
  backgroundColor: '#008C33',
  color: '#FFDBFF',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});
<style>
{`
/* ========== COUNSELOR DASHBOARD RESPONSIVE ========== */

@media (max-width: 1024px) {
  nav {
    padding: 16px 30px !important;
  }

  section {
    padding: 40px 30px !important;
  }
}

@media (max-width: 768px) {
  nav {
    flex-direction: column !important;
    text-align: center;
  }

  nav h1 {
    font-size: 24px !important;
  }

  nav img {
    width: 70px !important;
  }

  section {
    padding: 30px 20px !important;
  }

  h2 {
    font-size: 22px !important;
  }

  h3 {
    font-size: 20px !important;
  }

  textarea {
    min-height: 80px !important;
  }
}

@media (max-width: 480px) {
  section {
    padding: 20px 14px !important;
  }

  h1 {
    font-size: 20px !important;
  }

  p {
    font-size: 14px !important;
  }
}
`}
</style>

export default CounselorDashboard;
