import { useState, useEffect } from 'react';

export default function ParcelModal({ isOpen, onClose, onSave, parcel = null, locations = [] }) {
  const [formData, setFormData] = useState({
    pickup_location_id: '',
    delivery_location_id: '',
    weight_kg: 50,
    volume_m3: 0.5,
    priority: 2,
    fragile: false,
    deadline: '',
    special_instructions: '',
    status: 'pending',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parcel) {
      let deadlineFormatted = '';
      if (parcel.deadline) {
        const d = new Date(parcel.deadline);
        deadlineFormatted = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
      setFormData({
        pickup_location_id: parcel.pickup_location_id ? String(parcel.pickup_location_id) : '',
        delivery_location_id: parcel.delivery_location_id ? String(parcel.delivery_location_id) : '',
        weight_kg: parcel.weight_kg ?? 50,
        volume_m3: parcel.volume_m3 ?? 0.5,
        priority: parcel.priority ?? 2,
        fragile: Boolean(parcel.fragile),
        deadline: deadlineFormatted,
        special_instructions: parcel.special_instructions || '',
        status: parcel.status || 'pending',
      });
    } else {
      const defaultDeadline = new Date(Date.now() + 8 * 3600 * 1000);
      const deadlineFormatted = new Date(defaultDeadline.getTime() - defaultDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      setFormData({
        pickup_location_id: locations.length > 0 ? String(locations[0].id) : '',
        delivery_location_id: locations.length > 1 ? String(locations[1].id) : '',
        weight_kg: 100,
        volume_m3: 0.8,
        priority: 2,
        fragile: false,
        deadline: deadlineFormatted,
        special_instructions: '',
        status: 'pending',
      });
    }
    setError('');
  }, [parcel, isOpen, locations]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!formData.pickup_location_id) return setError('Please select a pickup location in Ahmedabad');
    if (!formData.delivery_location_id) return setError('Please select a delivery location');
    if (formData.pickup_location_id === formData.delivery_location_id) {
      return setError('Pickup and delivery locations cannot be the same hub');
    }
    if (!formData.weight_kg || Number(formData.weight_kg) <= 0) return setError('Weight must be greater than 0 kg');
    if (!formData.volume_m3 || Number(formData.volume_m3) <= 0) return setError('Volume must be greater than 0 m³');
    if (!formData.deadline) return setError('Please specify a delivery deadline');

    setSaving(true);
    try {
      await onSave({
        ...formData,
        pickup_location_id: Number(formData.pickup_location_id),
        delivery_location_id: Number(formData.delivery_location_id),
        weight_kg: Number(formData.weight_kg),
        volume_m3: Number(formData.volume_m3),
        priority: Number(formData.priority),
        deadline: new Date(formData.deadline).toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save parcel');
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
              {parcel ? `Edit Parcel #${parcel.id}` : 'Create New Ahmedabad Consignment'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-400">AMFOA multi-constraint delivery parcel parameters</p>
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pickup Hub (Ahmedabad) *</label>
              <select
                required
                value={formData.pickup_location_id}
                onChange={(e) => setFormData({ ...formData, pickup_location_id: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select pickup hub…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delivery Destination *</label>
              <select
                required
                value={formData.delivery_location_id}
                onChange={(e) => setFormData({ ...formData, delivery_location_id: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select destination…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Weight (kg) *</label>
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                placeholder="Weight in kg"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Volume (m³) *</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Volume in m³"
                value={formData.volume_m3}
                onChange={(e) => setFormData({ ...formData, volume_m3: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority Tier</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1 — Critical / Emergency (Highest)</option>
                <option value="2">2 — Express / High</option>
                <option value="3">3 — Standard Commercial</option>
                <option value="4">4 — Economy</option>
                <option value="5">5 — Flexible / Bulk (Lowest)</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delivery Deadline *</label>
              <input
                required
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {parcel && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Parcel Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Special Instructions</label>
              <input
                type="text"
                placeholder="e.g. Pharmaceutical cold-chain boxes / Fragile electronics"
                value={formData.special_instructions}
                onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fragile}
                onChange={(e) => setFormData({ ...formData, fragile: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Fragile Cargo — Requires gentle handling</span>
            </label>
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
              {saving ? 'Saving…' : parcel ? 'Save Changes' : 'Create Parcel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
