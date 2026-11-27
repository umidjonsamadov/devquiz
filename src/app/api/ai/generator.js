import { GoogleGenAI } from '@google/genai';
import { Question } from '../models/Question.js';
import { Category } from '../models/Category.js';
import { AiDailyRun } from '../models/AiDailyRun.js';
import { AiDraft } from '../models/AiDraft.js';
import { freeSlots } from '../config/questionPool.js';
import { XP_BY_DIFFICULTY } from '../../../lib/quizRules.js';
import { optionOrder } from '../../../lib/shuffle.js';

// Bepul tarifli modellar, sifat tartibida. Birortasi band bo'lsa yoki javob bermasa, keyingisi ishlatiladi.
// Oxirgisi kichikroq, lekin tez va kam band bo'ladi
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
// Oxirgidan boshqa modelni shuncha kutiladi: bittasi osilib qolsa ham keyingisiga vaqt qoladi
const ATTEMPT_MS = 20_000;
// Boshqa model bilan hal bo'lishi mumkin bo'lgan xatolar (kalit yoki so'rov xatosida urinilmaydi)
const RETRY_STATUS = [404, 429, 500, 502, 503, 504];
export const DAILY_TARGET = 100;
// Netlify funksiyasi uzoq ishlay olmaydi, shuning uchun savollar partiyalab yaratiladi.
// Soatlik jadvalda kuniga 24 × 10 = 240 imkoniyat bor, xato bo'lgan soatlar o'rni qoplanadi
export const BATCH = 10;
const REQUEST_TIMEOUT_MS = 50_000;
const STOP_CHECK_MS = 1000;

// XP va vaqt qiyinlikdan kelib chiqadi (admin keyin tahrirlashi mumkin)
const REWARD = {
    Easy:   { xpReward: XP_BY_DIFFICULTY.Easy,   time: 20 },
    Medium: { xpReward: XP_BY_DIFFICULTY.Medium, time: 30 },
    Hard:   { xpReward: XP_BY_DIFFICULTY.Hard,   time: 45 },
};

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['question', 'options', 'correctAnswer', 'difficulty'],
                properties: {
                    question: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4, description: 'Roppa-rosa 4 ta variant' },
                    correctAnswer: { type: 'integer', minimum: 0, maximum: 3, description: "To'g'ri variantning indeksi (0 dan boshlanadi)" },
                    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
                },
            },
        },
    },
};

const SYSTEM = `Sen dasturlash bo'yicha test savollari tuzuvchi ekspertsan. Savollar o'zbek dasturchilari uchun quiz saytida chiqadi va foydalanuvchi to'g'ri javob uchun ball oladi, shuning uchun to'g'ri javobning aniqligi eng muhim narsa.

Talablar:
- Savol va variantlar o'zbek tilida (lotin yozuvida). Kod, kalit so'zlar va atamalar o'z holicha inglizcha qoladi.
- Har bir savolda roppa-rosa 4 ta variant va faqat bitta to'g'ri javob bo'lsin. Boshqa variantlar ishonarli, lekin aniq noto'g'ri bo'lsin.
- To'g'ri javobni tekshirib chiq. Versiyaga yoki muhitga qarab o'zgaradigan, bahsli savollarni tuzma.
- Savol bir necha o'n soniyada o'qib javob beriladigan bo'lsin. Kod parchasi bo'lsa, qisqa bo'lsin.
- "Yuqoridagilarning hammasi" yoki "A va B" kabi variant ishlatma: variantlar har safar aralashtiriladi.
- O'quvchilar endi o'rganayotganlar. Maqsad bilimni tekshirish, chalg'itish emas.
- Savol birinchi o'qishdayoq tushunarli bo'lsin: sodda so'zlar, qisqa gaplar, bitta savolda bitta narsa so'ralsin.
- Inglizcha atamani sun'iy tarjima qilma: o'zbek dasturchilari ishlatadigan ko'rinishda qoldir (masalan: list, funksiya, o'zgaruvchi).
- Ikki marta inkor ("noto'g'ri bo'lmagan") va chalg'ituvchi so'z o'yinlarini ishlatma.
- Tuzoqli savol, kam uchraydigan holat, tilning ichki ishlashi va yodlashni talab qiladigan mayda tafsilotlarni so'rama.
- Kod parchasi 6 qatordan oshmasin va unda bir-biriga bog'langan g'alati amallar bo'lmasin. Savol matnida kod alohida qatordan boshlansin va har bir buyruq o'z qatorida bo'lsin (haqiqiy yangi qator bilan).
- Kodli savolda to'g'ri javobni belgilashdan oldin kodni qadamma-qadam bajarib chiq.
- Qiyinlik darajalari so'rovda aytilgan sonlarga aniq mos kelsin. Uchalasi ham o'rganuvchi uchun yechsa bo'ladigan darajada:
  Easy: eng asosiy tushuncha yoki sintaksis; darsni o'tgan odam darhol javob beradi.
  Medium: bitta tushunchani qo'llash yoki 2–4 qatorli oddiy kodning natijasini topish.
  Hard: ikkita oddiy tushunchani birga qo'llash yoki qisqa kodni qadamma-qadam kuzatish. Olimpiada darajasida emas.
- Library nomi yoki tavsifidagi "easy", "oson" kabi so'zlar faqat mavzu nomining qismi: ular qiyinlik taqsimotini o'zgartirmaydi.
- Berilgan mavjud savollarni takrorlama va ularning boshqacha yozilgan ko'rinishini ham tuzma.`;

