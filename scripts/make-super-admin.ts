import mongoose from 'mongoose';
import config from '../src/app/config';
import { User } from '../src/app/modules/user/user.model';
import { Admin } from '../src/app/modules/admin/admin.model';

async function makeSuperAdmin() {
    const email = 'admin@gmail.com';
    const password = 'admin1234';

    console.log(`\n========================================`);
    console.log(`  CREATE / UPDATE SUPER ADMIN`);
    console.log(`========================================`);
    console.log(`📧 Target Email: ${email}`);
    console.log(`🔑 Target Password: ${password}`);

    try {
        console.log(`\n⏳ Connecting to database...`);
        await mongoose.connect(config.database_url as string);
        console.log(`✅ Database connected.`);

        // 1. Check if user already exists
        let user = await User.findOne({ email }).select('+password');

        if (user) {
            console.log(`\nℹ️  Existing user found with email: ${email}`);
            console.log(`   User ID: ${user._id}`);
            console.log(`   Registered ID: ${user.registeredId}`);

            // Update user credentials & super admin privileges
            user.password = password; // Will be hashed by pre-save hook
            user.role = 'admin';
            user.isSuperAdmin = true;
            user.status = 'active';
            user.isDeleted = false;
            await user.save();
            console.log(`✅ Updated existing user: role set to 'admin', isSuperAdmin=true, password updated.`);
        } else {
            console.log(`\nℹ️  No existing user found. Creating a fresh super admin user...`);
            const registeredId = `AID${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

            user = new User({
                registeredId,
                email,
                password, // Will be hashed by pre-save hook
                role: 'admin',
                isSuperAdmin: true,
                status: 'active',
                isDeleted: false,
            });

            await user.save();
            console.log(`✅ Created new User document:`);
            console.log(`   User ID: ${user._id}`);
            console.log(`   Registered ID: ${user.registeredId}`);
        }

        // 2. Ensure linked Admin profile exists
        let admin = await Admin.findOne({ user_id: user._id });
        if (!admin) {
            admin = await Admin.findOne({ email });
        }

        if (admin) {
            admin.user_id = user._id;
            admin.adminId = user.registeredId;
            admin.email = user.email;
            if (!admin.name) admin.name = 'Super Admin';
            await admin.save();
            console.log(`✅ Linked Admin profile updated (Admin ID: ${admin._id}).`);
        } else {
            admin = await Admin.create({
                user_id: user._id,
                adminId: user.registeredId,
                name: 'Super Admin',
                email: user.email,
            });
            console.log(`✅ Created Admin profile (Admin ID: ${admin._id}).`);
        }

        // 3. Verify password match through User model static method
        const verifyUser = await User.findOne({ email }).select('+password');
        if (!verifyUser) {
            throw new Error('Verification failed: User not found after save.');
        }

        const isPasswordCorrect = await User.isPasswordMatched(password, verifyUser.password);
        if (!isPasswordCorrect) {
            throw new Error('Verification failed: Password does not match hashed value.');
        }

        console.log(`\n========================================`);
        console.log(`🎉 SUPER ADMIN READY FOR LOGIN!`);
        console.log(`========================================`);
        console.log(`  Email:            ${verifyUser.email}`);
        console.log(`  Password:         ${password}`);
        console.log(`  Role:             ${verifyUser.role}`);
        console.log(`  isSuperAdmin:     ${verifyUser.isSuperAdmin}`);
        console.log(`  Status:           ${verifyUser.status}`);
        console.log(`  Registered ID:    ${verifyUser.registeredId}`);
        console.log(`  Admin Profile ID: ${admin._id}`);
        console.log(`  Password Check:   VERIFIED ✅`);
        console.log(`========================================\n`);

    } catch (error: any) {
        console.error(`\n❌ Failed to create/update super admin:`, error.message || error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log(`🔌 Database connection closed.`);
    }
}

makeSuperAdmin();

