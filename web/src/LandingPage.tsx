import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import communityImg from './assets/community.png';
import Login from './Login';
import avatarIcon from './assets/avatar.png';
import { supabase } from './supabaseClient';
import { useEffect } from 'react';


function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
  'home' | 'about' | 'contact' | 'login'
>('home');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const handleSendMessage = async () => {
  setLoading(true);
  setError('');
  setSuccess('');

  if (!name || !email || !role || !message) {
    setError('Please fill in all fields.');
    setLoading(false);
    return;
  }

  const { error } = await supabase
    .from('contact_messages')
    .insert([
      {
        name,
        email,
        role,
        message
      }
    ]);

  if (error) {
    setError('Failed to send message. Please try again.');
    console.error(error);
  } else {
    setSuccess('Message sent successfully.');
    setName('');
    setEmail('');
    setRole('');
    setMessage('');
  }

  setLoading(false);
};

useEffect(() => {
  const redirectIfLoggedIn = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    const { data: profile } = await supabase
      .from('web_users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile) return;

    switch (profile.role) {
      case 'admin':
        navigate('/admin', { replace: true });
        break;
      case 'counselor':
        navigate('/counselor', { replace: true });
        break;
      case 'parent':
        navigate('/parent', { replace: true });
        break;
      case 'psychologist':
        navigate('/psychologist', { replace: true });
        break;
    }
  };

  redirectIfLoggedIn();
}, [navigate]);


  return (
  <div
  style={{
    backgroundColor: '#FFDBFF',
    minHeight: '100vh',
    color: '#008C33',
    fontFamily: 'Poppins, sans-serif'
  }}
>
      {/* NAVBAR */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
         padding: '10px 60px'

        }}
      >
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={avatarIcon}
            alt="ZenGen Avatar"
            style={{ width: '120px', height: '120px' }}
          />
          <h1 style={{ margin: 0, fontWeight: 700 }}>ZenGen Zone</h1>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <NavTab
            label="Home"
            isActive={activeTab === 'home'}
            onClick={() => setActiveTab('home')}
          />
          <NavTab
            label="About Us"
            isActive={activeTab === 'about'}
            onClick={() => setActiveTab('about')}
          />
          <NavTab
            label="Contact Us"
            isActive={activeTab === 'contact'}
            onClick={() => setActiveTab('contact')}
          />

          <LoginButton onClick={() => setActiveTab('login')} />

        </div>
      </nav>

      {/* CONTENT */}
      {activeTab === 'home' && (
        <section
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 60px',
    gap: '140px'
  }}
>


          {/* TEXT CARD */}
          <div
            style={{
              maxWidth: '850px',
              backgroundColor: 'rgba(255, 255, 255, 0.55)',
              padding: '40px',
              borderRadius: '24px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.08)',
              backdropFilter: 'blur(6px)'
            }}
          >
            <h1
              style={{
                fontSize: '42px',
                fontWeight: 700,
                marginBottom: '20px',
                lineHeight: 1.2
              }}
            >
              Welcome to <span style={{ color: '#006B26' }}>ZenGen Zone</span> Web
              Platform
            </h1>

            <p style={{ fontSize: '17px', marginBottom: '18px' }}>
              ZenGen Zone is a secure web-based system designed to support the
              mental health and personal development of teenagers through
              professional guidance, responsible supervision, and ethical use
              of artificial intelligence.
            </p>

            <p style={{ fontSize: '17px', marginBottom: '18px' }}>
              This platform enables authorized users—administrators, parents,
              counselors, and psychologists—to collaborate in providing
              structured support, monitoring progress, and responding to
              sensitive or high-risk situations when necessary.
            </p>

            <p style={{ fontSize: '17px', marginBottom: '30px' }}>
              By combining AI-assisted insights with human expertise, ZenGen
              Zone ensures that teenage users receive timely guidance,
              professional care, and a safe environment that prioritizes
              privacy, trust, and well-being.
            </p>

            <button
  onClick={() => setActiveTab('login')}
  style={{
    padding: '14px 34px',
    fontSize: '16px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#008C33',
    color: '#FFDBFF',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 8px 18px rgba(0, 140, 51, 0.35)'
  }}
>
  Get Started
</button>

          </div>

          {/* ANIMATED IMAGE */}
         <div
  style={{
    position: 'relative',
    width: '520px',
    height: '520px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}
>
  {/* COLOR AURA */}
  <div
    style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: '50px',
      background:
        'linear-gradient(120deg, #7CFFB2, #FF9AEF, #8BE9FD)',
      filter: 'blur(50px)',
      opacity: 0.75,
      animation: 'colorPulse 8s ease-in-out infinite'
    }}
  />

  {/* IMAGE */}
  <img
    src={communityImg}
    alt="Community"
    style={{
      width: '520px',
      borderRadius: '48px',
      position: 'relative',
      zIndex: 1,
      animation:
        'heroEnter 1.2s ease-out forwards, breathe 7s ease-in-out infinite',
      boxShadow: '0 30px 70px rgba(0, 140, 51, 0.35)'
    }}
  />
