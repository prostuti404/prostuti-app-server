/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { IUser } from './user.interface';
import { User } from './user.model';
import AppError from '../../classes/errorClasses/AppError';
import { StatusCodes } from 'http-status-codes';
import { Teacher } from '../teacher/teacher.model';
import { Admin } from '../admin/admin.model';
import { formattedTeacherJoiningDate } from './user.utils';
import { USER_ROLE } from './user.constant';
import { Student } from '../student/student.model';
import { runTransactionSafe } from '../../utils/runTransactionSafe';

// Create Teacher
const createTeacher = async (payload: Record<string, any>) => {
    let createdUserId: mongoose.Types.ObjectId | null = null;

    return await runTransactionSafe(
        async (session) => {
            const userEmail = payload.email?.trim().toLowerCase();
            const userPhone = payload.phone?.trim() ? payload.phone.trim() : undefined;

            const user: Partial<IUser> = {
                registeredId: `TID${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                email: userEmail,
                password: payload.password,
                role: USER_ROLE.teacher,
                ...(userPhone && { phone: userPhone }),
            };

            // Create a user in User model
            const newUser = await User.create([user], session ? { session } : {});

            if (!newUser || !newUser.length) {
                throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create user');
            }

            createdUserId = newUser[0]._id;

            // Create a teacher in Teacher model
            const teacher = {
                user_id: newUser[0]._id,
                teacherId: newUser[0].registeredId,
                email: newUser[0].email,
                ...(payload.name?.trim() && { name: payload.name.trim() }),
                ...(userPhone && { phone: userPhone }),
                ...(payload.subjects && { subjects: payload.subjects }),
                ...(payload.assignedWorks && {
                    assignedWorks: payload.assignedWorks,
                }),
                joinedDate: formattedTeacherJoiningDate(),
            };

            const newTeacher = await Teacher.create([teacher], session ? { session } : {});

            if (!newTeacher || !newTeacher.length) {
                throw new AppError(
                    StatusCodes.BAD_REQUEST,
                    'Failed to create Teacher profile',
                );
            }

            return newTeacher[0];
        },
        async () => {
            // Compensating rollback: delete the user if teacher profile creation failed
            if (createdUserId) {
                await User.findByIdAndDelete(createdUserId);
            }
        },
    );
};

// Create Admin
const createAdmin = async (payload: Record<string, any>) => {
    let createdUserId: mongoose.Types.ObjectId | null = null;

    return await runTransactionSafe(
        async (session) => {
            const userEmail = payload.email?.trim().toLowerCase();
            const userPhone = payload.phone?.trim() ? payload.phone.trim() : undefined;

            const user: Partial<IUser> = {
                registeredId: `AID${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
                email: userEmail,
                password: payload.password,
                role: USER_ROLE.admin,
                ...(userPhone && { phone: userPhone }),
            };

            // Create a user in User model
            const newUser = await User.create([user], session ? { session } : {});

            if (!newUser || !newUser.length) {
                throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create user');
            }

            createdUserId = newUser[0]._id;

            // Create an admin in Admin model
            const admin = {
                user_id: newUser[0]._id,
                adminId: newUser[0].registeredId,
                email: newUser[0].email,
                ...(payload.name?.trim() && { name: payload.name.trim() }),
                ...(userPhone && { phone: userPhone }),
            };

            const newAdmin = await Admin.create([admin], session ? { session } : {});

            if (!newAdmin || !newAdmin.length) {
                throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create Admin profile');
            }

            return newAdmin[0];
        },
        async () => {
            // Compensating rollback: delete the user if admin profile creation failed
            if (createdUserId) {
                await User.findByIdAndDelete(createdUserId);
            }
        },
    );
};

// Get me
const profile = async (userId: string, role: string) => {
    let result = null;

    if (role === USER_ROLE.student) {
        result = await Student.findOne({ user_id: userId });
    }

    if (role === USER_ROLE.teacher) {
        result = await Teacher.findOne({ user_id: userId });
    }

    if (role === USER_ROLE.admin) {
        result = await Admin.findOne({ user_id: userId });
    }

    return result;
};

export const userService = {
    createTeacher,
    createAdmin,
    profile,
};
