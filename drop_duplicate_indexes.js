import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dropDuplicateIndexes = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // Drop duplicate indexes from users collection
        console.log('📋 Checking users collection...');
        try {
            const usersIndexes = await db.collection('users').indexes();
            console.log('Current indexes:', usersIndexes.map(idx => idx.name).join(', '));

            // Drop the duplicate email and phone indexes (keep the unique ones)
            if (usersIndexes.some(idx => idx.name === 'email_1')) {
                await db.collection('users').dropIndex('email_1');
                console.log('✓ Dropped duplicate index: email_1');
            }
            if (usersIndexes.some(idx => idx.name === 'phone_1')) {
                await db.collection('users').dropIndex('phone_1');
                console.log('✓ Dropped duplicate index: phone_1');
            }
        } catch (err) {
            console.log('⚠️  Users collection might not exist yet or indexes already clean:', err.message);
        }

        // Drop duplicate indexes from games collection
        console.log('\n📋 Checking games collection...');
        try {
            const gamesIndexes = await db.collection('games').indexes();
            console.log('Current indexes:', gamesIndexes.map(idx => idx.name).join(', '));

            // Drop the duplicate user index (keep the unique one)
            if (gamesIndexes.some(idx => idx.name === 'user_1')) {
                await db.collection('games').dropIndex('user_1');
                console.log('✓ Dropped duplicate index: user_1');
            }
        } catch (err) {
            console.log('⚠️  Games collection might not exist yet or indexes already clean:', err.message);
        }

        console.log('\n✅ Index cleanup complete!');
        console.log('💡 Restart your server to let Mongoose recreate the correct indexes.\n');

        // Close connection
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error dropping indexes:', error.message);
        process.exit(1);
    }
};

dropDuplicateIndexes();
