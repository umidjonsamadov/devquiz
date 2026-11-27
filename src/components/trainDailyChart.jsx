'use client';

import { useState } from 'react';

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export const shortDate = (d) => `${new Date(d).getDate()}-${MONTHS[new Date(d).getMonth()]}`;

// Kunlik yechilgan masalalar. Bitta qator ma'lumot — legend kerak emas, qolgani hover'da.
export default function TrainDailyChart({ series, height = 96 }) {
    const [active, setActive] = useState(null);
    const max = Math.max(1, ...series.map(d => d.solved));
    const shown = series[active ?? series.length - 1];
    const isToday = active === null || active === series.length - 1;

    return (
        <div>
            <p className="text-xs text-gray-400 mb-2 min-h-[32px]">
                <span className="text-gray-200 font-semibold">{isToday ? 'Bugun' : shortDate(shown.date)}:</span>{' '}
                {shown.solved} ta yechildi · {shown.attempts} urinish · +{shown.xp} XP
            </p>
            <div className="flex gap-2">
                <div className="flex flex-col justify-between text-[10px] text-gray-500 text-right w-3" style={{ height }}>
                    <span>{max}</span><span>0</span>
                </div>
                <div className="flex-1 flex items-stretch gap-[2px] border-b border-gray-700" style={{ height }} onMouseLeave={() => setActive(null)}>
                    {series.map((d, i) => (
                        <button key={i} type="button" onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                            aria-label={`${shortDate(d.date)}: ${d.solved} ta yechildi, ${d.attempts} urinish`}
                            className={`flex-1 min-w-0 flex items-end justify-center rounded-t outline-none ${active === i ? 'bg-gray-800' : ''}`}>
                            {d.solved > 0 && (
                                <span className="block w-full max-w-[24px] rounded-t bg-green-500" style={{ height: `${(d.solved / max) * 100}%` }} />
                            )}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 pl-5">
                <span>{shortDate(series[0].date)}</span>
                <span>Bugun</span>
            </div>
        </div>
    );
}
