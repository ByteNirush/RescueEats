import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const resetDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get all collections
        const collections = await mongoose.connection.db.collections();

        console.log(`\n📋 Found ${collections.length} collections:`);
        collections.forEach(collection => {
            console.log(`   - ${collection.collectionName}`);
        });

        // Drop all collections
        console.log('\n🗑️  Dropping all collections...');
        for (const collection of collections) {
            await collection.drop();
            console.log(`   ✓ Dropped: ${collection.collectionName}`);
        }

        console.log('\n✅ Database reset complete! All data has been deleted.');
        console.log('💡 You can now restart your server with fresh data.\n');

        // Close connection
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error.message);
        process.exit(1);
    }
};

resetDatabase();
