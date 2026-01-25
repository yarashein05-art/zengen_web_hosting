import { useState } from 'react';
import avatarIcon from '../assets/avatar.png';
import { supabase } from '../supabaseClient'; // ✅ ADD THIS
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [childId, setChildId] = useState('');
  const [childSearch, setChildSearch] = useState('');
  const [showChildList, setShowChildList] = useState(false);
const [children, setChildren] = useState<any[]>([]);
const [casesCount, setCasesCount] = useState(0);
const [openCases, setOpenCases] = useState<any[]>([]);
const [attendanceCount, setAttendanceCount] = useState(0);
const [completedSessionsCount, setCompletedSessionsCount] = useState(0);
const [sessionsByCase, setSessionsByCase] = useState<Record<
  string,
  { scheduled: number; completed: number }
>>({});
const filteredChildren = children.filter((c) =>
  c.name.toLowerCase().includes(childSearch.toLowerCase())
);
const [userStatus, setUserStatus] = useState(0);
const [userCards, setUserCards] = useState({
  users: 0,
  community_messages: 0,
  private_messages: 0,
});
const [userMonitoringUsers, setUserMonitoringUsers] = useState<any[]>([]);
const [accountability, setAccountability] = useState({
  total: 0,
  reviewed: 0,
  cases: 0,
  pending: 0,
  highRisk: 0,
});
const [activeTab, setActiveTab] =
  useState<'invite' | 'analytics' | 'counselors' | 'users'>('invite');
  const [flaggedCases, setFlaggedCases] = useState<any[]>([]);
const [analytics, setAnalytics] = useState({
  teens: 0,
  parents: 0,
  counselors: 0,
  psychologists: 0,
  aiDetections: 0,
  highRiskAlerts: 0,
  publicSessions: 0,
  privateSessions: 0,
});
const [counselorStatus, setCounselorStatus] = useState(0);
const [counselorCards, setCounselorCards] = useState({
  public_sessions: 0,
  total_attendance: 0,
  attendance_rate: 0,
});
const [counselorTrend, setCounselorTrend] = useState<
  { week: string; count: number }[]
