// Admin yuborgan imtihon ma'lumotini tekshiradi va tozalaydi.
export function cleanExamBody(b) {
    const title = String(b?.title || '').trim();
    if (!title) return { error: 'Imtihon nomi majburiy' };
    if (!Array.isArray(b.questions) || b.questions.length === 0) return { error: "Kamida bitta savol qo'shing" };

    const questions = [];
    for (let i = 0; i < b.questions.length; i++) {
        const q = b.questions[i];
        const n = i + 1;
        const text = String(q?.text || '').trim();
        if (!text) return { error: `${n}-savol matni bo'sh` };
        const points = Math.max(0, Number(q.points) || 0);

        if (q.type === 'code') {
            // Amaliy masala: erkin dastur. Funksiya/test-case yo'q, ballni admin qo'lda qo'yadi.
            const language = q.language === 'python' ? 'python' : 'javascript';
            questions.push({ _id: q._id || undefined, type: 'code', text, points, language, starterCode: String(q.starterCode || '') });
        } else {
            const options = (q.options || []).map(o => String(o || '').trim());
            if (options.length < 2 || options.some(o => !o)) return { error: `${n}-savol: variantlarni to'ldiring` };
            const correctAnswer = Number(q.correctAnswer);
            if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
                return { error: `${n}-savol: to'g'ri javob tanlang` };
            }
            questions.push({ _id: q._id || undefined, type: 'test', text, points, options, correctAnswer });
        }
    }

    return {
        value: {
            title,
            description: String(b.description || ''),
            durationMinutes: Math.max(1, Number(b.durationMinutes) || 60),
            isActive: b.isActive === true,
            questions,
        },
    };
}
