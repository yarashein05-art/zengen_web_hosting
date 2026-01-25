import { useEffect, useState } from 'react';
import avatarIcon from '../assets/parent.png';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

/* ================= TYPES ================= */

type ParentAlert = {
  id: string;
  child_id: string;
  detected_word: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  private_session_id?: string | null; // ✅ ADD
};
type EmergencyCasePayment = {
  alert_id: string;
  payment_status: 'paid' | 'unpaid';
};


/* ================= COMPONENT ================= */

function ParentsDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const [tab, setTab] = useState<
    'overview' | 'alerts' | 'sessions' | 'payments' | 'reports'
  >('overview');
  
const [payments, setPayments] = useState<Record<string, 'paid' | 'unpaid'>>({});


  /* ================= ALERTS STATE ================= */

  const [alerts, setAlerts] = useState<ParentAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [psychologistName, setPsychologistName] = useState<string>('Psychologist');

  const unreadCount = alerts.filter(a => a.status === 'unread').length;

  /* ================= FETCH ALERTS ================= */

  const fetchAlerts = async () => {
    setAlertsError('');
    setAlertsLoading(true);

    try {
      const { data, error } = await supabase
        .from('parent_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setAlertsError(error.message);
        return;
      }

      setAlerts((data ?? []) as ParentAlert[]);
      fetchPaymentStatuses(data ?? []); 

    } catch {
      setAlertsError('Failed to load alerts.');
    } finally {
      setAlertsLoading(false);
    }
  };

  /* ================= MARK ALERT READ ================= */

 const markAlertRead = async (id: string) => {
  // ✅ Optimistic UI update
  setAlerts(prev =>
    prev.map(a =>
      a.id === id ? { ...a, status: 'read' } : a
    )
  );

  // ✅ Persist to DB
  await supabase
    .from('parent_alerts')
    .update({ status: 'read' })
    .eq('id', id);
};

  /* ================= GET PSYCHOLOGIST EMAIL ================= */

  const getPsychologistEmail = async (): Promise<string> => {
    const { data, error } = await supabase
      .from('web_users')
      .select('email')
      .eq('role', 'psychologist')
      .limit(1)
      .single();

    if (error || !data?.email) {
      return 'support@zengen.app'; // safe fallback
    }

    return data.email;
  };
  const fetchPaymentStatuses = async (alerts: ParentAlert[]) => {
  if (alerts.length === 0) return;

  const map: Record<string, 'paid' | 'unpaid'> = {};

  /* ================= EMERGENCY PAYMENTS ================= */
  const emergencyAlertIds = alerts
    .filter(a => a.detected_word !== 'payment_reminder')
    .map(a => a.id);

  if (emergencyAlertIds.length > 0) {
    const { data } = await supabase
      .from('emergency_cases')
      .select('alert_id, payment_status')
      .in('alert_id', emergencyAlertIds);

    (data ?? []).forEach(row => {
      map[row.alert_id] = row.payment_status;
    });
  }

  /* ================= SESSION PAYMENTS ================= */
  const sessionIds = alerts
    .filter(a => a.detected_word === 'payment_reminder' && a.private_session_id)
    .map(a => a.private_session_id!);

  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('private_sessions')
      .select('id, payment_status')
      .in('id', sessionIds);

    (data ?? []).forEach(session => {
      map[session.id] = session.payment_status;
    });
  }

  setPayments(map);
};

