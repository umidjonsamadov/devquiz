'use client';

import { useState } from 'react';
import { Rocket, EyeOff, Clock, CircleCheck, Loader2 } from 'lucide-react';

/**
 * Nashr holati. onChange(published) xato bo'lsa matn qaytaradi.
 * onChange berilmasa (masala muallifi) faqat holat ko'rsatiladi.
 */
export default function PublishBar({ what, published, onChange }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const toggle = async () => {
        const question = published
            ? `Bu ${what} nashrdan olinsinmi? Boshqalarga "Coming soon" bo'lib ko'rinadi.`
            : `Tekshirib bo'ldingizmi? Bu ${what} hammaga ko'rinadi.`;
        if (!window.confirm(question)) return;
        setSaving(true);
        setError('');
        setError((await onChange(!published)) || '');
        setSaving(false);
    };

    return (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2 text-xs ${published ? 'border-gray-800 bg-gray-900 text-gray-400' : 'border-yellow-800/60 bg-yellow-900/20 text-yellow-200'}`}>
            {published ? <CircleCheck size={14} className="text-green-400" /> : <Clock size={14} />}
            <span className="font-semibold">
                {published ? 'Nashr qilingan: hammaga ko\'rinadi'
                    : onChange ? 'Nashr qilinmagan: boshqalarga "Coming soon" bo\'lib ko\'rinadi'
                    : 'Tekshiruvda: admin nashr qilgach hammaga ko\'rinadi'}
            </span>
            {error && <span role="alert" className="text-red-400">{error}</span>}
            {onChange && (
                <button onClick={toggle} disabled={saving}
                    className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold disabled:opacity-60 ${published ? 'border border-gray-700 text-gray-400 hover:text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : published ? <EyeOff size={13} /> : <Rocket size={13} />}
                    {published ? 'Nashrdan olish' : 'Publish'}
                </button>
            )}
        </div>
    );
}