/** Bugungi sana Toshkent vaqti bo'yicha: YYYY-MM-DD */
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

const normalize = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export async function getTodayRun() {
    return AiDailyRun.findByIdAndUpdate(
        today(),
        { $max: { target: DAILY_TARGET } }, // oldingi kichik reja bilan ochilgan kun ham ko'tariladi
        { upsert: true, new: true },
    ).lean();
}

// Faqat admin tanlagan library'lar. Ulardan savoli (kutayotganlari bilan) eng kami tanlanadi.
// Kutayotgan qoralamalar ham joy egallaydi, shunda library sig'imidan ko'p savol tuzilmaydi.
async function pickCategory(categories) {
    const group = [{ $group: { _id: '$category', count: { $sum: 1 } } }];
    const [questions, drafts] = await Promise.all([
        Question.aggregate(group),
        AiDraft.aggregate([{ $match: { status: 'pending' } }, ...group]),
    ]);
    const toMap = (rows) => new Map(rows.map(r => [r._id, r.count]));
    const published = toMap(questions), pending = toMap(drafts);
    const size = (c) => (published.get(c.name) || 0) + (pending.get(c.name) || 0);

    for (const category of [...categories].sort((a, b) => size(a) - size(b))) {
        const free = await freeSlots(category.name);
        const room = free.main + free.extra - (pending.get(category.name) || 0);
        if (room > 0) return { ...category, room };
    }
    return null;
}

// Har bir partiyadagi taqsimot: taxminan 40% Easy, 40% Medium, 20% Hard
export function difficultyPlan(count) {
    const Easy = Math.round(count * 0.4), Hard = Math.round(count * 0.2);
    return { Easy, Medium: count - Easy - Hard, Hard };
}

/**
 * So'rovni to'xtatish tugmasi yoki vaqt chegarasi bo'yicha uzadi. SDK'ga signal beriladi,
 * lekin kutish unga bog'liq emas: signal fetch'ga yetib bormasa ham funksiya vaqtida qaytadi.
 */
async function abortable(parent, ms, start) {
    const controller = new AbortController();
    const forward = () => controller.abort(parent.reason);
    parent.addEventListener('abort', forward);
    const timer = setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), ms);
    const cancelled = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason));
    });
    try {
        return await Promise.race([start(controller.signal), cancelled]);
    } finally {
        clearTimeout(timer);
        parent.removeEventListener('abort', forward);
    }
}

