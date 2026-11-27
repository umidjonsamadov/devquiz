import Link from 'next/link';
import { Clock, ArrowLeft } from 'lucide-react';
import { getStyle } from '../lib/categoryStyle';

/** Quiz ro'yxatidagi hali nashr qilinmagan library kartasi: ochib bo'lmaydi */
export function ComingSoonCard({ lib }) {
    const { Icon, color, bg, border } = getStyle(lib);
    return (
        <div aria-disabled="true" className="relative flex flex-col bg-gray-900/60 border border-dashed border-gray-700 rounded-2xl p-5 cursor-default">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${bg} border ${border} flex items-center justify-center opacity-50`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-xl bg-gray-800 text-gray-400 border border-gray-700">
                    <Clock size={10} /> Coming soon
                </span>
            </div>
            <h2 className="text-lg font-extrabold text-gray-400 mb-1 break-words">{lib.name}</h2>
            <p className="text-sm text-gray-600">Bu quiz hozircha yo&apos;q, tez orada qo&apos;shiladi.</p>
        </div>
    );
}

/** Havola orqali kirilganda ko'rsatiladigan sahifa */
export function ComingSoonPage({ title, what, backHref }) {
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                <Clock className="w-7 h-7 text-yellow-400" />
            </div>
            {title && <p className="text-gray-400 text-sm mb-1 break-words">{title}</p>}
            <h1 className="text-2xl font-extrabold text-white mb-2">Coming soon</h1>
            <p className="text-gray-500 text-sm mb-5">Bu {what} hozircha yo&apos;q, tez orada qo&apos;shiladi.</p>
            <Link href={backHref} className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300">
                <ArrowLeft size={14} /> Orqaga
            </Link>
        </div>
    );
}
