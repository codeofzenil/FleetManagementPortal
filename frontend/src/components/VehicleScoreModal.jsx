import { useState, useEffect } from 'react';
import api from '../api/axios';
import { CircularGauge } from './VisualCharts';

export default function VehicleScoreModal({ isOpen, onClose, vehicleId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && vehicleId) {
      loadVehicleBreakdown();
    } else {
      setData(null);
      setError('');
    }
  }, [isOpen, vehicleId]);

  async function loadVehicleBreakdown() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/vehicles/${vehicleId}/score-breakdown`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load vehicle metrics');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const v = data?.vehicle;
  const factors = data?.factors;
  const activeAssignments = data?.activeAssignments || [];
  const history = data?.history;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Vehicle {v?.vehicle_number || ''} — AMFOA Fleet Score Breakdown
              </h3>
              {v?.status && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  v.status === 'available' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                  v.status === 'busy' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                  v.status === 'maintenance' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {v.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-400">
              {v?.type} • Current Hub: {v?.location_name || 'Ahmedabad Depot'}
            </p>
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
              <span className="inline-block animate-spin mr-2">⚙</span> Fetching vehicle operational metrics…
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl text-xs">
              {error}
            </div>
          )}

          {data && v && (
            <>
              {/* Top Overview: Circular Gauge & Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6">
                <CircularGauge score={data.readinessIndex} size={110} label="Fleet Readiness" />

                <div className="space-y-2 flex-1 w-full text-xs">
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Assigned Driver:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{v.driver_name || 'Unassigned (Standby)'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Fuel Economy:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{v.fuel_efficiency_kmpl} km/L ({v.fuel_type})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Current Payload Load:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {v.current_load_kg} / {v.max_weight_kg} kg ({Math.round((v.current_load_kg / v.max_weight_kg) * 100)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Historical Deliveries:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {history?.totalDelivered || 0} completed (Avg AMFOA: {history?.avgScore || 'N/A'})
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 AMFOA Operational Dimensions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Score Dimensions Breakdown
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Health */}
                  <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{factors?.maintenanceScore?.label}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{factors?.maintenanceScore?.value}/100</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{ width: `${factors?.maintenanceScore?.value}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 block">
                      Weight: {factors?.maintenanceScore?.weightPct}% • Status: {factors?.maintenanceScore?.status}
                    </span>
                  </div>

                  {/* Capacity */}
                  <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{factors?.capacityAvailability?.label}</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{factors?.capacityAvailability?.value}% Free</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${factors?.capacityAvailability?.value}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 block">
                      Free: {factors?.capacityAvailability?.freeKg} kg • Vol: {factors?.capacityAvailability?.volumePct}%
                    </span>
                  </div>

                  {/* Driver Readiness */}
                  <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{factors?.driverReadiness?.label}</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{factors?.driverReadiness?.value}% Shift</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${factors?.driverReadiness?.value}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 block">
                      Remaining: {factors?.driverReadiness?.hoursRemaining}h / {factors?.driverReadiness?.maxHours}h max
                    </span>
                  </div>

                  {/* Fuel Economy */}
                  <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{factors?.fuelEfficiency?.label}</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{factors?.fuelEfficiency?.value}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{ width: `${factors?.fuelEfficiency?.value}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 block">
                      {factors?.fuelEfficiency?.kmpl} km/L ({factors?.fuelEfficiency?.fuelType})
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Parcels Loaded */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Active Loaded Parcels ({activeAssignments.length})
                </h4>
                {activeAssignments.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400 italic">
                    Vehicle currently has no active parcels loaded
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">Parcel</th>
                          <th className="p-3">Route</th>
                          <th className="p-3">Weight</th>
                          <th className="p-3 text-right">AMFOA Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activeAssignments.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                              #{a.parcel_id}
                              {a.fragile && <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-1 rounded">Fragile</span>}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              {a.pickup_name} → {a.delivery_name}
                            </td>
                            <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{a.weight_kg} kg</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                              {Number(a.optimization_score || 0).toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
