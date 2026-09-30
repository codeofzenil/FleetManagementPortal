import React from 'react';

// Donut / Ring chart for status distribution (Vehicles or Parcels)
export function StatusRingChart({ data = [], title = 'Status Distribution', size = 160 }) {
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0);
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const slices = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -accumulated * circumference;
    accumulated += pct;
    return {
      ...d,
      pct: Math.round(pct * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 p-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800 transition-colors"
          />
          {slices.map((s, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={s.strokeDasharray}
              strokeDashoffset={s.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          ))}
        </svg>
        <div className="absolute text-center">
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{total}</span>
          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Total</span>
        </div>
      </div>

      <div className="space-y-2 flex-1 w-full">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
        {slices.map((s, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600 dark:text-slate-300 font-medium capitalize">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">{s.value}</span>
              <span className="text-slate-400 dark:text-slate-400 text-[11px] w-8 text-right">({s.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Vehicle Load vs Capacity Bar Chart
export function CapacityBarChart({ vehicles = [] }) {
  if (!vehicles.length) {
    return <div className="text-xs text-slate-400 italic p-4 text-center">No vehicle data available</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {vehicles.map((v) => {
        const pct = Math.min(100, Math.round(((v.current_load_kg || 0) / (v.max_weight_kg || 1)) * 100));
        let barColor = 'bg-emerald-500';
        let badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
        if (pct >= 85) {
          barColor = 'bg-rose-500';
          badgeColor = 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
        } else if (pct >= 60) {
          barColor = 'bg-amber-500';
          badgeColor = 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
        }

        return (
          <div key={v.id} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-200">{v.vehicle_number}</span>
                <span className="text-slate-400 dark:text-slate-400 text-[11px]">({v.type})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-300 font-medium font-mono text-[11px]">
                  {v.current_load_kg || 0} / {v.max_weight_kg} kg
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                  {pct}%
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden transition-colors">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Parcel Pipeline Status Distribution Visual
export function ParcelPipelineChart({ parcels = [] }) {
  const statuses = [
    {
      key: 'pending',
      label: 'Pending Queue',
      color: 'bg-amber-500',
      textCol: 'text-amber-700 dark:text-amber-300',
      bgSoft: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50'
    },
    {
      key: 'assigned',
      label: 'Assigned',
      color: 'bg-blue-500',
      textCol: 'text-blue-700 dark:text-blue-300',
      bgSoft: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50'
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      color: 'bg-purple-500',
      textCol: 'text-purple-700 dark:text-purple-300',
      bgSoft: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/50'
    },
    {
      key: 'delivered',
      label: 'Delivered',
      color: 'bg-emerald-500',
      textCol: 'text-emerald-700 dark:text-emerald-300',
      bgSoft: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50'
    },
  ];

  const total = parcels.length || 1;
  const counts = statuses.map((s) => {
    const count = parcels.filter((p) => p.status === s.key).length;
    return { ...s, count, pct: Math.round((count / total) * 100) };
  });

  return (
    <div className="space-y-4 p-4">
      {/* Segmented Progress Bar */}
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex transition-colors">
        {counts.map((s) => (
          <div
            key={s.key}
            className={`h-full ${s.color} transition-all duration-500`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.count} (${s.pct}%)`}
          />
        ))}
      </div>

      {/* Grid Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {counts.map((s) => (
          <div key={s.key} className={`p-3 rounded-xl border transition-colors ${s.bgSoft}`}>
            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{s.label}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className={`text-xl font-black ${s.textCol}`}>{s.count}</span>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 7-Factor AMFOA Score Breakdown Visualizer
export function AMFOAScoreVisualizer({ breakdown = {}, totalScore = 0 }) {
  const factors = [
    { key: 'distScore', label: 'Distance Score (Dijkstra)', weight: '25%', val: breakdown.distScore ?? 0, raw: `${breakdown.distanceKm ?? 0} km` },
    { key: 'capacityScore', label: 'Remaining Capacity Fit', weight: '20%', val: breakdown.capacityScore ?? 0, raw: 'Load ratio' },
    { key: 'deadlineScore', label: 'Deadline Urgency Match', weight: '20%', val: breakdown.deadlineScore ?? 0, raw: 'Time window' },
    { key: 'fuelScore', label: 'Fuel & Eco Efficiency', weight: '10%', val: breakdown.fuelScore ?? 0, raw: 'km/L rating' },
    { key: 'driverHoursScore', label: 'Driver Working Hours Left', weight: '10%', val: breakdown.driverHoursScore ?? 0, raw: 'Shift hours' },
    { key: 'healthScore', label: 'Vehicle Health Index', weight: '10%', val: breakdown.healthScore ?? 0, raw: 'Maintenance' },
    { key: 'priorityScore', label: 'Consignment Priority Weight', weight: '5%', val: breakdown.priorityScore ?? 0, raw: 'Tier 1-5' },
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 space-y-4 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">AMFOA Multi-Factor Breakdown</span>
          <span className="block text-[11px] text-slate-400 dark:text-slate-400">7 Weighted Optimization Vectors</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 dark:text-slate-400 block font-medium">Total Score</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{(totalScore || 0).toFixed(3)}</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {factors.map((f) => {
          const scoreVal = typeof f.val === 'number' ? f.val : parseFloat(f.val) || 0;
          const pct = Math.round(scoreVal * 100);
          return (
            <div key={f.key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{f.label}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700 px-1 py-0.5 rounded font-mono">
                    wt: {f.weight}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 dark:text-slate-400">{f.raw}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 font-mono w-10 text-right">{scoreVal.toFixed(3)}</span>
                </div>
              </div>
              <div className="w-full bg-slate-200/80 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden transition-colors">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Radial Circular Gauge for Vehicle Readiness Index
export function CircularGauge({ score = 0, size = 120, label = 'Readiness Index' }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (validScore / 100) * circumference;

  let strokeColor = '#10b981'; // emerald
  if (validScore < 50) strokeColor = '#f43f5e'; // rose
  else if (validScore < 75) strokeColor = '#f59e0b'; // amber

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800 transition-colors"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute text-center">
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{validScore}</span>
          <span className="block text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-2">{label}</span>
    </div>
  );
}
