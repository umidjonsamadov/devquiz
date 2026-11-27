// Netlify jadval funksiyasi: har soatda AI savol generatsiyasini chaqiradi.
// Kunlik reja (100 ta) bajarilgach, qolgan chaqiruvlar hech narsa yaratmaydi.
export default async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || !process.env.URL) {
        console.log('ai-daily: CRON_SECRET sozlanmagan');
        return;
    }
    try {
        const res = await fetch(`${process.env.URL}/api/ai/generate`, {
            method: 'POST',
            headers: { 'x-cron-secret': secret },
            // Jadval funksiyasi 30 soniyagacha ishlaydi. Javobni kutmay yopilsa ham
            // server so'rovni davom ettiradi; natija admin panelida ko'rinadi.
            signal: AbortSignal.timeout(28_000),
        });
        console.log('ai-daily:', res.status, await res.text());
    } catch (e) {
        console.log('ai-daily:', e.message);
    }
};

export const config = { schedule: '@hourly' };