</div>



        </section>
      )}

      {/* EMPTY TABS (CONTENT COMING LATER) */}
      {activeTab === 'about' && (
  <section
    style={{
      padding: '60px',
      maxWidth: '1100px',
      margin: '0 auto',
      color: '#008C33'
    }}
  >
    {/* TITLE */}
    <h1 style={{ fontSize: '42px', marginBottom: '30px' }}>
      About ZenGen Zone
    </h1>

    {/* INTRO */}
    <p style={paragraphStyle}>
      ZenGen Zone is a digital mental health guidance platform designed to
      support teenagers in overcoming psychological challenges, addiction-related
      behaviors, and emotional difficulties through a combination of artificial
      intelligence, professional expertise, and responsible supervision.
    </p>

    {/* HOW IT WORKS */}
    <h2 style={sectionTitle}>How the Platform Works</h2>
    <p style={paragraphStyle}>
      The platform integrates an AI-powered assistant (ZenBot) with licensed
      mental health professionals to provide early risk detection and structured
      guidance. ZenBot assists users in daily interactions by recognizing
      emotional patterns and sensitive language, while human professionals
      handle evaluation, decision-making, and intervention when necessary.
    </p>

    {/* ROLES */}
    <h2 style={sectionTitle}>Roles & Responsibilities</h2>

    <div style={roleGrid}>
      <RoleCard
        title="Teen Users"
        text="Teenagers use the mobile application to interact with ZenBot, manage daily tasks through the planner, participate in community discussions, attend counseling sessions, and track personal progress."
      />

      <RoleCard
        title="Counselors"
        text="Counselors provide general guidance through public sessions, educational discussions, and community engagement, focusing on prevention, awareness, and emotional support."
      />

      <RoleCard
        title="Psychologists"
        text="Psychologists manage sensitive and high-risk cases identified by the system. They review flagged interactions, conduct private sessions, assess user well-being, and coordinate appropriate intervention when needed."
      />

      <RoleCard
        title="Parents"
        text="Parents receive structured insights into their child’s progress and are notified only when professional intervention is required, ensuring a balance between transparency and user privacy."
      />

      <RoleCard
        title="Administrators"
        text="Administrators manage platform operations, user roles, session scheduling, and system integrity, ensuring ethical standards, data security, and smooth collaboration between all stakeholders."
      />
    </div>

    {/* ETHICS */}
    <h2 style={sectionTitle}>Ethics, Privacy & Safety</h2>
    <p style={paragraphStyle}>
      ZenGen Zone prioritizes user privacy, ethical AI usage, and responsible
      data handling. Sensitive information is accessed only by authorized
      professionals, and escalation procedures are followed strictly in cases
      of potential risk to ensure user safety while maintaining trust.
    </p>
  </section>
)}
{activeTab === 'contact' && (
  <section
    style={{
      padding: '80px 60px',
      maxWidth: '1000px',
      margin: '0 auto',
      color: '#008C33'
    }}
  >
    {/* TITLE */}
    <h1 style={{ fontSize: '42px', marginBottom: '30px' }}>
      Contact Us
    </h1>

    {/* INTRO */}
    <p style={paragraphStyle}>
      ZenGen Zone is committed to providing a safe, reliable, and responsive
      platform for all authorized users. If you have questions, concerns, or
      require assistance related to the web platform, please use the contact
      information below.
    </p>

    {/* WHO SHOULD CONTACT */}
    <h2 style={sectionTitle}>Who Should Contact Us?</h2>

    <ul style={{ lineHeight: 1.8, fontSize: '17px', marginBottom: '30px' }}>
      <li>
        <strong>Parents:</strong> Questions related to session payments,
        notifications, or professional recommendations.
      </li>
      <li>
        <strong>Counselors & Psychologists:</strong> Technical issues, session
        management support, or platform access concerns.
      </li>
      <li>
        <strong>Administrators:</strong> System configuration, user management,
        and operational matters.
      </li>
    </ul>

    {/* SUPPORT INFO */}
    <h2 style={sectionTitle}>General Support</h2>
    <p style={paragraphStyle}>
      <strong>Email:</strong>baydounyara54@gmail.com <br />
      <strong>Working Hours:</strong> Sunday – Thursday, 9:00 AM – 5:00 PM
    </p>

    {/* EMERGENCY NOTICE */}
    <div
      style={{
        marginTop: '40px',
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: 'rgba(255, 0, 0, 0.08)'
      }}
    >
      <h3 style={{ marginBottom: '10px' }}>🚨 Emergency Notice</h3>
      <p style={{ fontSize: '16px', lineHeight: 1.6 }}>
        ZenGen Zone is not an emergency response service. If a user is in
        immediate danger, please contact local emergency services directly.
      </p>
    </div>

    {/* OPTIONAL CONTACT FORM */}
    <h2 style={{ ...sectionTitle, marginTop: '50px' }}>
  Contact & Join ZenGen Zone
</h2>

<p style={{ maxWidth: '600px', marginBottom: '24px', opacity: 0.85 }}>
  This form is for non-urgent messages. Parents can contact us for support or
  questions, and counselors or psychologists may use this form to apply to join
  the ZenGen Zone platform.
</p><form
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '500px'
  }}