>([]);
const [counselorAccountability, setCounselorAccountability] = useState({
  completed_sessions: 0,
  average_attendance: 0,
  overall_attendance_rate: 0,
});
useEffect(() => {
  if (activeTab !== 'counselors') return;

 const fetchCounselorMonitoring = async () => {
  // ================= SYSTEM STATUS =================
  const { data: status, error: statusError } =
    await supabase.rpc('get_counselor_system_status');

  if (statusError) {
    console.error('Counselor system status error:', statusError);
  } else if (status !== null) {
    setCounselorStatus(Number(status));
  }

  // ================= CARDS =================
  const { data: cards, error: cardsError } =
    await supabase.rpc('get_counselor_cards');

  if (cardsError) {
    console.error('Counselor cards error:', cardsError);
  } else if (cards) {
    setCounselorCards({
      public_sessions: Number(cards.public_sessions),
      total_attendance: Number(cards.total_attendance),
      attendance_rate: Number(cards.attendance_rate),
    });

    // ✅ THIS is the ONLY place attendanceCount is set
    setAttendanceCount(Number(cards.total_attendance));
  }

  // ================= ACCOUNTABILITY =================
// ================= ACCOUNTABILITY =================

// 1️⃣ get completed sessions + avg attendance
const { data: acc, error: accError } =
  await supabase.rpc('get_counselor_accountability');

if (accError) {
  console.error('Counselor accountability error:', accError);
}

// 2️⃣ get overall attendance rate (NEW FUNC)
const { data: overallRate, error: rateError } =
  await supabase.rpc('get_counselor_overall_attendance_rate');

console.log('🔥 overallRate raw value:', overallRate);
console.log('🔥 overallRate type:', typeof overallRate);

if (rateError) {
  console.error('Overall attendance rate error:', rateError);
}

if (acc && acc.length > 0) {
  const row = acc[0];

  setCounselorAccountability({
    completed_sessions: Number(row.completed_sessions),
    average_attendance: attendanceCount,
    overall_attendance_rate: Number(overallRate ?? 0), // ✅ FROM NEW FUNC
  });
}

  // ================= WEEKLY GRAPH =================
  const { data: weeklySession, error: weeklyError } =
    await supabase.rpc('get_last_week_public_session_attendance');

  if (weeklyError) {
    console.error('Weekly attendance error:', weeklyError);
    setCounselorTrend([]);
  } else if (weeklySession && weeklySession.length > 0) {
    setCounselorTrend([
      {
        week: weeklySession[0].session_name, // topic
        count: Number(weeklySession[0].attendance_percentage),
      },
    ]);
  } else {
    setCounselorTrend([]);
  }
};


  fetchCounselorMonitoring();
}, [activeTab]);
useEffect(() => {
  if (activeTab !== 'users') return;

  if (userMonitoringUsers.length === 0) {
    setUserStatus(0);
    return;
  }

  const validUsers = userMonitoringUsers.filter(
    (u) => typeof u.overall_performance === 'number'
  );

  if (validUsers.length === 0) {
    setUserStatus(0);
    return;
  }

  const avg =
    validUsers.reduce(
      (sum, u) => sum + Number(u.overall_performance),
      0
    ) / validUsers.length;

  setUserStatus(Math.round(avg));
}, [userMonitoringUsers, activeTab]);
useEffect(() => {
  if (activeTab !== 'analytics') return;

  const fetchAnalytics = async () => {
    const { data, error } = await supabase.rpc('get_admin_analytics');

    if (error) {
      console.error('Analytics error:', error);
      return;
    }
   const { data: accountabilityData, error: accError } =
  await supabase.rpc('get_detection_accountability_last_7_days');

if (accError) {
  console.error('Accountability error:', accError);
} else {
  setAccountability(accountabilityData);
}
const { data: casesData, error: casesError } =
  await supabase.rpc('get_admin_cases_count');

if (casesError) {
  console.error('Cases count error:', casesError);
} else {
  setCasesCount(casesData);
}
const { data: completedSessions, error: sessionsError } =
  await supabase.rpc('get_admin_completed_sessions_open_cases');

if (sessionsError) {
  console.error('Completed sessions error:', sessionsError);
} else {
  setCompletedSessionsCount(completedSessions);
}
const { data: attendanceData, error: attendanceError } =
  await supabase.rpc('get_admin_attendance_count');

if (attendanceError) {
  console.error('Attendance count error:', attendanceError);
} else {
  setAttendanceCount(attendanceData);
}
    setAnalytics({
      teens: data.teens,
      parents: data.parents,
      counselors: data.counselors,
      psychologists: data.psychologists,
      aiDetections: data.aiDetections,
      highRiskAlerts: data.highRiskAlerts,
      publicSessions: data.publicSessions,
      privateSessions: data.privateSessions,
    });
  };

  fetchAnalytics();
  fetchAdminOpenCases(); 
}, [activeTab]);
const [aiTrend, setAiTrend] = useState<
  { date: string; count: number }[]
