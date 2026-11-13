import dns from 'node:dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: '.env.local' });

async function createIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ MongoDB ulandi');

        const db = mongoose.connection.db;

        // Users collection indexes
        console.log('\n📊 Users indexlari yaratilmoqda...');
        const users = db.collection('users');
        await users.createIndex({ username: 1 }, { unique: true });
        await users.createIndex({ xp: -1 });
        await users.createIndex({ xp: -1, joinedAt: 1 });
        await users.createIndex({ joinedAt: -1 });
        await users.createIndex({ questionsSolved: -1 });
        console.log('✅ Users indexlari tayyor');

        // Questions collection indexes
        console.log('\n📊 Questions indexlari yaratilmoqda...');
        const questions = db.collection('questions');
        await questions.createIndex({ category: 1 });
        await questions.createIndex({ category: 1, difficulty: 1 });
        await questions.createIndex({ category: 1, createdAt: -1 });
        await questions.createIndex({ difficulty: 1 });
        console.log('✅ Questions indexlari tayyor');

        // Ko'rsatish
        console.log('\n📋 Users indexlari:', await users.indexes());
        console.log('\n📋 Questions indexlari:', await questions.indexes());

        await mongoose.disconnect();
        console.log('\n🎉 Barcha indexlar muvaffaqiyatli yaratildi!');
    } catch (error) {
        console.error('❌ Xatolik:', error.message);
    }
}

createIndexes();
