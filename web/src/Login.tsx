import { useState ,useEffect} from 'react';
import signinlogo from './assets/signinlogo.png';
import googleIcon from './assets/google_icon.png';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const navigate = useNavigate();

useEffect(() => {
  const { data: listener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;

        try {
          // 🔍 Check if user exists in web_users
          const { data: profile, error } = await supabase
            .from('web_users')
            .select('role')
            .eq('id', user.id)
            .single();

          if (error || !profile) {
            setError(
              'This account is not authorized. Please contact the administrator.'
            );

            // Optional: sign out unauthorized user
            await supabase.auth.signOut();
            return;
          }

          // 🚀 Redirect based on role
          switch (profile.role) {
            case 'admin':
              navigate('/admin');
              break;
            case 'parent':
              navigate('/parent');
              break;
            case 'counselor':
              navigate('/counselor');
              break;
            case 'psychologist':
              navigate('/psychologist');
              break;
            default:
              setError('User role not assigned');
              await supabase.auth.signOut();
          }
        } catch (err) {
          setError('Something went wrong during Google login');
        }
      }
    }
  );

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

const signInWithGoogle = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
       redirectTo: 'https://zengen-web-hosting-wm66.vercel.app/login'
      },
    });

    if (error) {
      setError(error.message);
    }
  } catch (err) {
    setError('Google sign-in failed. Please try again.');
  }
};

const startEmailPasswordReset = async () => {
  if (!email) {
    setError('Please enter your email first');
    return;
  }

  try {
    /* ================= NEW ADDITION ================= */

    // 🔍 Check if email exists
    const { data: emailExists, error: checkError } = await supabase
      .rpc('check_email_exists', { p_email: email.trim().toLowerCase() });

    if (checkError) {
      setError('Something went wrong. Please try again.');
      return;
    }

    if (!emailExists) {
      setError('Please enter the email you logged in with');
      return;
    }

    /* ================= OLD LOGIC (UNCHANGED) ================= */

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
       redirectTo: 'https://zengen-web-hosting-wm66.vercel.app/reset-password'
      }
    );

    if (error) {
      setError(error.message);
      return;
    }

    alert('Password reset link sent to your email');
  } catch (err) {
    setError('Something went wrong. Please try again.');
  }
};


  const validateAndLogin = async () => {
  let valid = true;

  /* ================= OLD LOGIC (KEPT) ================= */

  // EMAIL VALIDATION
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    setEmailError('Please enter a valid email address');
    valid = false;
  } else {
    setEmailError('');
  }

  // PASSWORD VALIDATION
  if (password.length < 8) {
    setPasswordError('Password must be at least 8 characters');
    valid = false;
  } else {
    setPasswordError('');
  }

  if (!valid) return;

  setLoading(true);
  setError('');

  try {
    /* ================= NEW LOGIC (SUPABASE AUTH) ================= */

    // 🔐 1️⃣ Authenticate using Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

    if (authError || !authData.user) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }

    /* ================= OLD IDEA (ROLE-BASED LOGIN, UPDATED SOURCE) ================= */

    // 🔍 2️⃣ Fetch role from web_users table
    const { data: profile, error: profileError } = await supabase
  .from('web_users')
  .select('role')
  .eq('id', authData.user.id)
  .maybeSingle();

console.log('AUTH USER ID:', authData.user.id);
console.log('PROFILE RESULT:', profile);
console.log('PROFILE ERROR:', profileError);

    if (profileError || !profile) {
      setError('User role not found');
      setLoading(false);
      return;
    }

    /* ================= OLD LOGIC (KEPT) ================= */

    // ✅ Redirect based on role
    switch (profile.role) {
      case 'admin':
        navigate('/admin');
        break;
      case 'parent':
        navigate('/parent');
        break;
      case 'counselor':
        navigate('/counselor');
        break;
      case 'psychologist':
        navigate('/psychologist');
        break;
      default:
        setError('Unknown user role');
    }
  } catch (err) {
    setError('Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
};


  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          borderRadius: '28px',
          padding: '48px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(8px)'
        }}
      >
        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src={signinlogo}
            alt="Sign In"
            style={{
              width: '120px',
              height: '150px',
              borderRadius: '22px',
              objectFit: 'cover'
            }}
          />
        </div>

        {/* TITLE */}
        <h2
          style={{
            textAlign: 'center',
            fontSize: '28px',
            fontWeight: 600,
            marginBottom: '36px',
            color: '#008C33'
          }}
        >
          Log in to ZenGen Platform
        </h2>

        {/* EMAIL */}
        <label style={labelStyle}>Email</label>
        <input
  type="email"
  name="email"
  autoComplete="off"
  placeholder="Enter your email"
  value={email}
   onChange={(e) => setEmail(e.target.value)}
  style={inputStyle}
