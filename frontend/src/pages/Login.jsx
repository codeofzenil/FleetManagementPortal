import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';

const ROLE_ROUTES = {
  admin: '/admin',
  fleet_manager: '/fleet-manager',
  driver: '/driver',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Secret Database Seed Easter Egg States
  const [logoClicks, setLogoClicks] = useState(0);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedSecret, setSeedSecret] = useState('FleetPortalSeed2026');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [seedError, setSeedError] = useState('');

  // Keyboard shortcut listener: Ctrl+Shift+S or Cmd+Shift+S opens secret seed modal
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setShowSeedModal(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleLogoClick() {
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowSeedModal(true);
        return 0;
      }
      return next;
    });
  }

  async function handleExecuteSeed() {
    setSeedLoading(true);
    setSeedError('');
    setSeedResult(null);
    try {
      const { data } = await api.post('/seed', { secret: seedSecret });
      setSeedResult(data);
      quickFill('admin@stmpas.com');
    } catch (err) {
      setSeedError(
        err.response?.data?.error ||
        err.response?.data?.details ||
        err.message ||
        'Seed execution failed. Check DB credentials in Vercel.'
      );
    } finally {
      setSeedLoading(false);
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_ROUTES[user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials or run seed.');
    } finally {
      setLoading(false);
    }
  }

  function quickFill(fillEmail, fillPass = 'password123') {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 px-4 py-8 relative">
      {/* Theme toggle on login screen */}
      <div className="absolute top-5 right-5 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 text-amber-300 text-xs font-semibold shadow-xs transition hover:bg-slate-700"
          title="Toggle Theme"
        >
          <span>{isDark ? '☀️ Light' : '🌙 Dark'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-slate-800 transition-colors relative">
        <div className="text-center mb-6">
          {/* Logo with 5-click easter egg to open secret seed modal */}
          <button
            type="button"
            onClick={handleLogoClick}
            title="Click 5 times or press Ctrl+Shift+S for Secret Seed Console"
            className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-500/30 select-none hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            F
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">FleetManagementPortal</h1>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">Smart Transportation & Multi-Constraint Fleet Allocation</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
              Ahmedabad Logistics Hubs
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition"
              placeholder="you@stmpas.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium space-y-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setShowSeedModal(true)}
                className="text-blue-600 dark:text-blue-400 underline font-semibold text-[11px]"
              >
                Database empty? Click here to run Remote Seed Script →
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition disabled:opacity-60"
          >
            {loading ? 'Authenticating…' : 'Sign In to Fleet Portal'}
          </button>
        </form>

        {/* 1-Click Quick Demo Accounts */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 text-center uppercase tracking-wider">
            Quick Fill Demo Accounts (Ahmedabad Fleet)
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => quickFill('admin@stmpas.com')}
              className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 transition text-center"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => quickFill('fleet@stmpas.com')}
              className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 transition text-center"
            >
              🚛 Fleet Mgr
            </button>
            <button
              type="button"
              onClick={() => quickFill('rajesh@stmpas.com')}
              className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 transition text-center"
            >
              👤 Driver
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 px-1">
            <span>Password: <code className="font-mono text-slate-600 dark:text-slate-400">password123</code></span>
            <button
              type="button"
              onClick={() => setShowSeedModal(true)}
              className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition"
              title="Remote Vercel Seed Shortcut"
            >
              ⚡ Seed Database
            </button>
          </div>
        </div>
      </div>

      {/* ================= SECRET SEED MODAL ================= */}
      {showSeedModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Remote Database Seed Console</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-400">
                    Vercel & Cloud PostgreSQL Initialization
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowSeedModal(false); setSeedResult(null); setSeedError(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                This secret tool triggers <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">/api/seed</code> on your deployed Vercel instance. It creates all tables if missing and seeds:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500 dark:text-slate-400 text-[11px]">
                <li><strong>12 Ahmedabad Logistics Nodes</strong> & 15 connecting road graph corridors</li>
                <li><strong>6 Commercial Vehicles</strong> (Tata Ace EV, Ashok Leyland, Bolero, Eicher, Piaggio)</li>
                <li><strong>6 Drivers & Accounts</strong> (password: <code className="font-mono">password123</code>)</li>
                <li><strong>10 Real-world Consignments</strong> ready for AMFOA dispatch</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Seed Authorization Secret
              </label>
              <input
                type="text"
                value={seedSecret}
                onChange={(e) => setSeedSecret(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="FleetPortalSeed2026"
              />
              <span className="text-[10px] text-slate-400 block">
                Matches <code className="font-mono">SEED_SECRET</code> in Vercel environment variables (defaults to <code className="font-mono">FleetPortalSeed2026</code>).
              </span>
            </div>

            {seedError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
                {seedError}
              </div>
            )}

            {seedResult && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <span>✓</span>
                  <span>{seedResult.message}</span>
                </div>
                {seedResult.counts && (
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl">
                    <span>📍 {seedResult.counts.locations} Hubs</span>
                    <span>🚚 {seedResult.counts.vehicles} Vehicles</span>
                    <span>👤 {seedResult.counts.drivers} Drivers</span>
                    <span>📦 {seedResult.counts.parcels} Parcels</span>
                    <span>🛣️ {seedResult.counts.roadEdges} Corridors</span>
                    <span>⚡ {seedResult.counts.activeAssignments} Active Runs</span>
                  </div>
                )}
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Admin credentials (<code className="font-mono">admin@stmpas.com</code>) filled automatically. You can now log in!
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteSeed}
                disabled={seedLoading || !seedSecret}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{seedLoading ? '⏳' : '🚀'}</span>
                <span>{seedLoading ? 'Initializing Schema & Seeding Data…' : 'Execute Seed Script Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowSeedModal(false); setSeedResult(null); setSeedError(''); }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs transition"
              >
                Close
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
              💡 <strong>Direct URL Trick:</strong> You can also trigger this in any browser tab without UI by opening:<br />
              <code className="font-mono text-blue-600 dark:text-blue-400 break-all select-all">
                https://&lt;your-app&gt;.vercel.app/api/seed?secret=FleetPortalSeed2026
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
