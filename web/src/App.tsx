import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import Login from './Login';
import AdminDashboard from './dashboards/AdminDashboard';
import ResetPassword from './ResetPassword';
import ActivateAccount from './ActivateAccount';
import CounselorDashboard from './dashboards/CounselorDashboard';
import CounselorAttendance from './CounselorAttendance';
import PsychologistDashboard from './dashboards/PsychologistDashboard';
import ParentsDashboard from './dashboards/ParentsDashboard';



function App() {
  return (
    <Routes>
      {/* ================= PUBLIC ROUTES ================= */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Supabase invite / activation */}
      <Route path="/activate-account" element={<ActivateAccount />} />
      {/* Backwards-compatible alias (older links) */}
      <Route path="/activateaccount" element={<Navigate to="/activate-account" replace />} />
      <Route path="/counselor/attendance" element={<CounselorAttendance />}/>



      {/* ================= DASHBOARDS (PROTECTED LATER) ================= */}
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/counselor" element={<CounselorDashboard />} />
      <Route path="/psychologist"element={<PsychologistDashboard />}/>
      <Route path="/parent" element={<ParentsDashboard />} />

      {/* ================= FALLBACK ================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
