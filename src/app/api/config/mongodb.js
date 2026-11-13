
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;

// MongoDB ulanishini cache qilish
let cached = global._mongooseCache;

if (!cached) {
    cached = global._mongooseCache = {
        conn: null,
        promise: null,
    };
}

export async function connectDB() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!mongoUri) {
        throw new Error('MONGODB_URI topilmadi. .env.local faylini tekshiring.');
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(mongoUri, {
            bufferCommands: false,
            maxPoolSize: 20,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 5000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
            retryReads: true,
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;
        throw err;
    }

    return cached.conn;
}

export default mongoose;
