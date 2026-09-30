const COLORS = {
  brand: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100/80 dark:border-blue-800/60',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-800/60',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-100/80 dark:border-amber-800/60',
  red: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-100/80 dark:border-rose-800/60',
};

export default function StatCard({ label, value, accent = 'brand', icon }) {
  const classes = COLORS[accent] || COLORS.brand;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 transition-colors">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xs ${classes}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{value}</p>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}
