import Link from 'next/link';
import { Lock } from 'lucide-react';
import { TRAIN_LEVEL, xpForLevel } from '../lib/train';

export default function TrainLock({ level, xp = 0, required = TRAIN_LEVEL, title = 'Train yopiq' }) {
    const target = xpForLevel(required);
    const progress = Math.min(100, (xp / target) * 100);

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="max-w-sm w-full text-center space-y-5">
                <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto">
                    <Lock size={24} className="text-gray-500" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Ochish uchun <span className="text-green-400 font-semibold">Level {required}</span> ga yetish kerak
                    </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Joriy level</span>
                        <span className="text-white font-bold">Lv {level}</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                            <span className="text-white font-medium">{xp.toLocaleString()} XP</span>
                            <span>{target.toLocaleString()} XP</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                            Yana <span className="text-green-400 font-semibold">{Math.max(0, target - xp).toLocaleString()} XP</span> kerak
                        </p>
                    </div>
                    <Link href="/quiz"
                        className="flex items-center justify-center w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors">
                        Quizga o&apos;tish
                    </Link>
                </div>
            </div>
        </div>
    );
}
