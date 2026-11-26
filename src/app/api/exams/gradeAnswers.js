/**
 * Javoblardan saqlanadigan natija va ballni hisoblaydi.
 * answers: { [qid]: variant }, code: { [qid]: matn }, countTests: false bo'lsa testlarga ball berilmaydi
 */
export function gradeAnswers(exam, answers = {}, code = {}, countTests = true) {
    let score = 0;
    const saved = {};
    for (const q of exam.questions) {
        const qid = String(q._id);
        if (q.type === 'test') {
            const choice = Number.isInteger(answers[qid]) ? answers[qid] : null;
            const earned = countTests && choice === q.correctAnswer ? q.points : 0;
            saved[qid] = { choice, earned };
            score += earned;
        } else {
            // Amaliy masala: kod saqlanadi, ballni admin qo'lda qo'yadi (graded=false)
            saved[qid] = { code: String(code[qid] || '').slice(0, 20000), earned: 0, graded: false };
        }
    }
    return { saved, score: Math.round(score * 100) / 100 };
}
