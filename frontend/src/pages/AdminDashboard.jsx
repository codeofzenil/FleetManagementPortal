import { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import { StatusRingChart, CapacityBarChart, ParcelPipelineChart } from '../components/VisualCharts';
import DriverModal from '../components/DriverModal';
import ParcelModal from '../components/ParcelModal';
import ParcelScoreModal from '../components/ParcelScoreModal';
import VehicleScoreModal from '../components/VehicleScoreModal';
import api from '../api/axios';

const TABS = [
  { id: 'overview', label: 'Overview & Analytics', icon: '📊' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚚' },
  { id: 'drivers', label: 'Drivers & Logins', icon: '👤' },
  { id: 'parcels', label: 'Parcels & Consignments', icon: '📦' },
  { id: 'assignments', label: 'Assignments & AMFOA', icon: '⚡' },
  { id: 'optimizer', label: 'Knapsack Optimizer', icon: '🧠' },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [msg, setMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Knapsack Load Maximizer state
  const [loadVehicleId, setLoadVehicleId] = useState('');
  const [loadSuggestion, setLoadSuggestion] = useState(null);
  const [applyingKnapsack, setApplyingKnapsack] = useState(false);

  // New vehicle form
  const [newVehicle, setNewVehicle] = useState({
    vehicle_number: '',
    type: 'Mini Truck',
    max_weight_kg: 1000,
    max_volume_m3: 8,
    fuel_type: 'diesel',
    fuel_efficiency_kmpl: 12,
    current_location_id: '',
  });

  // Modals state
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);

  const [isParcelModalOpen, setIsParcelModalOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState(null);

  const [inspectParcelId, setInspectParcelId] = useState(null);
  const [inspectVehicleId, setInspectVehicleId] = useState(null);

  const loadAll = useCallback(async () => {
    setSyncing(true);
    try {
      const [sRes, vRes, dRes, pRes, aRes, locRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/vehicles'),
        api.get('/drivers'),
        api.get('/parcels'),
        api.get('/assignments'),
        api.get('/locations'),
      ]);
      setSummary(sRes.data);
      setVehicles(vRes.data);
      setDrivers(dRes.data);
      setParcels(pRes.data);
      setAssignments(aRes.data);
      setLocations(locRes.data);
      if (locRes.data.length && !newVehicle.current_location_id) {
        setNewVehicle((prev) => ({ ...prev, current_location_id: locRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
      setMsg('Failed to load data: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  }, [newVehicle.current_location_id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Vehicle Actions
  async function addVehicle(e) {
    e.preventDefault();
    try {
      await api.post('/vehicles', newVehicle);
      setMsg(`Vehicle ${newVehicle.vehicle_number} registered successfully`);
      setNewVehicle({
        vehicle_number: '',
        type: 'Mini Truck',
        max_weight_kg: 1000,
        max_volume_m3: 8,
        fuel_type: 'diesel',
        fuel_efficiency_kmpl: 12,
        current_location_id: locations[0]?.id || 1,
      });
      await loadAll();
    } catch (err) {
      setMsg('Failed to add vehicle: ' + (err.response?.data?.error || err.message));
    }
  }

  async function deleteVehicle(id) {
    if (!window.confirm(`Are you sure you want to remove vehicle #${id}?`)) return;
    try {
      await api.delete(`/vehicles/${id}`);
      setMsg('Vehicle removed');
      await loadAll();
    } catch (err) {
      setMsg('Failed to delete vehicle: ' + (err.response?.data?.error || err.message));
    }
  }

  // Driver Actions (Add, Edit, Remove)
  async function handleSaveDriver(formData) {
    if (editingDriver) {
      await api.put(`/drivers/${editingDriver.id}`, formData);
      setMsg(`Driver ${formData.name} updated successfully`);
    } else {
      await api.post('/drivers', formData);
      setMsg(`Driver ${formData.name} & login account created successfully`);
    }
    setEditingDriver(null);
    await loadAll();
  }

  async function handleDeleteDriver(id, name) {
    if (!window.confirm(`Are you sure you want to remove driver ${name} and their login account?`)) return;
    try {
      await api.delete(`/drivers/${id}`);
      setMsg(`Driver ${name} removed`);
      await loadAll();
    } catch (err) {
      setMsg('Failed to delete driver: ' + (err.response?.data?.error || err.message));
    }
  }

  // Parcel Actions (Add, Edit, Remove)
  async function handleSaveParcel(formData) {
    if (editingParcel) {
      await api.put(`/parcels/${editingParcel.id}`, formData);
      setMsg(`Parcel #${editingParcel.id} updated successfully`);
    } else {
      await api.post('/parcels', formData);
      setMsg('New parcel consignment created');
    }
    setEditingParcel(null);
    await loadAll();
  }

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

  // Batch Allocation
  async function runBatchAllocation() {
    setMsg('Running AMFOA batch allocation across pending parcels…');
    try {
      const { data } = await api.post('/assignments/allocate-batch');
      const successCount = data.results.filter((r) => r.success).length;
      setMsg(`Batch complete — ${successCount}/${data.results.length} parcels allocated via AMFOA priority queue`);
      await loadAll();
    } catch (err) {
      setMsg('Batch allocation failed: ' + (err.response?.data?.error || err.message));
    }
  }

  // Suggest Load (0/1 Knapsack 2D Multi-Constraint)
  async function suggestLoad() {
    if (!loadVehicleId) return;
    try {
      const { data } = await api.post(`/assignments/optimize-load/${loadVehicleId}`);
      setLoadSuggestion(data);
    } catch (err) {
      setMsg('Knapsack optimization failed: ' + (err.response?.data?.error || err.message));
    }
  }

  // Apply Knapsack Package (1-click batch allocation to vehicle or single item)
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

  const pendingCount = parcels.filter((p) => p.status === 'pending').length;
  const availableVehicles = vehicles.filter((v) => v.status === 'available').length;

  const vehicleStatusChartData = [
    { label: 'Available', value: vehicles.filter((v) => v.status === 'available').length, color: '#10b981' },
    { label: 'Busy', value: vehicles.filter((v) => v.status === 'busy').length, color: '#3b82f6' },
    { label: 'Maintenance', value: vehicles.filter((v) => v.status === 'maintenance').length, color: '#f59e0b' },
    { label: 'Offline', value: vehicles.filter((v) => v.status === 'offline').length, color: '#94a3b8' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar title="System Administration Hub" />

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Available Vehicles" value={availableVehicles} accent="brand" icon="🚚" />
          <StatCard label="Pending Parcels" value={pendingCount} accent="amber" icon="📦" />
          <StatCard label="Active Drivers" value={drivers.filter((d) => d.availability).length} accent="green" icon="👤" />
          <StatCard label="Fuel Consumed (L)" value={Number(summary?.fuelToday ?? 0).toFixed(1)} accent="red" icon="⛽" />
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
              {t.id === 'parcels' && pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                  {pendingCount}
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

        {/* ================= TAB 1: OVERVIEW & ANALYTICS ================= */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* AMFOA Engine Banner */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    AMFOA Adaptive Optimization Engine
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-400">
                    7-Factor multi-constraint greedy selection + Min-Heap Priority Queue batch pipeline
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadAll}
                    disabled={syncing}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-xl font-medium transition"
                  >
                    🔄 {syncing ? 'Syncing…' : 'Sync'}
                  </button>
                  <button
                    onClick={runBatchAllocation}
                    disabled={pendingCount === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    Run Batch Allocation ({pendingCount} pending)
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Evaluates distance via Dijkstra shortest-paths across Ahmedabad's road corridors, vehicle remaining weight & volume capacity,
                delivery deadline urgency, fuel economy, driver shifts, and maintenance scores.
              </p>
            </div>

            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Vehicle Status Ring */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Fleet Vehicle Status</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400">Gujarat commercial vehicles distribution</p>
                </div>
                <StatusRingChart data={vehicleStatusChartData} title="Fleet Distribution" size={150} />
              </div>

              {/* Parcel Lifecycle Pipeline */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden lg:col-span-2 transition-colors">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Consignment Lifecycle Pipeline</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400">Active distribution across delivery stages</p>
                  </div>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 font-semibold px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300">
                    {parcels.length} Total Parcels
                  </span>
                </div>
                <ParcelPipelineChart parcels={parcels} />
              </div>
            </div>

            {/* Vehicle Capacity Bar Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Live Vehicle Payload & Capacity Utilization</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400">Current loaded cargo (kg) vs maximum rated payload</p>
                </div>
                <button
                  onClick={() => setTab('vehicles')}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Manage Fleet →
                </button>
              </div>
              <CapacityBarChart vehicles={vehicles} />
            </div>
          </div>
        )}

        {/* ================= TAB 2: VEHICLES ================= */}
        {tab === 'vehicles' && (
          <div className="space-y-6">
            {/* Add Vehicle Form */}
            <form onSubmit={addVehicle} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-5 space-y-4 transition-colors">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Register New Fleet Commercial Vehicle</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  required
                  placeholder="Vehicle Number (e.g. GJ01-XY-9000)"
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVehicle.vehicle_number}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_number: e.target.value })}
                />
                <input
                  placeholder="Type (e.g. Mini Truck / Van)"
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVehicle.type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, type: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Max Weight (kg)"
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVehicle.max_weight_kg}
                  onChange={(e) => setNewVehicle({ ...newVehicle, max_weight_kg: +e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Max Volume (m³)"
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVehicle.max_volume_m3}
                  onChange={(e) => setNewVehicle({ ...newVehicle, max_volume_m3: +e.target.value })}
                />
                <select
                  value={newVehicle.fuel_type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, fuel_type: e.target.value })}
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="electric">Electric (EV)</option>
                  <option value="cng">CNG</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Efficiency (km/L)"
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm"
                  value={newVehicle.fuel_efficiency_kmpl}
                  onChange={(e) => setNewVehicle({ ...newVehicle, fuel_efficiency_kmpl: +e.target.value })}
                />
                <select
                  value={newVehicle.current_location_id}
                  onChange={(e) => setNewVehicle({ ...newVehicle, current_location_id: e.target.value })}
                  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      Hub: {l.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm rounded-xl py-2 font-semibold shadow-xs transition"
                >
                  + Add Vehicle
                </button>
              </div>
            </form>

            {/* Vehicles Table with Sorting and Filtering on all columns */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-5 space-y-3 transition-colors">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Fleet Registry</h3>
                <span className="text-xs text-slate-400 dark:text-slate-400">{vehicles.length} Vehicles</span>
              </div>

              <DataTable
                columns={[
                  { key: 'vehicle_number', label: 'Vehicle Number', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">{r.vehicle_number}</span> },
                  { key: 'type', label: 'Type & Fuel', render: (r) => <span className="text-xs">{r.type} ({r.fuel_type})</span> },
                  { key: 'location_name', label: 'Current Hub', render: (r) => <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{r.location_name || 'Depot'}</span> },
                  {
                    key: 'max_weight_kg', label: 'Payload Capacity', render: (r) => (
                      <span className="font-mono text-xs">
                        {r.current_load_kg || 0} / {r.max_weight_kg} kg
                      </span>
                    ),
                    sortValue: (r) => r.max_weight_kg,
                  },
                  {
                    key: 'driver_name', label: 'Assigned Driver', render: (r) => (
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{r.driver_name || <i className="text-slate-400 dark:text-slate-500">None</i>}</span>
                    ),
                  },
                  {
                    key: 'readiness_index', label: 'Readiness Score', render: (r) => (
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{r.readiness_index || 85}/100</span>
                    ),
                  },
                  {
                    key: 'status', label: 'Status', render: (r) => (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'available' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        r.status === 'busy' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                        r.status === 'maintenance' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {r.status}
                      </span>
                    ),
                  },
                  {
                    key: 'actions', label: 'Actions', render: (r) => (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInspectVehicleId(r.id)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold"
                        >
                          Score Breakdown
                        </button>
                        <button
                          onClick={() => deleteVehicle(r.id)}
                          className="px-2 py-1 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={vehicles}
              />
            </div>
          </div>
        )}

        {/* ================= TAB 3: DRIVERS & LOGINS ================= */}
        {tab === 'drivers' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Drivers Registry & Login Credentials</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">Add, edit, remove drivers and manage system authentication accounts</p>
              </div>
              <button
                onClick={() => { setEditingDriver(null); setIsDriverModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold shadow-xs transition"
              >
                + Add New Driver & Login
              </button>
            </div>

            <DataTable
              columns={[
                { key: 'name', label: 'Driver Name', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">{r.name}</span> },
                { key: 'email', label: 'Login Email', render: (r) => <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">{r.email}</span> },
                { key: 'license_no', label: 'License No', render: (r) => <span className="font-mono text-xs">{r.license_no}</span> },
                {
                  key: 'vehicle', label: 'Assigned Vehicle', render: (r) => (
                    r.vehicle_number ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{r.vehicle_number} ({r.vehicle_type})</span>
                    ) : <span className="text-slate-400 dark:text-slate-500 italic text-xs">Unassigned</span>
                  ),
                  sortValue: (r) => r.vehicle_number || '',
                },
                {
                  key: 'hours', label: 'Shift Hours Today', render: (r) => (
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                      {r.working_hours_today || 0} / {r.max_working_hours || 8} hrs
                    </span>
                  ),
                  sortValue: (r) => r.working_hours_today || 0,
                },
                {
                  key: 'availability', label: 'Availability', render: (r) => (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.availability ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      {r.availability ? 'Available' : 'Unavailable'}
                    </span>
                  ),
                  sortValue: (r) => (r.availability ? 1 : 0),
                },
                {
                  key: 'rating', label: 'Rating', render: (r) => (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">★ {r.rating || 5.0}</span>
                  ),
                },
                {
                  key: 'actions', label: 'Actions', render: (r) => (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setEditingDriver(r); setIsDriverModalOpen(true); }}
                        className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                      >
                        Edit & Login
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(r.id, r.name)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              data={drivers}
              emptyText="No drivers registered yet."
            />
          </div>
        )}

        {/* ================= TAB 4: PARCELS & CONSIGNMENTS ================= */}
        {tab === 'parcels' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Consignments & Delivery Parcels</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">Add, edit, remove, and review score breakdowns across Ahmedabad hubs</p>
              </div>
              <button
                onClick={() => { setEditingParcel(null); setIsParcelModalOpen(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-semibold shadow-xs transition"
              >
                + Create New Parcel
              </button>
            </div>

            <DataTable
              columns={[
                { key: 'id', label: 'ID', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">#{r.id}</span> },
                {
                  key: 'route', label: 'Corridor', render: (r) => (
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{r.pickup_name}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{r.delivery_name}</span>
                    </div>
                  ),
                  sortValue: (r) => `${r.pickup_name} ${r.delivery_name}`,
                },
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
                        title="View 7-Factor Score Breakdown"
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
              data={parcels}
            />
          </div>
        )}

        {/* ================= TAB 5: ASSIGNMENTS & AMFOA ================= */}
        {tab === 'assignments' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">Fleet Allocations & AMFOA Historical Records</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400">Recorded optimization scores, factor breakdowns, and driver allocations</p>
              </div>
            </div>

            <DataTable
              columns={[
                { key: 'id', label: 'ID', render: (r) => <span className="font-bold text-slate-800 dark:text-slate-100">#{r.id}</span> },
                {
                  key: 'parcel', label: 'Consignment', render: (r) => (
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">Parcel #{r.parcel_id}</span>
                      <span className="block text-[11px] text-slate-400 dark:text-slate-400">{r.pickup_name} → {r.delivery_name}</span>
                    </div>
                  ),
                  sortValue: (r) => r.parcel_id,
                },
                {
                  key: 'vehicle_number', label: 'Assigned Vehicle', render: (r) => (
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{r.vehicle_number}</span>
                  ),
                },
                {
                  key: 'driver_name', label: 'Driver', render: (r) => (
                    <span className="text-slate-700 dark:text-slate-300 text-xs">{r.driver_name || 'Assigned Driver'}</span>
                  ),
                },
                {
                  key: 'optimization_score', label: 'AMFOA Score', render: (r) => (
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {Number(r.optimization_score || 0).toFixed(3)}
                    </span>
                  ),
                },
                {
                  key: 'status', label: 'Status', render: (r) => (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}>
                      {r.status}
                    </span>
                  ),
                },
                {
                  key: 'actions', label: 'Breakdown', render: (r) => (
                    <button
                      onClick={() => setInspectParcelId(r.parcel_id)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold"
                    >
                      View Breakdown
                    </button>
                  ),
                },
              ]}
              data={assignments}
              emptyText="No assignments recorded yet."
            />
          </div>
        )}

        {/* ================= TAB 6: KNAPSACK LOAD MAXIMIZER ================= */}
        {tab === 'optimizer' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">0/1 Multi-Constraint Knapsack Load Maximizer</h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
                Branch-and-Bound algorithm with density heuristic sorting: optimally packs pending consignments to maximize delivery value (priority + deadline urgency) while strictly respecting remaining vehicle payload weight (kg) and volumetric capacity (m³).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={loadVehicleId}
                onChange={(e) => setLoadVehicleId(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select vehicle for knapsack load analysis…</option>
                {vehicles.map((v) => {
                  const remW = Math.max(0, v.max_weight_kg - v.current_load_kg);
                  const remV = Math.max(0, Number((v.max_volume_m3 - v.current_volume_m3).toFixed(2)));
                  return (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} — {v.type} ({remW} kg / {remV} m³ available)
                    </option>
                  );
                })}
              </select>
              <button
                onClick={suggestLoad}
                disabled={!loadVehicleId}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm rounded-xl font-bold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>⚡</span>
                <span>Run Knapsack Analysis</span>
              </button>
            </div>

            {loadSuggestion && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      Target Vehicle: {loadSuggestion.vehicle} ({loadSuggestion.vehicleType || 'Commercial'})
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Remaining Capacity Budget: {loadSuggestion.remainingWeight} kg / {loadSuggestion.remainingVolume} m³
                    </span>
                  </div>
                  {loadSuggestion.suggestedParcels?.length > 0 && (
                    <button
                      onClick={() => applyKnapsackLoad()}
                      disabled={applyingKnapsack}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>⚡</span>
                      <span>{applyingKnapsack ? 'Allocating…' : `Assign Entire Package (${loadSuggestion.suggestedParcels.length} Parcels)`}</span>
                    </button>
                  )}
                </div>

                {loadSuggestion.suggestedParcels?.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">
                    No pending parcels fit within this vehicle's remaining weight ({loadSuggestion.remainingWeight}kg) and volume ({loadSuggestion.remainingVolume}m³) limits.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Metric Gauges */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                        <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Payload to Load</span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {loadSuggestion.totalWeight} kg
                        </span>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
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
                            className="bg-indigo-600 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, loadSuggestion.volumeUtilizationPct)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          {loadSuggestion.volumeUtilizationPct}% of free budget
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                        <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold">Knapsack Delivery Value</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          +{loadSuggestion.totalValue} pts
                        </span>
                        <span className="text-[10px] text-slate-400 block pt-1">
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
        )}
      </main>

      {/* Modals */}
      <DriverModal
        isOpen={isDriverModalOpen}
        onClose={() => { setIsDriverModalOpen(false); setEditingDriver(null); }}
        onSave={handleSaveDriver}
        driver={editingDriver}
        vehicles={vehicles}
      />

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
