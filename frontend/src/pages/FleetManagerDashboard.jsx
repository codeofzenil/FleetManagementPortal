import { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import MapView from '../components/MapView';
import { StatusRingChart, CapacityBarChart, ParcelPipelineChart } from '../components/VisualCharts';
import ParcelModal from '../components/ParcelModal';
import ParcelScoreModal from '../components/ParcelScoreModal';
import VehicleScoreModal from '../components/VehicleScoreModal';
import api from '../api/axios';

const TABS = [
  { id: 'overview', label: 'Fleet Overview & Visuals', icon: '📊' },
  { id: 'allocation', label: 'AMFOA Allocation Queue', icon: '⚡' },
  { id: 'parcels', label: 'Parcels Management', icon: '📦' },
  { id: 'vehicles', label: 'Vehicles & Live Map', icon: '🚚' },
  { id: 'optimizer', label: 'Knapsack & Route DP', icon: '🧠' },
  { id: 'drivers', label: 'Drivers Roster', icon: '👤' },
];

export default function FleetManagerDashboard() {
  const [tab, setTab] = useState('overview');
  const [parcels, setParcels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  // Allocation & Optimizers
  const [busyId, setBusyId] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [loadVehicleId, setLoadVehicleId] = useState('');
  const [loadSuggestion, setLoadSuggestion] = useState(null);
  const [routeVehicleId, setRouteVehicleId] = useState('');
  const [optimizedRoute, setOptimizedRoute] = useState(null);

  // Modals
  const [isParcelModalOpen, setIsParcelModalOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState(null);
  const [inspectParcelId, setInspectParcelId] = useState(null);
  const [inspectVehicleId, setInspectVehicleId] = useState(null);

  // Filters
  const [parcelFilter, setParcelFilter] = useState('all');

  const loadAll = useCallback(async () => {
    setSyncing(true);
    try {
      const [pRes, vRes, dRes, locRes, sRes] = await Promise.all([
        api.get('/parcels'),
        api.get('/vehicles'),
        api.get('/drivers'),
        api.get('/locations'),
        api.get('/dashboard/summary'),
      ]);
      setParcels(pRes.data);
      setVehicles(vRes.data);
      setDrivers(dRes.data);
      setLocations(locRes.data);
      setSummary(sRes.data);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setMsg('Failed to sync fleet data: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Run AMFOA for a single parcel
  async function allocate(id) {
    setBusyId(id);
    try {
      const { data } = await api.post(`/assignments/allocate/${id}`);
      setLastResult(data.result);
      setMsg(`Parcel #${id} allocated to Vehicle #${data.result?.chosen?.vehicleId}`);
      await loadAll();
    } catch (err) {
      setLastResult({ success: false, reason: err.response?.data?.reason || 'Allocation failed' });
    } finally {
      setBusyId(null);
    }
  }

  // Run Batch AMFOA
  async function runBatch() {
    setSyncing(true);
    try {
      const { data } = await api.post('/assignments/allocate-batch');
      const successCount = data.results.filter((r) => r.success).length;
      setMsg(`Batch complete — ${successCount}/${data.results.length} parcels allocated via AMFOA priority queue`);
      await loadAll();
    } catch (err) {
      setMsg('Batch allocation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  }

  // Suggest Load (0/1 Knapsack DP)
  async function suggestLoad() {
    if (!loadVehicleId) return;
    try {
      const { data } = await api.post(`/assignments/optimize-load/${loadVehicleId}`);
      setLoadSuggestion(data);
    } catch (err) {
      setMsg('Knapsack optimization failed: ' + (err.response?.data?.error || err.message));
    }
  }

  // Apply Knapsack Package (1-click batch allocation to vehicle or individual parcel)
  const [applyingKnapsack, setApplyingKnapsack] = useState(false);
  async function applyKnapsackLoad(customIds = null) {
    if (!loadVehicleId) return;
    const parcelIds = customIds || (loadSuggestion?.suggestedParcels || []).map((p) => p.id);
    if (!parcelIds.length) return;
    setApplyingKnapsack(true);
    try {
      const { data } = await api.post(`/assignments/apply-knapsack-load/${loadVehicleId}`, { parcelIds });
      setMsg(`✓ ${data.message}`);
      setLoadSuggestion(null);
      await loadAll();
    } catch (err) {
      setMsg('Failed to apply knapsack load: ' + (err.response?.data?.error || err.message));
    } finally {
      setApplyingKnapsack(false);
    }
  }

  // Held-Karp Multi-Stop Route Optimizer
  async function optimizeRoute() {
    if (!routeVehicleId) return;
    try {
      const { data } = await api.post(`/assignments/optimize-route/${routeVehicleId}`);
      setOptimizedRoute(data);
    } catch (err) {
      setMsg('Route optimization failed: ' + (err.response?.data?.error || err.message));
    }
  }

  // Save Parcel (Create or Edit)
  async function handleSaveParcel(formData) {
    if (editingParcel) {
      await api.put(`/parcels/${editingParcel.id}`, formData);
      setMsg(`Parcel #${editingParcel.id} updated successfully`);
    } else {
      await api.post('/parcels', formData);
      setMsg('New consignment created in Ahmedabad dispatch queue');
    }
    setEditingParcel(null);
    await loadAll();
  }

  // Delete Parcel
  async function handleDeleteParcel(id) {
    if (!window.confirm(`Are you sure you want to remove parcel #${id}?`)) return;
    try {
      await api.delete(`/parcels/${id}`);
      setMsg(`Parcel #${id} removed successfully`);
      await loadAll();
    } catch (err) {
      setMsg('Failed to delete parcel: ' + (err.response?.data?.error || err.message));
    }
  }

  // Quick Vehicle Status Update
  async function updateVehicleStatus(id, newStatus) {
    try {
      await api.put(`/vehicles/${id}`, { status: newStatus });
      setMsg(`Vehicle #${id} status updated to ${newStatus}`);
      await loadAll();
    } catch (err) {
      setMsg('Failed to update vehicle status');
    }
  }

  // Filtered parcels
  const filteredParcels = parcels.filter((p) => {
    if (parcelFilter === 'all') return true;
    return p.status === parcelFilter;
  });

  const pendingParcels = parcels.filter((p) => p.status === 'pending');
  const availableVehiclesCount = vehicles.filter((v) => v.status === 'available').length;
  const inTransitCount = parcels.filter((p) => p.status === 'in_transit').length;
  const deliveredCount = parcels.filter((p) => p.status === 'delivered').length;

  const vehicleStatusChartData = [
    { label: 'Available', value: vehicles.filter((v) => v.status === 'available').length, color: '#10b981' },
    { label: 'Busy / In Route', value: vehicles.filter((v) => v.status === 'busy').length, color: '#3b82f6' },
    { label: 'Maintenance', value: vehicles.filter((v) => v.status === 'maintenance').length, color: '#f59e0b' },
    { label: 'Offline', value: vehicles.filter((v) => v.status === 'offline').length, color: '#94a3b8' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar title="Fleet Manager Dispatch Hub" />

      {/* Sync Status Banner */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between text-xs transition-colors">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Connected
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-slate-500 dark:text-slate-400">Ahmedabad Logistics Network (12 Active Hubs)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 dark:text-slate-400">
            Last updated: <b className="text-slate-700 dark:text-slate-200">{lastSyncTime}</b>
          </span>
          <button
            onClick={loadAll}
            disabled={syncing}
            className="flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition disabled:opacity-50"
          >
            <span className={`inline-block ${syncing ? 'animate-spin' : ''}`}>🔄</span>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Available Vehicles" value={availableVehiclesCount} accent="brand" icon="🚚" />
          <StatCard label="Pending in Queue" value={pendingParcels.length} accent="amber" icon="📦" />
          <StatCard label="Active in Transit" value={inTransitCount} accent="brand" icon="🛣️" />
          <StatCard label="Delivered Today" value={deliveredCount} accent="green" icon="✅" />
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-xs'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.id === 'allocation' && pendingParcels.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                  {pendingParcels.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Global Notifications */}
        {msg && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs px-4 py-3 rounded-2xl flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 font-bold">✕</button>
          </div>
        )}

        {/* ================= TAB 1: FLEET OVERVIEW & VISUALS ================= */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Vehicle Status Ring */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Fleet Operational Status</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400">Availability breakdown across Gujarat fleet</p>
                </div>
                <StatusRingChart data={vehicleStatusChartData} title="Vehicles Distribution" size={150} />
              </div>

              {/* Parcel Lifecycle Pipeline */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden lg:col-span-2 transition-colors">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Consignment Lifecycle Pipeline</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400">Distribution across Ahmedabad delivery stages</p>
                  </div>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 font-semibold px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300">
                    {parcels.length} Total Parcels
                  </span>
                </div>
                <ParcelPipelineChart parcels={parcels} />
              </div>
            </div>

            {/* Vehicle Capacity Load vs Max Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Live Vehicle Payload & Capacity Utilization</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400">Current loaded cargo (kg) vs maximum rated payload</p>
                </div>
                <button
                  onClick={() => setTab('vehicles')}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Manage Vehicles →
                </button>
              </div>
              <CapacityBarChart vehicles={vehicles} />
            </div>
          </div>
        )}

        {/* ================= TAB 2: AMFOA ALLOCATION QUEUE ================= */}
        {tab === 'allocation' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    AMFOA Pending Allocation Queue ({pendingParcels.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adaptive Multi-Constraint Fleet Optimization Algorithm engine with Min-Heap Priority Queue
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingParcel(null); setIsParcelModalOpen(true); }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl font-medium transition"
                  >
                    + New Consignment
                  </button>
                  <button
                    onClick={runBatch}
                    disabled={pendingParcels.length === 0 || syncing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    Run AMFOA Batch Optimization
                  </button>
                </div>
              </div>

              <DataTable
                columns={[
                  { key: 'id', label: 'ID', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">#{r.id}</span> },
                  { key: 'pickup_name', label: 'Pickup Hub', render: (r) => <span className="font-bold text-slate-700 dark:text-slate-300">{r.pickup_name}</span> },
                  { key: 'delivery_name', label: 'Delivery Hub', render: (r) => <span className="font-bold text-slate-700 dark:text-slate-300">{r.delivery_name}</span> },
                  { key: 'weight_kg', label: 'Weight & Vol', render: (r) => <span className="font-mono text-xs">{r.weight_kg}kg | {r.volume_m3}m³</span>, sortValue: (r) => r.weight_kg },
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
                  { key: 'deadline', label: 'Deadline', render: (r) => new Date(r.deadline).toLocaleString(), sortValue: (r) => new Date(r.deadline).getTime() },
                  {
                    key: 'actions', label: 'Actions', render: (r) => (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInspectParcelId(r.id)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold transition"
                        >
                          Score Breakdown
                        </button>
                        <button
                          onClick={() => allocate(r.id)}
                          disabled={busyId === r.id}
                          className="px-3 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition disabled:opacity-50"
                        >
                          {busyId === r.id ? 'Optimizing…' : 'Run AMFOA'}
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={pendingParcels}
                emptyText="Allocation queue is empty. All current consignments have been assigned to fleet vehicles!"
              />
            </div>

            {/* Latest Result Banner */}
            {lastResult && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-5 space-y-3 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Latest AMFOA Optimization Result</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    lastResult.success
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}>
                    {lastResult.success ? 'Optimization Successful' : 'Allocation Failed'}
                  </span>
                </div>
                {lastResult.success ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-600 dark:text-slate-300">
                      Assigned to Vehicle <b className="text-slate-900 dark:text-slate-100">#{lastResult.chosen?.vehicleId}</b> with an AMFOA multi-factor score of{' '}
                      <b className="text-blue-600 dark:text-blue-400 text-sm">{lastResult.chosen?.score}</b>.
                    </p>
                    <pre className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300">
                      {JSON.stringify(lastResult.chosen?.breakdown, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{lastResult.reason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: PARCELS MANAGEMENT ================= */}
        {tab === 'parcels' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Consignments & Parcel Registry</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">View, create, edit, remove, and evaluate Ahmedabad delivery parcels</p>
              </div>
              <button
                onClick={() => { setEditingParcel(null); setIsParcelModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold shadow-xs transition"
              >
                + Create New Parcel
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 text-xs overflow-x-auto pb-1">
              {['all', 'pending', 'assigned', 'in_transit', 'delivered'].map((st) => (
                <button
                  key={st}
                  onClick={() => setParcelFilter(st)}
                  className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition ${
                    parcelFilter === st
                      ? 'bg-slate-800 dark:bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {st.replace('_', ' ')} ({st === 'all' ? parcels.length : parcels.filter((p) => p.status === st).length})
                </button>
              ))}
            </div>

            <DataTable
              columns={[
                { key: 'id', label: 'ID', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">#{r.id}</span> },
                {
                  key: 'route', label: 'Corridor', render: (r) => (
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{r.pickup_name}</span>
                      <span className="text-slate-400 mx-1.5">→</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{r.delivery_name}</span>
                    </div>
                  ),
                  sortValue: (r) => `${r.pickup_name} ${r.delivery_name}`,
                },
                { key: 'weight_kg', label: 'Specs', render: (r) => <span className="font-mono text-xs">{r.weight_kg}kg | {r.volume_m3}m³</span>, sortValue: (r) => r.weight_kg },
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
                  key: 'vehicle', label: 'Vehicle / Driver', render: (r) => (
                    r.vehicle_number ? (
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{r.vehicle_number}</span>
                        <span className="block text-[11px] text-slate-400 dark:text-slate-400">{r.driver_name || 'Driver'}</span>
                      </div>
                    ) : <span className="text-slate-400 dark:text-slate-500 italic text-xs">Unassigned</span>
                  ),
                  sortValue: (r) => r.vehicle_number || '',
                },
                {
                  key: 'status', label: 'Status', render: (r) => (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                      r.status === 'assigned' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                      r.status === 'in_transit' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                      r.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  ),
                },
                {
                  key: 'actions', label: 'Actions', render: (r) => (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setInspectParcelId(r.id)}
                        className="px-2 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold"
                        title="View AMFOA 7-Factor Score Breakdown"
                      >
                        Score Breakdown
                      </button>
                      <button
                        onClick={() => { setEditingParcel(r); setIsParcelModalOpen(true); }}
                        className="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteParcel(r.id)}
                        className="px-2 py-1 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              data={filteredParcels}
              emptyText="No parcels matching the selected status filter."
            />
          </div>
        )}

        {/* ================= TAB 4: VEHICLES & LIVE MAP ================= */}
        {tab === 'vehicles' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-5 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Fleet Vehicles Roster</h3>
                  <span className="text-xs text-slate-400 dark:text-slate-400">{vehicles.length} Active Gujarat Registrations</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map((v) => {
                    const loadPct = Math.round(((v.current_load_kg || 0) / (v.max_weight_kg || 1)) * 100);
                    return (
                      <div key={v.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm block">{v.vehicle_number}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-400">{v.type}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            v.status === 'available' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            v.status === 'busy' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                            v.status === 'maintenance' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {v.status}
                          </span>
                        </div>

                        {/* Capacity Load Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Payload: {v.current_load_kg || 0} / {v.max_weight_kg} kg</span>
                            <span className="font-bold">{loadPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden transition-colors">
                            <div
                              className={`h-full rounded-full ${
                                loadPct >= 85 ? 'bg-rose-500' : loadPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${loadPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2">
                          <span>Driver: <b>{v.driver_name || 'Unassigned'}</b></span>
                          <span>Hub: <b>{v.location_name || 'Depot'}</b></span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setInspectVehicleId(v.id)}
                            className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold"
                          >
                            Score Breakdown
                          </button>
                          <div className="flex gap-1">
                            {v.status !== 'available' && (
                              <button
                                onClick={() => updateVehicleStatus(v.id, 'available')}
                                className="px-2 py-1 text-[11px] rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-medium"
                              >
                                Set Available
                              </button>
                            )}
                            {v.status !== 'maintenance' && (
                              <button
                                onClick={() => updateVehicleStatus(v.id, 'maintenance')}
                                className="px-2 py-1 text-[11px] rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-medium"
                              >
                                Service
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Leaflet Map */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-5 space-y-3 transition-colors">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Live Ahmedabad Logistics Map</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400">Hub coordinates and active fleet GPS locations</p>
                <MapView
                  center={[23.0338, 72.5850]}
                  zoom={11}
                  height="420px"
                  markers={[
                    ...locations.map((loc) => ({
                      lat: loc.lat,
                      lng: loc.lng,
                      label: `📍 Hub: ${loc.name}`,
                    })),
                    ...vehicles.filter((v) => v.lat && v.lng).map((v) => ({
                      lat: v.lat,
                      lng: v.lng,
                      label: `🚚 ${v.vehicle_number} (${v.status}) • Load: ${v.current_load_kg}/${v.max_weight_kg}kg`,
                    })),
                  ]}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: KNAPSACK & MULTI-STOP ROUTE OPTIMIZER ================= */}
        {tab === 'optimizer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Knapsack Optimizer */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">0/1 Knapsack Load Maximizer</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400">
                  Dynamic Programming: selects the highest-priority pending parcel subset to maximize payload within remaining weight and volume
                </p>
              </div>

              <div className="flex gap-2">
                <select
                  value={loadVehicleId}
                  onChange={(e) => setLoadVehicleId(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select vehicle for knapsack analysis…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} — {v.type} ({v.max_weight_kg - v.current_load_kg}kg remaining)
                    </option>
                  ))}
                </select>
                <button
                  onClick={suggestLoad}
                  disabled={!loadVehicleId}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm rounded-xl font-semibold shadow-xs transition disabled:opacity-50"
                >
                  Optimize Load
                </button>
              </div>

              {loadSuggestion && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                        Target Vehicle: {loadSuggestion.vehicle} ({loadSuggestion.vehicleType || 'Commercial'})
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Remaining Capacity Budget: {loadSuggestion.remainingWeight} kg / {loadSuggestion.remainingVolume} m³
                      </span>
                    </div>
                    {loadSuggestion.suggestedParcels.length > 0 && (
                      <button
                        onClick={applyKnapsackLoad}
                        disabled={applyingKnapsack}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <span>⚡</span>
                        <span>{applyingKnapsack ? 'Allocating…' : `Assign Entire Package (${loadSuggestion.suggestedParcels.length} Parcels)`}</span>
                      </button>
                    )}
                  </div>

                  {loadSuggestion.suggestedParcels.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">
                      No pending parcels fit within this vehicle's remaining weight ({loadSuggestion.remainingWeight}kg) and volume ({loadSuggestion.remainingVolume}m³) limits.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Metric Gauges */}
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                          <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Payload to Load</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {loadSuggestion.totalWeight} kg
                          </span>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, loadSuggestion.weightUtilizationPct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {loadSuggestion.weightUtilizationPct}% of free budget
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                          <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Volume to Load</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {loadSuggestion.totalVolume} m³
                          </span>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, loadSuggestion.volumeUtilizationPct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {loadSuggestion.volumeUtilizationPct}% of free budget
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                          <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">DP Delivery Value</span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            +{loadSuggestion.totalValue} pts
                          </span>
                          <span className="text-[10px] text-slate-400 block pt-2">
                            Priority + Urgency score
                          </span>
                        </div>
                      </div>

                      {/* Suggested Consignments List */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Optimal Subset Package ({loadSuggestion.suggestedParcels.length} consignments):
                        </span>
                        <div className="divide-y divide-slate-200 dark:divide-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-850 overflow-hidden text-xs">
                          {loadSuggestion.suggestedParcels.map((sp) => (
                            <div key={sp.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">Parcel #{sp.id}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    sp.priority === 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                                    sp.priority === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                  }`}>
                                    Priority {sp.priority} {sp.fragile ? '• Fragile' : ''}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                  {sp.pickup_name && sp.delivery_name ? `${sp.pickup_name} → ${sp.delivery_name}` : `Ahmedabad Consignment`} • {sp.weight_kg} kg | {sp.volume_m3} m³
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                  +{sp.value} pts
                                </span>
                                <button
                                  onClick={() => applyKnapsackLoad([sp.id])}
                                  disabled={applyingKnapsack}
                                  className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                                  title="Assign this parcel directly to this vehicle"
                                >
                                  Assign to Vehicle
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Held-Karp Multi-Stop Route Optimizer */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Held-Karp Multi-Stop TSP DP Solver</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400">
                  Exact bitmask DP optimal route sequence across multiple pickup & delivery points in Ahmedabad
                </p>
              </div>

              <div className="flex gap-2">
                <select
                  value={routeVehicleId}
                  onChange={(e) => setRouteVehicleId(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select vehicle with active deliveries…</option>
                  {vehicles.filter((v) => v.active_assignments_count > 0).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.active_assignments_count} active assignments)
                    </option>
                  ))}
                </select>
                <button
                  onClick={optimizeRoute}
                  disabled={!routeVehicleId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl font-semibold shadow-xs transition disabled:opacity-50"
                >
                  Solve Route
                </button>
              </div>

              {optimizedRoute && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200">Total Distance: {optimizedRoute.totalDistanceKm} km</span>
                    <span className="text-indigo-700 dark:text-indigo-300">Est. Travel Time: ~{(optimizedRoute.totalDistanceKm * 2).toFixed(0)} min</span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                      Optimized Stop Order (Dijkstra Shortest Matrix)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {optimizedRoute.orderedStops.map((stopId, idx) => {
                        const loc = locations.find((l) => l.id === stopId);
                        return (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-xl font-bold text-slate-800 dark:text-slate-100 shadow-xs">
                              {idx + 1}. {loc?.name || `Hub #${stopId}`}
                            </span>
                            {idx < optimizedRoute.orderedStops.length - 1 && (
                              <span className="text-indigo-400 font-bold">→</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 6: DRIVERS ROSTER ================= */}
        {tab === 'drivers' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Fleet Drivers Roster ({drivers.length})</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400">Shift tracking, hours logged today, and vehicle assignments</p>
              </div>
            </div>

            <DataTable
              columns={[
                { key: 'name', label: 'Driver Name', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">{r.name}</span> },
                { key: 'email', label: 'Login Email', render: (r) => <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">{r.email}</span> },
                { key: 'license_no', label: 'License No', render: (r) => <span className="font-mono text-xs">{r.license_no}</span> },
                {
                  key: 'vehicle', label: 'Assigned Vehicle', render: (r) => (
                    r.vehicle_number ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{r.vehicle_number} ({r.vehicle_type})</span>
                    ) : <span className="text-slate-400 dark:text-slate-500 italic text-xs">Unassigned</span>
                  ),
                  sortValue: (r) => r.vehicle_number || '',
                },
                {
                  key: 'hours', label: 'Hours Today', render: (r) => (
                    <div className="text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{r.working_hours_today || 0} / {r.max_working_hours || 8} hrs</span>
                      <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden transition-colors">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.round(((r.working_hours_today || 0) / (r.max_working_hours || 8)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ),
                  sortValue: (r) => r.working_hours_today || 0,
                },
                {
                  key: 'availability', label: 'Availability', render: (r) => (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.availability ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      {r.availability ? 'Available' : 'Off Shift'}
                    </span>
                  ),
                  sortValue: (r) => (r.availability ? 1 : 0),
                },
                {
                  key: 'rating', label: 'Rating', render: (r) => (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">★ {r.rating || 5.0}</span>
                  ),
                },
              ]}
              data={drivers}
              emptyText="No drivers registered in the fleet."
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <ParcelModal
        isOpen={isParcelModalOpen}
        onClose={() => { setIsParcelModalOpen(false); setEditingParcel(null); }}
        onSave={handleSaveParcel}
        parcel={editingParcel}
        locations={locations}
      />

      <ParcelScoreModal
        isOpen={Boolean(inspectParcelId)}
        onClose={() => setInspectParcelId(null)}
        parcelId={inspectParcelId}
      />

      <VehicleScoreModal
        isOpen={Boolean(inspectVehicleId)}
        onClose={() => setInspectVehicleId(null)}
        vehicleId={inspectVehicleId}
      />
    </div>
  );
}
