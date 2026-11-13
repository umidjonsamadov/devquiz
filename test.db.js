import dns from 'node:dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config({ path: '.env.local' });

async function testDB() {
    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error('MONGODB_URI topilmadi!');
        }

        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log('✅ MongoDB muvaffaqiyatli ulandi!');
        await mongoose.disconnect();
    } catch (error) {
        console.log('❌ MongoDB xatosi:');
        console.log(error.message);
    }
}

testDB();