import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

function ActivateAccount() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  /* ================= ACCESS CONTROL ================= */

 useEffect(() => {
  const exchangeInviteLink = async () => {
    // This converts the invite link code into a session
    const { error } = await supabase.auth.exchangeCodeForSession(
      window.location.href
    );

    if (error) {
      console.log("❌ exchangeCodeForSession error:", error.message);
      setError("Activation link is invalid or expired. Please request a new invite.");
    } else {
      console.log("✅ exchangeCodeForSession success");
    }
  };

  exchangeInviteLink();
}, []);

  /* ================= ACTIVATE ACCOUNT ================= */

  const activateAccount = async () => {
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ Set password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (passwordError) {
        setError(passwordError.message);
        setLoading(false);
        return;
      }

      // 2️⃣ Get user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Session expired. Please request a new invite.');
        setLoading(false);
        return;
      }

      // 3️⃣ Insert into web_users
     const email = (user.email ?? '').trim().toLowerCase(); // Normalize for parent_child_links matching
      const role = user.user_metadata?.role || 'parent';

      const { error: insertError } = await supabase
        .from('web_users')
        .upsert({
          id: user.id,
          email,
          full_name:
            user.user_metadata?.full_name ||
            (email ? email.split('@')[0] : 'user'),
          role,
        });

      if (insertError) {
        setError('Failed to activate account');
        setLoading(false);
        return;
      }


      alert('Account activated successfully 🎉');

      await supabase.auth.signOut();
      navigate('/login');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
   <section
  style={{
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#FFDBFF',
    padding: '20px',
  }}
>
      <div
  style={{
    width: '100%',
    maxWidth: 420,
    padding: 32,
    borderRadius: 20,
    background: '#fff',
    boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
    margin: '0 16px',
  }}
>
        <h2 style={{ color: '#008C33', marginBottom: 8 }}>
          Activate your account
        </h2>

        <p style={{ marginBottom: 20 }}>
          Create a password to complete your ZenGen account.
        </p>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
           style={{
  width: '100%',
  padding: 14,
  borderRadius: 10,
  fontSize: 16,
}}
          />
          <span
            style={{
              position: 'absolute',
              right: 10,
              top: 14,
              cursor: 'pointer',
            }}
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? '🙈' : '👁'}
          </span>
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
           style={{
  width: '100%',
  padding: 14,
  borderRadius: 10,
  fontSize: 16,
}}
          />
          <span
            style={{
              position: 'absolute',
              right: 10,
              top: 14,
              cursor: 'pointer',
            }}
            onClick={() => setShowConfirm(!showConfirm)}
          >
            {showConfirm ? '🙈' : '👁'}
          </span>
        </div>

        {error && (
          <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>
        )}

        <button
          onClick={activateAccount}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 10,
            border: 'none',
            background: '#008C33',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Activating...' : 'Activate Account'}
        </button>
      </div>
    </section>
  );
}
<style>
{`
@media (max-width: 480px) {
  h2 {
    font-size: 22px !important;
  }

  p {
    font-size: 14px !important;
  }

  button {
    font-size: 15px !important;
  }
}
`}
</style>

export default ActivateAccount;
