import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 shadow-sm sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-blue-500/20">
          F
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
            FleetManagementPortal • Ahmedabad Logistics Network
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold shadow-xs transition"
        >
          <span>{isDark ? '☀️' : '🌙'}</span>
          <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>

        <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{user?.name}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {user?.role?.replace('_', ' ')}
          </p>
        </div>

        <button
          onClick={logout}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-transparent dark:border-slate-700 transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