>([]);
useEffect(() => {
  if (activeTab !== 'users') return;

  const fetchUserMonitoring = async () => {
    // System Status (later you’ll implement logic)
    const { data: status, error: statusError } =
      await supabase.rpc('get_user_system_status');

    if (statusError) console.error('User system status error:', statusError);
    else setUserStatus(Number(status ?? 0));

    // Cards
    const { data: cards, error: cardsError } =
      await supabase.rpc('get_user_monitoring_cards');

    if (cardsError) console.error('User cards error:', cardsError);
    else if (cards) {
      setUserCards({
        users: Number(cards.users ?? 0),
        community_messages: Number(cards.community_messages ?? 0),
        private_messages: Number(cards.private_messages ?? 0),
      });
    }

    // Users list
    const { data: usersData, error: usersError } =
      await supabase.rpc('get_user_monitoring_users', { p_limit: 200, p_offset: 0 });

    if (usersError) console.error('User monitoring users error:', usersError);
    else setUserMonitoringUsers(usersData ?? []);
  };

  fetchUserMonitoring();
}, [activeTab]);
useEffect(() => {
  if (activeTab !== 'analytics') return;

  const fetchAiTrend = async () => {
    const { data, error } = await supabase.rpc('get_ai_detections_last_7_days');

    if (error) {
      console.error('AI trend error:', error);
      return;
    }

    setAiTrend(data);
  };

  fetchAiTrend();
}, [activeTab]);
const fetchAdminOpenCases = async () => {
  const { data, error } = await supabase
    .rpc('get_admin_open_cases_with_sessions');

  if (error) {
    console.error('Open cases error:', error);
    return;
  }

  setOpenCases(data ?? []);

  // 🔁 group sessions by case
  const grouped: Record<string, { scheduled: number; completed: number }> = {};

  (data ?? []).forEach((row: any) => {
    if (!grouped[row.case_id]) {
      grouped[row.case_id] = { scheduled: 0, completed: 0 };
    }

    if (row.session_status === 'scheduled') {
      grouped[row.case_id].scheduled++;
    }
    if (row.session_status === 'completed') {
      grouped[row.case_id].completed++;
    }
  });

  setSessionsByCase(grouped);
};
const navigate = useNavigate();
useEffect(() => {
  const fetchChildren = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .order('name');

    if (!error) setChildren(data || []);
  };

  fetchChildren();
}, []);

const handleLogout = async () => {
  await supabase.auth.signOut();
  navigate('/');
};

 const handleInviteUser = async () => {
  setError('');
  setSuccess('');

 if (!email || !fullName || !role) {
  setError('Please fill all fields');
  return;
}

if (role === 'parent' && !childId) {
  setError('Please select a child for this parent');
  return;
}
  setLoading(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError('You must be logged in');
      return;
    }

    const { error: functionError } =
      await supabase.functions.invoke('invite-web-user', {
        body: {
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

    if (functionError) {
      setError(functionError.message);
      return;
    }
    if (role === 'parent') {
  const { error: linkError } = await supabase
    .from('parent_child_links')
    .insert({
      child_id: childId,
      parent_email: email.trim().toLowerCase(),
      status: 'pending',
    });

  if (linkError) {
    setError('Parent invited but failed to link child');
    return;
  }
}
    setSuccess('Invitation sent successfully');
    setEmail('');
    setFullName('');
    setRole('');
  } catch {
    setError('Something went wrong');
  } finally {
    setLoading(false);
  }
};
const completedSessions = completedSessionsCount;
const reviewRate =
  accountability.total > 0
    ? Math.min(
        100,
        Math.round(
          ((accountability.reviewed + completedSessions) /
            accountability.total) *
            100
        )
      )
    : 0;
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFDBFF',
        color: '#008C33',
        fontFamily: 'Poppins, sans-serif'
      }}
    >
      {/* ================= NAVBAR ================= */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 60px'
        }}
      >
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={avatarIcon}
            alt="ZenGen Avatar"
            style={{ width: '90px', height: '90px' }}
          />
          <h1 style={{ margin: 0, fontWeight: 700 }}>Admin Dashboard</h1>
        </div>

        {/* NAV ITEMS */}
       <div
  style={{
    display: 'flex',
    gap: 22,
    fontSize: '18px',
    fontWeight: 600,
  }}
>
  <span
    style={{
      cursor: 'pointer',
      borderBottom: activeTab === 'invite' ? '3px solid #008C33' : 'none',
    }}
    onClick={() => setActiveTab('invite')}
  >
    Invite User
  </span>

 <span
  style={{
    cursor: 'pointer',
    borderBottom: activeTab === 'analytics' ? '3px solid #008C33' : 'none',
  }}
  onClick={() => setActiveTab('analytics')}
>
  📊 Psychologist Monitoring