async function askGemini(category, count, existing, signal) {
    const plan = difficultyPlan(count);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const request = {
        store: false, // so'rov va javob Google serverida suhbat sifatida saqlanmasin
        system_instruction: SYSTEM,
        input: [
            `"${category.name}" mavzusi bo'yicha ${count} ta yangi test savoli tuz.`,
            `Qiyinlik taqsimoti: Easy — ${plan.Easy} ta, Medium — ${plan.Medium} ta, Hard — ${plan.Hard} ta.`,
            category.description ? `Library tavsifi: ${category.description}` : '',
            existing.length
                ? `Mavjud savollar (takrorlama):\n${existing.map(q => `- ${q}`).join('\n')}`
                : 'Bu library hozircha bo\'sh.',
        ].filter(Boolean).join('\n\n'),
        response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    };

    // Hamma urinishlar uchun umumiy vaqt chegarasi
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    let interaction, used;
    for (const [i, model] of MODELS.entries()) {
        try {
            signal.throwIfAborted();
            const rest = Math.max(1000, deadline - Date.now());
            const left = i === MODELS.length - 1 ? rest : Math.min(ATTEMPT_MS, rest);
            interaction = await abortable(signal, left, (attempt) => ai.interactions.create(
                // Kichik model ko'proq o'ylasa, javobni kamroq xato belgilaydi (u tez, vaqt yetadi)
                { ...request, model, generation_config: { thinking_level: model.endsWith('lite') ? 'medium' : 'low', max_output_tokens: 16000 } },
                { maxRetries: 0, fetchOptions: { signal: attempt } }, // qayta urinish keyingi soatda
            ));
            used = model;
            break;
        } catch (e) {
            const status = e?.status ?? e?.statusCode;
            const retry = RETRY_STATUS.includes(status) || (!status && /timeout/i.test(`${e?.name} ${e?.message}`));
            // "To'xtatish" bosilgan bo'lsa, keyingi modelga o'tilmaydi
            if (signal.aborted || !retry || i === MODELS.length - 1) throw e;
            console.warn(`AI: ${model} ishlamadi (${status || 'timeout'}), ${MODELS[i + 1]} ishlatiladi`);
        }
    }

    if (interaction.status !== 'completed') throw new Error(`AI javobi to'liq chiqmadi (${interaction.status})`);
    if (!interaction.output_text) throw new Error('AI bo\'sh javob qaytardi');
    return { model: used, questions: JSON.parse(interaction.output_text).questions || [] };
}

// Sxema variantlar sonini kafolatlamaydi, shuning uchun har bir savol tekshiriladi
function isValid(q) {
    return typeof q.question === 'string' && q.question.trim().length >= 5
        && Array.isArray(q.options) && q.options.length === 4
        && q.options.every(o => typeof o === 'string' && o.trim())
        && new Set(q.options.map(o => o.trim())).size === 4
        && Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer < 4
        && Object.hasOwn(REWARD, q.difficulty);
}

function describeError(e) {
    const status = e?.status ?? e?.statusCode;
    const message = String(e?.message || e);
    if (status === 503) return "AI modellari hozir band, keyinroq qayta uriniladi";
    if (status === 401 || status === 403 || /api.?key/i.test(message)) return "API kalit noto'g'ri yoki ruxsat yo'q (GEMINI_API_KEY)";
    if (status === 429) return 'Bepul tarif limiti tugadi, keyinroq qayta uriniladi';
    if (/timeout|abort/i.test(`${e?.name} ${message}`)) return 'AI javobi kechikdi (timeout)';
    if (typeof status === 'number') return `API xatosi ${status}: ${message}`.slice(0, 300);
    return message.slice(0, 300);
}

/**
 * Bitta partiya savol yaratadi. Kunlik reja bajarilgan bo'lsa hech narsa qilmaydi,
 * shuning uchun uni necha marta chaqirsa ham kuniga DAILY_TARGET dan oshmaydi.
 */