const fetchPsychologistName = async () => {
  const { data, error } = await supabase
    .from('web_users')
    .select('full_name')
    .eq('role', 'psychologist') // ✅ ENUM-safe
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to load psychologist name:', error);
    setPsychologistName('Your assigned psychologist');
    return;
  }

  if (!data?.full_name) {
    setPsychologistName('Your assigned psychologist');
    return;
  }

  setPsychologistName(data.full_name);
};






  /* ================= CONTACT DOCTOR ================= */

  const contactDoctor = async (alert: ParentAlert) => {
    const psychologistEmail = await getPsychologistEmail();

    const subject = 'Urgent Mental Health Concern';
    const body = `
Hello,

I am contacting you regarding an urgent mental health alert for my child.

Details:
- Risk Level: ${alert.risk_level}
- Detected Concern: "${alert.detected_word}"

Please advise on the next steps.

Thank you.
`;

    // ✅ Open email client (same behavior as counselor dashboard)
    window.location.href = `mailto:${psychologistEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // ✅ Fade alert (do NOT block buttons)
    await markAlertRead(alert.id);
  };
const handlePayNow = async (alert: ParentAlert) => {
  try {
    console.log("Calling Edge Function with alert_id:", alert.id);

    const res = await supabase.functions.invoke(
      "create-stripe-checkout",
      {
        body: { alert_id: alert.id },
      }
    );

    console.log("Edge function raw response:", res);

    if (res.error) {
      throw new Error(res.error.message);
    }

    if (!res.data?.url) {
      throw new Error("No checkout URL returned");
    }

    window.open(res.data.url, "_blank");
  } catch (err: any) {
    console.error("EDGE FUNCTION ERROR:", err);
    window.alert(err.message || "Edge Function call failed");
  }
};

  /* ================= LOAD ALERTS ON TAB OPEN ================= */

  useEffect(() => {
    if (tab === 'alerts') {
      fetchAlerts();
      fetchPsychologistName();
    }
  }, [tab]);
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') {
    fetchAlerts(); // this ALSO refetches payment_status
  }
}, []);
useEffect(() => {
  fetchAlerts(); // 🔔 load immediately for notification badge
}, []);



  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFDBFF',
        color: '#008C33',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* ================= NAVBAR ================= */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={avatarIcon} style={{ width: 90 }} />
          <h1 style={{ margin: 0, fontWeight: 700 }}>Parents Dashboard</h1>
        </div>

        <div style={{ display: 'flex', gap: 18, fontSize: 18, fontWeight: 600 }}>
          <NavTab active={tab === 'overview'} onClick={() => setTab('overview')}>
            👶 Child Overview
          </NavTab>

          <NavTab active={tab === 'alerts'} onClick={() => setTab('alerts')}>
            🚨 Alerts
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
                  minWidth: 20,
                  display: 'inline-block',
                  textAlign: 'center',
                }}
              >
                {unreadCount}
              </span>
            )}
          </NavTab>

          <NavTab active={tab === 'sessions'} onClick={() => setTab('sessions')}>
            📅 Sessions
          </NavTab>
          <NavTab active={tab === 'payments'} onClick={() => setTab('payments')}>
            💳 Payments
          </NavTab>
          <NavTab active={tab === 'reports'} onClick={() => setTab('reports')}>
            📄 Reports
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

      {/* ================= CONTENT ================= */}
      <section style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        {tab === 'alerts' && (
          <div style={{ width: '100%', maxWidth: 900 }}>
            {alertsLoading && <p>Loading alerts...</p>}
            {alertsError && <p style={{ color: 'red' }}>{alertsError}</p>}

            {!alertsLoading &&
  alerts.map(item => {
    const isPaid = payments[item.id] === 'paid';
    const isPaymentAlert = item.detected_word === 'payment_reminder';

    return (
      <Card
        key={item.id}
        style={{
          opacity: item.status === 'read' ? 0.5 : 1,
          boxShadow:
            item.status === 'read'
              ? 'none'
              : '0 10px 28px rgba(231,76,60,0.35)',
          transition: 'all 0.3s ease',
        }}
      >
        <h2 style={{ marginTop: 0 }}>
  {isPaymentAlert
    ? '💳 Session Payment Required'
    : `🚨 High-Risk Case Reviewed by Dr. ${psychologistName}`}
</h2>

        <p>{item.message}</p>

        <p style={{ fontSize: 12, color: '#777' }}>
          {new Date(item.created_at).toLocaleString()}
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
         {!isPaymentAlert && (
  <button
    style={{ ...primaryBtn, background: '#3498db' }}
    onClick={() => contactDoctor(item)}
  >
    Contact Doctor
  </button>
)}
<button
  style={{
    ...primaryBtn,
    background: isPaid ? '#95a5a6' : '#008C33',
    cursor: isPaid ? 'not-allowed' : 'pointer',
    opacity: isPaid ? 0.6 : 1,
  }}
  disabled={isPaid}
  onClick={async () => {
  if (isPaid) return;

  // ✅ IMMEDIATE fade (optimistic UI)
  markAlertRead(item.id);

  // ✅ continue payment flow
  handlePayNow(item);
}}

>
  {isPaid ? '✅ Paid' : 'Pay Now'}
</button>
        </div>
      </Card>
    );
  })}

          </div>
        )}
      </section>
    </div>
  );
}

/* ================= UI COMPONENTS ================= */

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

function Card({ children, style }: any) {
  return (
    <div
      style={{
        background: '#fff',
        padding: 24,
        borderRadius: 24,
        marginBottom: 16,
        boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ================= STYLES ================= */

const primaryBtn = {
  padding: '14px 24px',
  borderRadius: 16,
  border: 'none',
  background: '#008C33',
  color: '#FFDBFF',
  fontWeight: 800,
  cursor: 'pointer',
};

export default ParentsDashboard;