</span>
  <span
  style={{
    cursor: 'pointer',
    borderBottom: activeTab === 'counselors' ? '3px solid #008C33' : 'none',
  }}
  onClick={() => setActiveTab('counselors')}
>
  🧑 Counselor Monitoring
</span>
<span
  style={{
    cursor: 'pointer',
    borderBottom: activeTab === 'users' ? '3px solid #008C33' : 'none',
  }}
  onClick={() => setActiveTab('users')}
>
  👤 User Monitoring
</span>

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

      {/* ================= CONTENT ================= */}
      {/* ================= CONTENT ================= */}
{activeTab === 'invite' && (
  <section
    style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '80px 40px'
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'rgba(255,255,255,0.65)',
        borderRadius: '28px',
        padding: '48px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(8px)'
      }}
    >
          <h2 style={{ marginBottom: '12px' }}>
            Invite a new user
          </h2>

          <p style={{ marginBottom: '28px', opacity: 0.85 }}>
            Create an account for parents, counselors, or psychologists.
            The user will receive an email to set their password.
          </p>

          {/* FULL NAME */}
          <label style={labelStyle}>Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            style={inputStyle}
          />

          {/* EMAIL */}
          <label style={labelStyle}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            style={inputStyle}
          />

          {/* ROLE */}
          <label style={labelStyle}>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select role</option>
            <option value="parent">Parent</option>
            <option value="counselor">Counselor</option>
            <option value="psychologist">Psychologist</option>
          </select>
        {role === 'parent' && (
  <>
    <label style={labelStyle}>Child (Teen User)</label>

    <div style={{ position: 'relative' }}>
      <input
        value={childSearch}
        onChange={(e) => {
          setChildSearch(e.target.value);
          setShowChildList(true);
          setChildId('');
        }}
        onFocus={() => setShowChildList(true)}
        placeholder="Search and select child..."
        style={inputStyle}
      />

      {showChildList && filteredChildren.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {filteredChildren.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setChildSearch(c.name); // show name in input
                setChildId(c.id);       // store ID
                setShowChildList(false);
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                fontWeight: 500,
              }}
            >
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  </>
)}
          {/* ACTION */}
          <button
            onClick={handleInviteUser}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: '#008C33',
              color: '#FFDBFF',
              fontWeight: 700,
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 22px rgba(0,140,51,0.35)',
              marginTop: '12px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Sending Invite...' : 'Send Invite'}
          </button>

          {/* FEEDBACK */}
          {error && (
            <p style={{ color: 'red', marginTop: '14px' }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{ color: '#008C33', marginTop: '14px' }}>
              {success}
            </p>
          )}
                </div>
      </section>
)}

{/* ================= ANALYTICS TAB ================= */}
{activeTab === 'analytics' && (
  <section style={{ padding: '60px' }}>
<div
  style={{
    background: '#fff',
    padding: '28px',
    borderRadius: 22,
    marginBottom: 32,
    boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
    textAlign: 'center',
  }}
>
  <h3 style={{ marginBottom: 12 }}>🧠 System Status</h3>

  <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
    Psychologist Review Completion
  </p>

  <div
    style={{
      fontSize: 48,
      fontWeight: 800,
      color:
        reviewRate >= 80
          ? '#008C33'
          : reviewRate >= 50
          ? '#f39c12'
          : '#e74c3c',
      transition: 'all 0.4s ease',
    }}
  >
    {reviewRate}%
  </div>

  <p
    style={{
      marginTop: 12,
      fontWeight: 600,
      color:
        reviewRate >= 80
          ? '#008C33'
          : reviewRate >= 50
          ? '#f39c12'
          : '#e74c3c',
      transition: 'color 0.3s ease',
    }}
  >
    {reviewRate >= 80
      ? 'System operating normally'
      : reviewRate >= 50
      ? 'Review backlog forming'
      : 'Immediate review action required'}
  </p>
</div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 24,
      }}
    >
      <StatCard title="Psychologists" value={analytics.psychologists} />
     <StatCard
  title="Sensitive Content Detections"
  value={analytics.aiDetections}