export async function generateBatch(session = '') {
    if (!process.env.GEMINI_API_KEY) return { status: 'no-key' };

    await getTodayRun();
    const now = new Date();
    // Qulf: bir vaqtda faqat bitta generatsiya
    const run = await AiDailyRun.findOneAndUpdate(
        { _id: today(), lockedUntil: { $lt: now } },
        { $set: { lockedUntil: new Date(now.getTime() + REQUEST_TIMEOUT_MS + 30_000), lastRunAt: now } },
        { new: true },
    ).lean();
    if (!run) return { status: 'busy' };

    const finish = (update) => AiDailyRun.updateOne(
        { _id: run._id },
        { ...update, $set: { lockedUntil: new Date(0), ...update.$set } },
    );

    // "To'xtatish" boshqa so'rov (Netlify'da boshqa instance) orqali keladi, shuning uchun bazadan kuzatiladi
    const controller = new AbortController();
    const isStopped = async () => !!session && !!(await AiDailyRun.exists({ _id: run._id, stoppedSessions: session }));
    const stopped = async () => {
        await finish({ $set: { lastError: '' } });
        return { status: 'stopped', created: 0 };
    };
    let watcher;

    try {
        if (await isStopped()) return await stopped();

        const remaining = run.target - run.created;
        if (remaining <= 0) {
            await finish({});
            return { status: 'done', created: 0 };
        }

        const enabled = await Category.find({ aiEnabled: true }).select('name description').lean();
        if (!enabled.length) {
            await finish({ $set: { lastError: '' } });
            return { status: 'no-library' };
        }
        const category = await pickCategory(enabled);
        if (!category) {
            await finish({ $set: { lastError: "Tanlangan library'larda bo'sh joy yo'q" } });
            return { status: 'full' };
        }

        const count = Math.min(BATCH, remaining, category.room);
        // Library'dagi, kutayotgan va rad etilgan savollar takrorlanmasin
        const [published, drafted] = await Promise.all([
            Question.find({ category: category.name }).select('question').sort({ createdAt: -1 }).lean(),
            AiDraft.find({ category: category.name }).select('question').sort({ createdAt: -1 }).lean(),
        ]);
        const all = [...drafted, ...published];
        if (session) {
            watcher = setInterval(() => {
                isStopped().then(yes => { if (yes) controller.abort(); }).catch(() => {});
            }, STOP_CHECK_MS);
        }
        const { model, questions: generated } = await askGemini(category, count, all.slice(0, 200).map(q => q.question.slice(0, 160)), controller.signal);

        const seen = new Set(all.map(q => normalize(q.question)));
        const docs = generated.filter(q => {
            if (!isValid(q) || seen.has(normalize(q.question))) return false;
            seen.add(normalize(q.question));
            return true;
        }).slice(0, count).map(q => {
            // AI to'g'ri javobni ko'pincha birinchi qo'yadi, shuning uchun variantlar aralashtirib saqlanadi
            const order = optionOrder(q.options, Math.random());
            return {
                category: category.name,
                difficulty: q.difficulty,
                question: q.question.trim(),
                options: order.map(i => q.options[i].trim()),
                correctAnswer: order.indexOf(q.correctAnswer),
                ...REWARD[q.difficulty],
            };
        });
        // Javob kelgan paytda to'xtatilgan bo'lsa ham hech narsa saqlanmaydi
        if (await isStopped()) return await stopped();
        // Library'ga emas, qoralamaga: admin ruxsat bergandagina qo'shiladi
        if (docs.length) await AiDraft.insertMany(docs);

        await finish({
            $inc: { created: docs.length },
            $set: { lastError: docs.length ? '' : 'AI yaroqli yangi savol qaytarmadi' },
            ...(docs.length && { $push: { log: { at: new Date(), category: category.name, count: docs.length } } }),
        });
        return { status: 'ok', created: docs.length, category: category.name, model };
    } catch (e) {
        if (controller.signal.aborted) return await stopped();
        console.error('AI generate error:', e);
        const message = describeError(e);
        await finish({ $set: { lastError: message } });
        return { status: 'error', message };
    } finally {
        clearInterval(watcher);
    }
}

/** Shu ishga tushirishni to'xtatadi: davom etayotgan so'rov bekor qilinadi, natijasi saqlanmaydi */
export async function stopSession(session) {
    const run = await getTodayRun();
    await AiDailyRun.updateOne({ _id: run._id }, { $addToSet: { stoppedSessions: session } });
}
