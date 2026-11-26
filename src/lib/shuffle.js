// Har bir talabaga test savollari va variantlarini har xil tartibda ko'rsatish.
// Tartib "seed" ga bog'liq: bir xil seed doim bir xil tartib beradi (sahifa yangilansa o'zgarmaydi).

function seededRandom(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return () => {
        h = (h + 0x6D2B79F5) >>> 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffle(list, seed) {
    const random = seededRandom(String(seed));
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Joylashuvga bog'liq variantlar ("yuqoridagilarning hammasi", "A va B") bor savolda tartib o'zgarmaydi
const POSITIONAL = /yuqorida|barcha(si| javob)|hamma(si| javob)|javob(lar)? yo|all of the above|none of the above|(^|\s)[A-F]\s*(va|and|,|&)\s*[A-F](\s|$|\.)/i;

/** Variantlarning ko'rsatish tartibi: asl indekslar ro'yxati (javob asl indeks bilan saqlanadi) */
export function optionOrder(options, seed) {
    const order = options.map((_, i) => i);
    return options.some(o => POSITIONAL.test(String(o))) ? order : shuffle(order, seed);
}

/** Test savollari o'zaro aralashtiriladi, amaliy masalalar o'z joyida qoladi */
export function arrangeExam(questions, seed) {
    const tests = shuffle(questions.filter(q => q.type === 'test'), seed);
    let next = 0;
    return questions.map(q => {
        if (q.type !== 'test') return q;
        const t = tests[next++];
        return { ...t, optionOrder: optionOrder(t.options, `${seed}:${t._id}`) };
    });
}
