import mongoose from 'mongoose';
import { User } from '../../../../models/User.js';
import { TrainProblem } from '../../../../models/TrainProblem.js';
import { TrainSolve } from '../../../../models/TrainSolve.js';
import { TrainSubmission } from '../../../../models/TrainSubmission.js';
import { trainAccess, canSee, json } from '../../../access.js';
import { getXpBoost } from '../../../../config/xpBoost.js';
import { DIFFICULTY, deepEqual } from '../../../../../../lib/train.js';
import { notifyMany } from '../../../../../../lib/notify.js';
import {
    snapshot, achievementNotifications, levelNotification,
} from '../../../../../../lib/achievements.js';

function matches(output, expected) {
    if (typeof output !== 'string') return false;
    try { return deepEqual(JSON.parse(output), expected); }
    catch { return false; } // "Xato: ..." kabi matnlar JSON emas
}

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

async function awardXp(userId, xpReward) {
    const user = await User.findById(userId);
    if (!user) return;
    const before = snapshot(user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyXp = user.dailyXpDate && sameDay(user.dailyXpDate, today) ? (user.dailyXp || 0) + xpReward : xpReward;
    user.xp = (user.xp || 0) + xpReward;
    user.dailyXp = dailyXp;
    user.dailyXpDate = today;

    let entry = user.activity.find(a => sameDay(a.date, today));
    if (!entry) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const hadYesterday = user.activity.some(a => sameDay(a.date, yesterday) && (a.questions || 0) > 0);
        user.dayStreak = hadYesterday ? (user.dayStreak || 0) + 1 : 1;
        user.activity.push({ date: today, xp: xpReward, questions: 1 });
    } else {
        entry.xp = (entry.xp || 0) + xpReward;
        entry.questions = (entry.questions || 0) + 1;
    }

    const after = snapshot(user);
    user.level = after.level;
    await user.save();
    await notifyMany(user.username, [
        ...levelNotification(before, after),
        ...achievementNotifications(before, after),
    ]);
}

// Body: { language, code, outputs: string[] } — outputs testlar tartibida, funksiya qaytargan JSON.
// Kod brauzerda ishlaydi, lekin yashirin javoblar faqat shu yerda solishtiriladi.
export async function POST(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return json({ message: 'Masala topilmadi' }, 404);

        const p = await TrainProblem.findById(id).lean();
        if (!p || !canSee(p, access)) return json({ message: 'Masala topilmadi' }, 404);

        const { language, code, outputs } = await req.json();
        if (!p.languages.includes(language) || typeof code !== 'string' || !code.trim() || code.length > 20_000
            || !Array.isArray(outputs) || outputs.length !== p.testCases.length) {
            return json({ message: "Noto'g'ri so'rov" }, 400);
        }

        const results = p.testCases.map((t, i) => matches(outputs[i], t.expected));
        const passed = results.filter(Boolean).length;
        const total = results.length;
        const failedTest = passed === total ? undefined : results.indexOf(false) + 1;
        // Nashrdan oldingi urinish faqat tekshiruv: XP, reyting va statistikaga yozilmaydi
        if (p.published === false) {
            return json({ accepted: passed === total, passed, total, failedTest, xp: 0, preview: true });
        }
        await TrainSubmission.create({
            username: access.user.username, problemId: id, accepted: passed === total,
        });
        if (passed !== total) {
            return json({ accepted: false, passed, total, failedTest });
        }

        const reward = p.author === access.user.username ? 0 : DIFFICULTY[p.difficulty].xp;
        // Bonus bu yechim reytingga qo'shilishidan oldingi o'ringa qarab beriladi
        const { multiplier } = await getXpBoost(access.user.username);
        let firstSolve = true;
        try {
            await TrainSolve.create({
                _id: `${access.user._id}:${id}`, username: access.user.username, problemId: id, language, code,
                // xp — reyting bali (bonussiz), bonusXp — 1-o'rin uchun qo'shimcha XP
                difficulty: p.difficulty, xp: reward, bonusXp: reward * (multiplier - 1),
            });
        } catch (e) {
            if (e?.code !== 11000) throw e;
            firstSolve = false;
            await TrainSolve.updateOne({ _id: `${access.user._id}:${id}` }, { $set: { language, code } });
        }

        // XP faqat birinchi marta va o'z masalasi uchun emas
        let xp = 0;
        if (firstSolve) {
            await TrainProblem.updateOne({ _id: id }, { $inc: { solvedCount: 1 } });
            if (reward) {
                xp = reward * multiplier;
                await awardXp(access.user._id, xp);
            }
        }
        return json({ accepted: true, passed, total, xp, xpMultiplier: multiplier });
    } catch (e) {
        console.error('Train submit error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}
