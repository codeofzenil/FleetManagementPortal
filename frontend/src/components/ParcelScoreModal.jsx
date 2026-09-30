import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AMFOAScoreVisualizer } from './VisualCharts';

export default function ParcelScoreModal({ isOpen, onClose, parcelId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && parcelId) {
      loadBreakdown();
    } else {
      setData(null);
      setError('');
    }
  }, [isOpen, parcelId]);

  async function loadBreakdown() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/assignments/parcel-breakdown/${parcelId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load parcel score breakdown');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const parcel = data?.parcel;
  const breakdown = parcel?.score_breakdown || data?.candidateEvaluations?.[0]?.breakdown || {};
  const candidates = data?.candidateEvaluations || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Parcel #{parcelId} — AMFOA Multi-Constraint Optimization Breakdown
              </h3>
              {parcel?.priority && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  parcel.priority === 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                  parcel.priority === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                }`}>
                  Priority {parcel.priority}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400">Detailed algorithmic scoring breakdown across all fleet vehicles</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
              <span className="inline-block animate-spin mr-2">⚙</span> Computing AMFOA algorithm breakdown…
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl text-xs">
              {error}
            </div>
          )}

          {data && parcel && (
            <>
              {/* Parcel Specs Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Pickup Hub</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parcel.pickup_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Delivery Hub</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parcel.delivery_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Consignment Specs</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parcel.weight_kg} kg | {parcel.volume_m3} m³</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Status & Deadline</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {parcel.status} ({new Date(parcel.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                </div>
              </div>

              {/* Assigned Vehicle Highlight (if assigned) */}
              {parcel.assigned_vehicle_number && (
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      Allocated Vehicle & Driver
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">{parcel.assigned_vehicle_number}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">({parcel.assigned_vehicle_type})</span>
                      <span className="text-xs bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 font-medium text-blue-700 dark:text-blue-300">
                        Driver: {parcel.assigned_driver_name || 'Assigned'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-blue-600 dark:text-blue-400 block font-medium">AMFOA Score</span>
                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                      {Number(parcel.optimization_score || 0).toFixed(3)}
                    </span>
                  </div>
                </div>
              )}

              {/* 7-Factor AMFOA Score Breakdown Visualizer */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Optimization Factor Analysis
                </h4>
                <AMFOAScoreVisualizer
                  breakdown={breakdown}
                  totalScore={parcel.optimization_score || candidates[0]?.score || 0}
                />
              </div>

              {/* Candidate Vehicles Evaluation Ranking */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  All Candidate Vehicles Evaluation & Ranking
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Vehicle</th>
                        <th className="p-3">Dijkstra Dist</th>
                        <th className="p-3">Load Free</th>
                        <th className="p-3">Eligibility</th>
                        <th className="p-3 text-right">AMFOA Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {candidates.map((c) => {
                        const isWinner = c.isCurrentlyAssigned || (!parcel.assigned_vehicle_number && c.eligible && c.score === candidates[0]?.score);
                        return (
                          <tr
                            key={c.vehicleId}
                            className={`transition ${
                              isWinner
                                ? 'bg-blue-50/70 dark:bg-blue-950/40 font-medium'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                {isWinner && <span className="text-blue-600 dark:text-blue-400 font-bold">★</span>}
                                <span className="font-bold text-slate-800 dark:text-slate-100">{c.vehicleNumber}</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">({c.vehicleType})</span>
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-400 block">Hub: {c.locationName}</span>
                            </td>
                            <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                              {c.breakdown?.distanceKm ? `${c.breakdown.distanceKm} km` : '—'}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {(c.maxWeightKg - c.currentLoadKg).toFixed(0)} kg free
                            </td>
                            <td className="p-3">
                              {c.eligible ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Eligible
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" title={c.disqualificationReason}>
                                  Disqualified
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                              {c.eligible ? (
                                <span className={isWinner ? 'text-blue-600 dark:text-blue-400 text-sm' : ''}>
                                  {c.score.toFixed(3)}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