/>
<StatCard
  title="Cases"
  value={casesCount}
/>
      <StatCard title="Private Sessions" value={analytics.privateSessions} />
    </div>
    <h3 style={{ marginTop: 40, marginBottom: 20 }}>
  📂 Opened Cases
</h3>

<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
    gap: 24,
  }}
>
  {Object.entries(sessionsByCase).map(([caseId, stats]) => {
    const caseRow = openCases.find(c => c.case_id === caseId);
    if (!caseRow) return null;

    return (
      <div
        key={caseId}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
        }}
      >
        <h4 style={{ marginTop: 0 }}>{caseRow.teen_name}</h4>

        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Psychologist: {caseRow.psychologist_name}
        </p>

        <p>Risk: <strong>{caseRow.risk_level}</strong></p>

        <p>📅 Scheduled Sessions: <strong>{stats.scheduled}</strong></p>
        <p>✅ Completed Sessions: <strong>{stats.completed}</strong></p>
      </div>
    );
  })}
</div>
    {/* ================= AI DETECTIONS TREND ================= */}
<div
  style={{
    marginTop: 48,
    background: '#fff',
    padding: '32px',
    borderRadius: 22,
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  }}
>
  <h2 style={{ marginBottom: 24 }}>
    🧠 Sensitive Content Oversight (Last 7 Days)
  </h2>

  {/* ================= GRAPH ================= */}
  {(() => {
    const maxCount = Math.max(...aiTrend.map(d => d.count), 1);

    return (
      <div style={{ marginBottom: 36 }}>
        <h4 style={{ marginBottom: 16 }}>📊 Detection Trend</h4>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 32,
              height: 180,
              maxWidth: 520,
              width: '100%',
              borderBottom: '1px solid #eee',
              paddingBottom: 12,
            }}
          >
            {aiTrend.map((d) => (
              <div
                key={d.date}
                style={{
                  width: 48,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    height: `${(d.count / maxCount) * 140}px`,
                    background: '#008C33',
                    borderRadius: 10,
                  }}
                />
                <p style={{ marginTop: 10, fontSize: 13 }}>
                  {d.date}
                </p>
                <p style={{ fontSize: 12, opacity: 0.6 }}>
                  {d.count}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  })()}

  {/* ================= ACCOUNTABILITY SUMMARY ================= */}
  <div>
    <h4 style={{ marginBottom: 16 }}>🧠 Psychologist Accountability</h4>

    <p>
      📊 Total Sensitive Detections:{' '}
      <strong>{accountability.total}</strong>
    </p>

    <p style={{ color: '#3498db' }}>
      👁️ Reviewed by Psychologists:{' '}
      <strong>{accountability.reviewed}</strong>
    </p>
    <p style={{ color: '#27ae60' }}>
  ✅ Completed Sessions (Active Cases):{' '}
  <strong>{completedSessionsCount}</strong>
</p>
  </div>
</div>
  </section>
)}
{activeTab === 'counselors' && (
  <section style={{ padding: '60px' }}>
    {/* SYSTEM STATUS */}
    <div
      style={{
        background: '#fff',
        padding: 28,
        borderRadius: 22,
        marginBottom: 32,
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}
    >
      <h3>🧠 Counselor System Status</h3>

      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color:
            counselorStatus >= 80
              ? '#008C33'
              : counselorStatus >= 50
              ? '#f39c12'
              : '#e74c3c',
        }}
      >
        {counselorStatus}%
      </div>

      <p style={{ marginTop: 12 }}>
        Weekly Session Delivery & Attendance
      </p>
    </div>

    {/* CARDS */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 24,
      }}
    >
     <StatCard title="Counselors" value={analytics.counselors} />
      <StatCard title="Public Sessions" value={counselorCards.public_sessions} />
    
    </div>

    {/* WEEKLY ATTENDANCE GRAPH */}
    <div
  style={{
    marginTop: 48,
    background: '#fff',
    padding: 32,
    borderRadius: 22,
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  }}
>
  <h3>📊 Weekly Attendance</h3>

  {(() => {
    // attendance is percentage-based (0–100)
    const maxCount = 100;

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 32,
            height: 180,
            maxWidth: 520,
            width: '100%',
            borderBottom: '1px solid #eee',
            paddingBottom: 12,
          }}
        >
          {counselorTrend.map((w) => (
            <div
              key={w.week}
              style={{
                width: 90,
                textAlign: 'center',
              }}
            >
              {/* Attendance percentage */}
              <div
                style={{
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#008C33',
                }}
              >
                {Math.round(w.count)}%
              </div>

              {/* Bar */}
              <div
                style={{
                  height: `${(w.count / maxCount) * 140}px`,
                  background: '#008C33',
                  borderRadius: 10,
                  transition: 'height 0.4s ease',
                }}
              />

              {/* Session name */}
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {w.week}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  })()}
</div>

    {/* ACCOUNTABILITY */}
    <div
      style={{
        marginTop: 40,
        background: '#fff',
        padding: 28,
        borderRadius: 22,
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
      }}
    >
      <h3>🧠 Counselor Accountability</h3>
      <p>✅ Completed Sessions: {counselorAccountability.completed_sessions}</p>
      <p>👥 Avg Attendance: {counselorAccountability.average_attendance}</p>
      <p>📊 Overall Attendance Rate: {counselorAccountability.overall_attendance_rate}%</p>
    </div>
  </section>
)}
{activeTab === 'users' && (
  <section style={{ padding: '60px' }}>
    {/* SYSTEM STATUS */}
    <div
      style={{
        background: '#fff',
        padding: 28,
        borderRadius: 22,
        marginBottom: 32,
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}
    >
      <h3>🧠 User System Status</h3>
      <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
  Average user engagement & progress
</p>
<div
  style={{
    marginTop: 18,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  }}
>
  {userMonitoringUsers.map((u) => (
    <div
      key={u.id}
      style={{
        fontSize: 12,
        padding: '6px 10px',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.05)',
        fontWeight: 600,
      }}
    >
      {u.name}: {Math.round(u.overall_performance || 0)}%
    </div>
  ))}
</div>

<div
  style={{
    fontSize: 48,
    fontWeight: 800,
    color:
      userStatus >= 80
        ? '#008C33'
        : userStatus >= 50
        ? '#f39c12'
        : '#e74c3c',
  }}
>
  {userStatus}%
</div>

<p style={{ marginTop: 12 }}>
  Calculated from attendance and private session progress
</p>
    </div>

    {/* CARDS */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 24,
      }}
    >
      <StatCard title="Users" value={userCards.users} />
      <StatCard title="Community Messages" value={userCards.community_messages} />
      <StatCard title="Private Messages" value={userCards.private_messages} />
    </div>

    {/* USERS LIST */}
    <h3 style={{ marginTop: 40, marginBottom: 20 }}>👥 Users</h3>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 24,
      }}
    >
      {userMonitoringUsers.map((u) => {
       const hasAnyData = u.has_attendance || u.has_private_progress;

        // attendance trend: array of 0/1 (most recent first)
        const trend: number[] = Array.isArray(u.attendance_trend) ? u.attendance_trend : [];

        return (
          <div
  key={u.id}
  style={{
    background: '#fff',
    borderRadius: 26,
    padding: 30,
    minHeight: 420,
    boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }}
>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img
                src={u.avatar_url || avatarIcon}
                alt="avatar"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #FFDBFF',
                }}
              />

              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 18 }}>{u.name}</h4>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>
                  {hasAnyData ? 'Activity available' : 'No data for this user'}
                </p>
              </div>

              {/* Attendance rate badge */}
              {u.has_attendance ? (
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 12,
                    background:
  u.overall_performance >= 80
    ? 'rgba(0,140,51,0.12)'
    : u.overall_performance >= 50
    ? 'rgba(243,156,18,0.15)'
    : 'rgba(231,76,60,0.12)',

color:
  u.overall_performance >= 80
    ? '#008C33'
    : u.overall_performance >= 50
    ? '#f39c12'
    : '#e74c3c',
                  }}
                >
                  {Math.round(Number(u.overall_performance || 0))}%
                </div>
              ) : null}
            </div>

            {/* Attendance mini graph */}
           {/* Attendance mini graph */}
