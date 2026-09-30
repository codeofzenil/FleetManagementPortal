import { useState, useEffect } from 'react';

export default function DriverModal({ isOpen, onClose, onSave, driver = null, vehicles = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    license_no: '',
    experience_years: 3,
    max_working_hours: 8,
    working_hours_today: 0,
    assigned_vehicle_id: '',
    availability: true,
    rating: 5.0,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setFormData({
        name: driver.name || '',
        email: driver.email || '',
        password: '',
        license_no: driver.license_no || '',
        experience_years: driver.experience_years ?? 3,
        max_working_hours: driver.max_working_hours ?? 8,
        working_hours_today: driver.working_hours_today ?? 0,
        assigned_vehicle_id: driver.assigned_vehicle_id ? String(driver.assigned_vehicle_id) : '',
        availability: driver.availability !== undefined ? driver.availability : true,
        rating: driver.rating ?? 5.0,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: 'password123',
        license_no: 'GJ01-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
        experience_years: 3,
        max_working_hours: 8,
        working_hours_today: 0,
        assigned_vehicle_id: '',
        availability: true,
        rating: 5.0,
      });
    }
    setError('');
  }, [driver, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) return setError('Driver name is required');
    if (!formData.email.trim()) return setError('Email is required');
    if (!driver && !formData.password.trim()) return setError('Password is required for new driver login');

    setSaving(true);
    try {
      await onSave({
        ...formData,
        assigned_vehicle_id: formData.assigned_vehicle_id ? Number(formData.assigned_vehicle_id) : null,
        experience_years: Number(formData.experience_years),
        max_working_hours: Number(formData.max_working_hours),
        working_hours_today: Number(formData.working_hours_today),
        rating: Number(formData.rating),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save driver');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-lg w-full overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              {driver ? `Edit Driver — ${driver.name}` : 'Add New Driver & Login Account'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-400">Driver profile and credentials for mobile/web access</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Ramesh Patel"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email (Login) *</label>
              <input
                required
                type="email"
                placeholder="ramesh@stmpas.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password {driver ? '(Blank to keep current)' : '*'}
              </label>
              <input
                type="password"
                placeholder={driver ? '••••••••' : 'Enter password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Driving License No.</label>
              <input
                type="text"
                placeholder="GJ01-2021-004391"
                value={formData.license_no}
                onChange={(e) => setFormData({ ...formData, license_no: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Vehicle</label>
              <select
                value={formData.assigned_vehicle_id}
                onChange={(e) => setFormData({ ...formData, assigned_vehicle_id: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No vehicle assigned (Pool)</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_number} — {v.type} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Experience (Years)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Max Shift Hours</label>
              <input
                type="number"
                min="1"
                max="16"
                step="0.5"
                value={formData.max_working_hours}
                onChange={(e) => setFormData({ ...formData, max_working_hours: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hours Logged Today</label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={formData.working_hours_today}
                onChange={(e) => setFormData({ ...formData, working_hours_today: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Driver Active & Available for AMFOA</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Rating:</span>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="w-14 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2 py-1 text-xs text-center font-bold text-amber-600 dark:text-amber-400"
              />
              <span className="text-amber-500 text-xs">★</span>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : driver ? 'Save Changes' : 'Create Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
