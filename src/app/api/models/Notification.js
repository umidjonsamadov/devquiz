import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    // Bir xil voqea uchun ikki marta bildirishnoma yaratmaslik kaliti (masalan "ach:first", "lvl:5")
    key:      { type: String, required: true },
    type:     { type: String, default: 'info' }, // achievement | level | challenge | reward | streak | info
    title:    { type: String, required: true },
    message:  { type: String, default: '' },
    emoji:    { type: String, default: '🔔' },
    link:     { type: String, default: '' },
    read:     { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ username: 1, key: 1 }, { unique: true });
notificationSchema.index({ username: 1, createdAt: -1 });
// 60 kundan keyin avtomatik o'chiriladi
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export const Notification =
    mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