<div style={{ marginTop: 20 }}>
  <p style={{ marginBottom: 4, fontSize: 13, fontWeight: 700 }}>
    📊 Attendance (latest)
  </p>

  <p style={{ marginBottom: 12, fontSize: 11, opacity: 0.65 }}>
    Each bar represents a Friday session.
    Green = attended, red = missed.
  </p>

  {u.has_attendance ? (
    <>
      {/* GRAPH */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 10,
          paddingTop: 6,
        }}
      >
        {u.attendance_trend.map((v: number, idx: number) => (
          <div
            key={idx}
            style={{
              width: 32,              // 👈 compact column
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {/* Bar */}
            <div
              style={{
                height: v === 1 ? 40 : 18,
                width: 10,            // 👈 slim bar
                margin: '0 auto',
                borderRadius: 999,
                background: v === 1 ? '#008C33' : '#e74c3c',
              }}
            />

            {/* Session label (minimized) */}
            <p
              title={u.attendance_session_names?.[idx]}
              style={{
                fontSize: 9,
                marginTop: 6,
                opacity: 0.6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {u.attendance_session_names?.[idx]?.slice(0, 6) || '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <p style={{ fontSize: 12, opacity: 0.75 }}>
        Total: <strong>{u.attendance_total}</strong> • Attended:{' '}
        <strong>{u.attendance_attended}</strong>
      </p>
    </>
  ) : (
    <p style={{ fontSize: 12, opacity: 0.65 }}>
      No attendance records.
    </p>
  )}
</div>


            {/* Progress */}
            <div style={{ marginTop: 18 }}>
              <p style={{ marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
                📈 Private Sessions Progress
              </p>

              {u.has_private_progress ? (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: 12, opacity: 0.8 }}>
                    ✅ Sessions completed: <strong>{u.private_completed}</strong>
                  </p>

                  {/* Simple level bars (keep raw levels; you can normalize later) */}
                  <LevelBar label="Plan" percentage={Number(u.plan_percentage || 0)} />
<LevelBar label="Skills" percentage={Number(u.skills_percentage || 0)} />
<LevelBar label="Goals" percentage={Number(u.goals_percentage || 0)} />

                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>
                  No progress records.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </section>
)}

</div>
);
}
type StatCardProps = {
  title: string;
  value: number;
  onClick?: () => void;
  styleOverride?: React.CSSProperties;
};

function StatCard({ title, value, onClick, styleOverride }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        padding: '28px',
        borderRadius: '20px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
        cursor: onClick ? 'pointer' : 'default',
        ...styleOverride,
      }}
    >
      <h3>{title}</h3>
      <p style={{ fontSize: 32, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
function LevelBar({ label, percentage }: { label: string; percentage: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{pct}%</p>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.08)',
          overflow: 'hidden',
          marginTop: 6,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: '#008C33',
            borderRadius: 999,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const colors: any = {
    Pending: '#f1c40f',
    'Under Review': '#3498db',
    Escalated: '#e74c3c',
  };

  return (
    <span
      style={{
        padding: '6px 12px',
        borderRadius: 12,
        backgroundColor: colors[status],
        color: '#fff',
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}



/* ================= STYLES ================= */

const labelStyle = {
  fontSize: '15px',
  marginBottom: '8px',
  display: 'block',
  fontWeight: 500
};

const inputStyle = {
  width: '100%',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  marginBottom: '22px',
  fontSize: '16px',
  backgroundColor: '#fff',
  outline: 'none',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
};

export default AdminDashboard;
