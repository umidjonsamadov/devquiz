import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, default: 'BookOpen' },
    color: { type: String, default: 'green' },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

if (mongoose.models.Category) delete mongoose.models.Category;
export const Category = mongoose.model('Category', categorySchema);
