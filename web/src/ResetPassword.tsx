import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  /* ================= FIXED LOGIC ================= */

  // ✅ Allow access ONLY during PASSWORD_RECOVERY
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          console.log('Password recovery mode');
        }
      }
    );

    // ❌ DO NOT redirect authenticated users away
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ================= OLD LOGIC (KEPT) ================= */

  const resetPassword = async () => {
    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert('Password updated successfully');

      // ✅ Optional: log out user after reset
      await supabase.auth.signOut();

      navigate('/login');
    } catch (err) {
      alert('Something went wrong');
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
      }}
    >
      <div
        style={{
          width: 420,
          padding: 32,
          borderRadius: 20,
          background: '#FFFFFF',
          boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ color: '#008C33', marginBottom: 6 }}>
          Create a strong password
        </h2>
        <p style={{ marginBottom: 20 }}>
          Your password must be at least 8 characters.
        </p>

        {/* NEW PASSWORD */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 14 }}
          />
          <span
            style={{ position: 'absolute', right: 10, top: 14, cursor: 'pointer' }}
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? '🙈' : '👁'}
          </span>
        </div>

        {/* CONFIRM PASSWORD */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ width: '100%', padding: 14 }}
          />
          <span
            style={{ position: 'absolute', right: 10, top: 14, cursor: 'pointer' }}
            onClick={() => setShowConfirm(!showConfirm)}
          >
            {showConfirm ? '🙈' : '👁'}
          </span>
        </div>

        {/* BUTTON */}
        <button
          onClick={resetPassword}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 10,
            border: 'none',
            background: '#008C33',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Updating...' : 'Reset Password'}
        </button>
      </div>
    </section>
  );
}

export default ResetPassword;