>
  <input
    type="text"
    placeholder="Full Name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    style={inputStyle}
  />

  <input
    type="email"
    placeholder="Email Address"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    style={inputStyle}
  />

  <select
    value={role}
    onChange={(e) => setRole(e.target.value)}
    style={inputStyle}
  >
    <option value="">I am contacting as a...</option>
    <option value="parent">Parent / Guardian</option>
    <option value="counselor">Counselor (Applying to Join)</option>
    <option value="psychologist">Psychologist (Applying to Join)</option>
  </select>

  <textarea
    placeholder="Your message (For professionals: include experience, certifications, and availability)"
    rows={5}
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    style={{ ...inputStyle, resize: 'vertical' }}
  />

  <button
    type="button"
    onClick={handleSendMessage}
    disabled={loading}
    style={{
      padding: '14px',
      borderRadius: '10px',
      border: 'none',
      backgroundColor: loading ? '#6fae8a' : '#008C33',
      color: '#FFDBFF',
      fontWeight: 700,
      cursor: loading ? 'not-allowed' : 'pointer'
    }}
  >
    {loading ? 'Sending...' : 'Send Message'}
  </button>

  {error && (
    <p style={{ color: 'red', marginTop: '10px' }}>
      {error}
    </p>
  )}

  {success && (
    <p style={{ color: '#008C33', marginTop: '10px' }}>
      {success}
    </p>
  )}
</form>

  </section>
)}
{activeTab === 'login' && (
  <Login />
)}
      {/* KEYFRAMES */}
     <style>
  {`
    /* Entrance animation */
    @keyframes heroEnter {
      0% {
        opacity: 0;
        transform: translateY(40px) scale(0.92);
      }
      100% {
        opacity: 1;
        transform: translateY(0px) scale(1);
      }
    }

    /* Image breathing motion */
    @keyframes breathe {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
    }

    /* Color aura animation */
    @keyframes colorPulse {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.85;
      }
      100% {
        transform: scale(1);
        opacity: 0.6;
      }
    }
  `}
</style>

    </div>
  );
}

/* ================= COMPONENTS ================= */

function NavTab({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: '18px',
        fontWeight: 600,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#008C33',
        paddingBottom: '6px',
        borderBottom: isActive
          ? '3px solid #008C33'
          : hover
          ? '3px solid rgba(0,140,51,0.4)'
          : '3px solid transparent',
        transition: 'all 0.2s ease'
      }}
    >
      {label}
    </button>
  );
}

function LoginButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: '14px 28px',
        fontSize: '18px',
        fontWeight: 700,
        borderRadius: '12px',
        border: '2px solid #008C33',
        backgroundColor: hover ? '#008C33' : 'transparent',
        color: hover ? '#FFDBFF' : '#008C33',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: active ? 'scale(0.96)' : 'scale(1)',
        boxShadow: hover
          ? '0 6px 14px rgba(0, 140, 51, 0.25)'
          : 'none'
      }}
    >
      Login
    </button>
  );
}
const paragraphStyle = {
  fontSize: '17px',
  lineHeight: 1.7,
  marginBottom: '24px'
};

const sectionTitle = {
  fontSize: '28px',
  marginTop: '40px',
  marginBottom: '20px'
};

const roleGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '20px',
  marginBottom: '40px'
};

function RoleCard({
  title,
  text
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        padding: '20px',
        borderRadius: '16px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(6px)'
      }}
    >
      <h3 style={{ marginBottom: '10px' }}>{title}</h3>
      <p style={{ fontSize: '15px', lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}
const labelStyle = {
  fontSize: '16px',
  marginBottom: '6px',
  display: 'block'
};

const inputStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: 'none',
  marginBottom: '20px',
  fontSize: '16px',
  color: '#517861',
  backgroundColor: '#fff'
};

const passwordWrapper = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: '12px',
  paddingRight: '12px',
  marginBottom: '6px'
};

const eyeIcon = {
  cursor: 'pointer',
  fontSize: '18px',
  color: '#517861'
};

const signInButton = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: '#008C33',
  color: '#fff',
  fontWeight: 600,
  fontSize: '15px',
  cursor: 'pointer'
};


export default LandingPage;
