import mongoose from 'mongoose';
import config from '../src/app/config';
import { User } from '../src/app/modules/user/user.model';

async function makeSuperAdmin() {
    try {
        await mongoose.connect(config.database_url as string);
        console.log('Database connected.');

        const email = 'rijoanmaruf1@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User with email ${email} not found.`);
            process.exit(1);
        }

        user.isSuperAdmin = true;
        await user.save();
        console.log(`Successfully made ${email} a super admin!`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

makeSuperAdmin();