/>
        {emailError && <p style={errorStyle}>{emailError}</p>}

        {/* PASSWORD */}
        <label style={labelStyle}>Password</label>
        <div style={passwordWrapper}>
          <input
  type={showPassword ? 'text' : 'password'}
  name="password"
  autoComplete="new-password"
  placeholder="Enter a password at least 8 characters"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  style={{
    ...inputStyle,
    border: 'none',
    marginBottom: 0
  }}
/>

          <span
            style={eyeIcon}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '🙈' : '👁'}
          </span>
        </div>
        {passwordError && <p style={errorStyle}>{passwordError}</p>}

        {/* FORGOT PASSWORD */}
        <div style={{ textAlign: 'left', marginBottom: '28px' }}>
          <span
  onClick={startEmailPasswordReset}
  style={{ fontSize: '14px', color: '#666', cursor: 'pointer' }}
>
  Forgot password?
</span>

        </div>

        {/* SIGN IN BUTTON */}
        <button
  style={{
    ...signInButton,
    opacity: loading ? 0.7 : 1
  }}
  onClick={validateAndLogin}
  disabled={loading}
>
  {loading ? 'Logging in...' : 'LOGIN'}
</button>
{error && (
  <p style={{ color: 'red', fontSize: '14px', marginBottom: '16px' }}>
    {error}
  </p>
)}


        {/* OR */}
        <div
          style={{
            textAlign: 'center',
            margin: '32px 0',
            color: '#517861',
            fontSize: '14px'
          }}
        >
          or sign in with
        </div>

        {/* GOOGLE */}
       <div style={{ display: 'flex', justifyContent: 'center' }}>
  <div
    onClick={signInWithGoogle}
    style={{
      height: '48px',
      width: '80px',
      backgroundColor: '#fff',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 10px rgba(0,0,0,0.08)'
    }}
  >
    <img src={googleIcon} alt="Google" height={30} />
  </div>
</div>
      </div>
    </section>
  );
}

/* ================= STYLES ================= */

const labelStyle = {
  fontSize: '15px',
  marginBottom: '8px',
  display: 'block',
  color: '#008C33',
  fontWeight: 500
};

const inputStyle = {
  width: '100%',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  marginBottom: '6px',
  fontSize: '16px',
  backgroundColor: '#fff',
  color: '#517861',
  outline: 'none',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
};

const passwordWrapper = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: '14px',
  paddingRight: '14px',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
};

const eyeIcon = {
  cursor: 'pointer',
  fontSize: '18px',
  color: '#517861',
  marginLeft: '8px'
};

const signInButton = {
  width: '100%',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  backgroundColor: '#008C33',
  color: '#FFDBFF',
  fontWeight: 700,
  fontSize: '16px',
  cursor: 'pointer',
  boxShadow: '0 10px 22px rgba(0,140,51,0.35)'
};

const errorStyle = {
  color: 'red',
  fontSize: '13px',
  marginBottom: '12px'
};

<style>
{`
/* ================= LOGIN RESPONSIVE ================= */

@media (max-width: 768px) {
  section {
    padding: 20px !important;
  }

  section > div {
    padding: 32px !important;
    border-radius: 22px !important;
  }

  h2 {
    font-size: 24px !important;
  }

  img[alt="Sign In"] {
    width: 90px !important;
    height: 110px !important;
  }

  input {
    font-size: 15px !important;
    padding: 14px !important;
  }

  button {
    font-size: 15px !important;
    padding: 14px !important;
  }
}

@media (max-width: 480px) {
  section {
    padding: 14px !important;
  }

  section > div {
    padding: 24px !important;
  }

  h2 {
    font-size: 22px !important;
  }

  label {
    font-size: 14px !important;
  }

  input {
    font-size: 14px !important;
  }

  button {
    font-size: 14px !important;
  }

  span {
    font-size: 13px !important;
  }
}
`}
</style>
export default Login;
