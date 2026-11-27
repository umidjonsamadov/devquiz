'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Brauzerdagi ro'yxatni sahifalarga bo'ladi.
 * Ro'yxat qisqarsa (qidiruv, yangilash), sahifa raqami oxirgi mavjud sahifaga tushadi.
 */
export function usePagination(items, perPage) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const current = Math.min(page, totalPages);
    const start = (current - 1) * perPage;
    return {
        pageItems: items.slice(start, start + perPage),
        start,
        pager: { page: current, totalPages, total: items.length, perPage, onChange: setPage },
        reset: () => setPage(1),
    };
}

// Birinchi, oxirgi va joriy sahifa atrofidagilar; orasi "…"
function pageRange(page, totalPages) {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const range = [1];
    if (page > 3) range.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) range.push(i);
    if (page < totalPages - 2) range.push('…');
    range.push(totalPages);
    return range;
}

const base = 'min-w-8 h-8 px-1.5 flex items-center justify-center rounded-lg text-xs font-semibold border transition-colors';
const idle = 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed';

export default function AdminPagination({ page, totalPages, total, perPage, onChange, className = '' }) {
    if (totalPages <= 1) return null;
    return (
        <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
            <p className="text-xs text-gray-600">
                <span className="text-gray-400 font-medium">{(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}</span> / {total}
            </p>
            <div className="flex items-center gap-1">
                <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Oldingi sahifa" className={`${base} ${idle}`}>
                    <ChevronLeft size={13} />
                </button>
                {pageRange(page, totalPages).map((p, i) => p === '…'
                    ? <span key={`dots-${i}`} className="w-6 text-center text-gray-600 text-xs">…</span>
                    : (
                        <button type="button" key={p} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}
                            className={`${base} ${p === page ? 'bg-green-600 border-green-500 text-white' : idle}`}>
                            {p}
                        </button>
                    ))}
                <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Keyingi sahifa" className={`${base} ${idle}`}>
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
}
