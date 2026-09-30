import { useState, useMemo } from 'react';

export default function DataTable({
  columns = [],
  data = [],
  emptyText = 'No records found',
  defaultSortKey = null,
  defaultSortDir = 'asc',
  showColumnFiltersDefault = false,
  pageSizeDefault = 10,
}) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [showColumnFilters, setShowColumnFilters] = useState(showColumnFiltersDefault);
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);

  // Helper to extract a comparable string or number from a row
  function getRawValue(row, col) {
    if (col.sortValue) return col.sortValue(row);
    if (col.filterValue) return col.filterValue(row);

    const key = col.key;
    if (row[key] !== undefined && row[key] !== null) return row[key];

    // Check nested or fallback keys
    if (key === 'route' || key === 'corridor') {
      return `${row.pickup_name || ''} ${row.delivery_name || ''}`;
    }
    if (key === 'vehicle') {
      return `${row.vehicle_number || ''} ${row.vehicle_type || ''} ${row.driver_name || ''}`;
    }
    if (key === 'hours') {
      return row.working_hours_today ?? 0;
    }
    if (key === 'action' || key === 'actions') {
      return '';
    }

    return '';
  }

  // Handle Sort Click on Column Header
  function handleHeaderClick(col) {
    if (col.sortable === false || col.key === 'action' || col.key === 'actions') return;

    if (sortKey === col.key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        // Reset sort
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }

  // Handle Column Filter Change
  function handleColumnFilterChange(key, value) {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!value || value.trim() === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setCurrentPage(1);
  }

  // Clear all filters
  function clearAllFilters() {
    setGlobalSearch('');
    setColumnFilters({});
    setSortKey(null);
    setCurrentPage(1);
  }

  // Filtered & Sorted Data computation
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // 1. Global Search Filter
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      result = result.filter((row) => {
        return columns.some((col) => {
          const val = getRawValue(row, col);
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // 2. Per-Column Filters
    const activeFilterKeys = Object.keys(columnFilters);
    if (activeFilterKeys.length > 0) {
      result = result.filter((row) => {
        return activeFilterKeys.every((key) => {
          const filterVal = columnFilters[key].toLowerCase().trim();
          const col = columns.find((c) => c.key === key);
          if (!col) return true;
          const cellVal = getRawValue(row, col);
          if (cellVal === undefined || cellVal === null) return false;
          return String(cellVal).toLowerCase().includes(filterVal);
        });
      });
    }

    // 3. Sorting
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        result.sort((a, b) => {
          const aVal = getRawValue(a, col);
          const bVal = getRawValue(b, col);

          // Handle null / undefined
          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          // Numeric comparison
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          if (!isNaN(aNum) && !isNaN(bNum) && typeof aVal !== 'boolean' && typeof bVal !== 'boolean') {
            return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
          }

          // Date comparison
          if (aVal instanceof Date || (typeof aVal === 'string' && !isNaN(Date.parse(aVal)) && (col.key.includes('deadline') || col.key.includes('at')))) {
            const aTime = new Date(aVal).getTime();
            const bTime = new Date(bVal).getTime();
            return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
          }

          // String comparison
          const comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
          return sortDir === 'asc' ? comp : -comp;
        });
      }
    }

    return result;
  }, [data, columns, globalSearch, columnFilters, sortKey, sortDir]);

  // Pagination slicing
  const totalItems = filteredAndSortedData.length;
  const isAll = pageSize === 'all' || pageSize >= totalItems;
  const effectivePageSize = isAll ? Math.max(1, totalItems) : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (isAll) return filteredAndSortedData;
    const start = (safeCurrentPage - 1) * effectivePageSize;
    return filteredAndSortedData.slice(start, start + effectivePageSize);
  }, [filteredAndSortedData, safeCurrentPage, effectivePageSize, isAll]);

  const hasActiveFilters = globalSearch.trim() !== '' || Object.keys(columnFilters).length > 0 || sortKey !== null;

  return (
    <div className="space-y-3">
      {/* Table Toolbar: Global Search, Column Filters Toggle, Clear, Page Size */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search across all columns…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition"
            />
            <span className="absolute left-2.5 top-1.5 text-slate-400 dark:text-slate-500">🔍</span>
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => setShowColumnFilters((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 whitespace-nowrap transition ${
              showColumnFilters || Object.keys(columnFilters).length > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300'
                : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span>⚡</span>
            <span>{showColumnFilters ? 'Hide Column Filters' : 'Filter by Column'}</span>
            {Object.keys(columnFilters).length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                {Object.keys(columnFilters).length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
            >
              Reset Filters
            </button>
          )}

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value="all">All ({data.length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-colors">
        <table className="min-w-full text-xs border-collapse">
          {/* Table Header with Sorting */}
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((c) => {
                const isSorted = sortKey === c.key;
                const canSort = c.sortable !== false && c.key !== 'action' && c.key !== 'actions';
                return (
                  <th
                    key={c.key}
                    onClick={() => handleHeaderClick(c)}
                    className={`text-left px-3.5 py-3 select-none ${
                      canSort ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{c.label}</span>
                      {canSort && (
                        <span className={`text-[10px] ${isSorted ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>
                          {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>

            {/* Per-Column Filter Row */}
            {showColumnFilters && (
              <tr className="bg-slate-100/70 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800">
                {columns.map((c) => {
                  const isAction = c.key === 'action' || c.key === 'actions';
                  if (isAction) {
                    return <th key={c.key} className="px-3.5 py-2"></th>;
                  }
                  return (
                    <th key={c.key} className="px-3 py-1.5 font-normal">
                      <input
                        type="text"
                        value={columnFilters[c.key] || ''}
                        onChange={(e) => handleColumnFilterChange(c.key, e.target.value)}
                        placeholder={`Filter ${c.label || ''}…`}
                        className="w-full px-2 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs italic"
                >
                  {hasActiveFilters ? 'No records match your filter criteria.' : emptyText}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, i) => (
                <tr
                  key={row.id ?? row.assignment_id ?? i}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer: Item Counter & Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
        <div>
          Showing{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {totalItems === 0 ? 0 : (safeCurrentPage - 1) * effectivePageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {Math.min(totalItems, safeCurrentPage * effectivePageSize)}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{totalItems}</span> entries
          {totalItems !== data.length && (
            <span className="ml-1 text-slate-400 dark:text-slate-500">
              (filtered from {data.length} total)
            </span>
          )}
        </div>

        {!isAll && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition font-medium"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
              .map((p, idx, arr) => {
                const prevP = arr[idx - 1];
                return (
                  <span key={p} className="flex items-center">
                    {prevP && p - prevP > 1 && <span className="px-1 text-slate-400">…</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                        safeCurrentPage === p
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition font-medium"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
