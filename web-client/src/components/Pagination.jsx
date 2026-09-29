// ============================================================================
// File: Pagination.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Description: Shared client-side pagination (usePagination hook + footer bar)
//              used by every list/table in the web console.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Slices `items` into pages.
 * `resetKey` should change whenever the filters/search change, so the view jumps back to page 1.
 */
export function usePagination(items, initialPageSize = 10, resetKey = '') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // New filters or page size: start again from the first page
  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  // The list can shrink after a refresh or an action; never sit on an empty page
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems };
}

// 1 … 4 5 6 … 12 (always shows first, last and the neighbours of the current page)
const getPageList = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('ellipsis-start');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push('ellipsis-end');
  pages.push(totalPages);
  return pages;
};

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  compact = false,
  className = ''
}) {
  if (!totalItems) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  // A page using a non-standard size (e.g. 9 cards in a 3x3 grid) still shows it in the selector
  const sizeOptions = PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b);

  const navButton =
    'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg border text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const idle =
    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${
        compact ? 'px-1 pt-3' : 'px-6 py-4 border-t border-slate-200 dark:border-slate-800/80'
      } text-xs ${className}`}
    >
      <p className="text-slate-500 dark:text-slate-400">
        Showing <strong className="text-slate-900 dark:text-white">{from}–{to}</strong> of{' '}
        <strong className="text-slate-900 dark:text-white">{totalItems}</strong> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
            >
              {sizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className={`${navButton} ${idle}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {getPageList(page, totalPages).map((p) =>
              typeof p === 'string' ? (
                <span key={p} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={`${navButton} ${
                    p === page
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                      : idle
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className={`${navButton} ${idle}`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
