import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import StatCard from '../components/StatCard';
import ParcelScoreModal from '../components/ParcelScoreModal';
import api from '../api/axios';

export default function DriverDashboard() {
  const [deliveries, setDeliveries] = useState([]);
  const [msg, setMsg] = useState('');
  const [inspectParcelId, setInspectParcelId] = useState(null);

  async function load() {
    try {
      const { data } = await api.get('/assignments/my-deliveries');
      setDeliveries(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => { load(); }, []);

  async function markDelivered(assignmentId) {
    try {
      await api.put(`/assignments/${assignmentId}/complete`);
      setMsg('Delivery marked as completed successfully! Vehicle load updated.');
      load();
    } catch (err) {
      setMsg('Failed to update status');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar title="Driver Delivery Portal" />
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Assigned Deliveries" value={deliveries.length} accent="brand" icon="📦" />
          <StatCard
            label="Total Cargo Load"
            value={`${deliveries.reduce((acc, d) => acc + Number(d.weight_kg || 0), 0)} kg`}
            accent="amber"
            icon="⚖️"
          />
          <StatCard
            label="Urgent Priority"
            value={deliveries.filter((d) => d.priority === 1).length}
            accent="red"
            icon="🚨"
          />
        </div>

        {msg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs px-4 py-3 rounded-2xl flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-emerald-600 dark:text-emerald-400 font-bold">✕</button>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">My Active Route & Consignments</h2>
              <p className="text-xs text-slate-400 dark:text-slate-400">Chronological stop sequence ordered by AMFOA deadline urgency</p>
            </div>
            <button
              onClick={load}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl font-medium transition"
            >
              🔄 Refresh
            </button>
          </div>

          <DataTable
            columns={[
              {
                key: 'parcel_id', label: 'Parcel', render: (r) => (
                  <span className="font-bold text-slate-800 dark:text-slate-100">#{r.parcel_id}</span>
                ),
              },
              {
                key: 'route', label: 'Ahmedabad Corridor', render: (r) => (
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{r.pickup_name}</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{r.delivery_name}</span>
                    {r.special_instructions && (
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">{r.special_instructions}</span>
                    )}
                  </div>
                ),
                sortValue: (r) => `${r.pickup_name} ${r.delivery_name}`,
              },
              {
                key: 'weight_kg', label: 'Weight & Vol', render: (r) => (
                  <span className="font-mono text-xs">{r.weight_kg}kg | {r.volume_m3}m³</span>
                ),
                sortValue: (r) => r.weight_kg,
              },
              {
                key: 'priority', label: 'Priority', render: (r) => (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    r.priority === 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                    r.priority === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  }`}>
                    Tier {r.priority} {r.fragile ? '• Fragile' : ''}
                  </span>
                ),
              },
              {
                key: 'deadline', label: 'Deadline', render: (r) => (
                  <span className="text-xs text-slate-600 dark:text-slate-300">{new Date(r.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                ),
                sortValue: (r) => new Date(r.deadline).getTime(),
              },
              {
                key: 'actions', label: 'Actions', render: (r) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectParcelId(r.parcel_id)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold"
                    >
                      Breakdown
                    </button>
                    <button
                      onClick={() => markDelivered(r.assignment_id)}
                      className="px-3 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs transition"
                    >
                      Mark Delivered
                    </button>
                  </div>
                ),
              },
            ]}
            data={deliveries}
            emptyText="No active deliveries assigned to your vehicle right now."
          />
        </div>
      </main>

      <ParcelScoreModal
        isOpen={Boolean(inspectParcelId)}
        onClose={() => setInspectParcelId(null)}
        parcelId={inspectParcelId}
      />
    </div>
  );
}
