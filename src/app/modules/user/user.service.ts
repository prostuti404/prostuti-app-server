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

// Create Teacher
const createTeacher = async (payload: Record<string, any>) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user: Partial<IUser> = {
            registeredId: `TID${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            email: payload.email,
            password: payload.password,
            role: 'teacher',
        };

        // Crate a user to User model (Transaction 1)
        const newUser = await User.create([user], { session });

        if (!newUser.length) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Fail to create user');
        }

        // Create a teacher to Teacher model (Transaction 2)
        const teacher = {
            user_id: newUser[0]._id,
            teacherId: newUser[0].registeredId,
            email: newUser[0].email,
            ...(payload.name && { name: payload.name }),
            ...(payload.subjects && { subjects: payload.subjects }),
            ...(payload.assignedWorks && {
                assignedWorks: payload.assignedWorks,
            }),
            joinedDate: formattedTeacherJoiningDate(),
        };

        const newTeacher = await Teacher.create([teacher], { session });

        if (!newTeacher.length) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                'Fail to create Teacher',
            );
        }

        await session.commitTransaction();
        await session.endSession();
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();

        throw error;
    }

    return null;
};

// Create Admin
const createAdmin = async (payload: Record<string, any>) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user: Partial<IUser> = {
            registeredId: `AID${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            email: payload.email,
            password: payload.password,
            role: 'admin',
        };

        // Crate a user to User model (Transaction 1)
        const newUser = await User.create([user], { session });

        if (!newUser.length) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Fail to create user');
        }

        // Create a teacher to Teacher model (Transaction 2)
        const admin = {
            user_id: newUser[0]._id,
            adminId: newUser[0].registeredId,
            email: newUser[0].email,
            ...(payload.name && { name: payload.name }),
            ...(payload.phone && { phone: payload.phone }),
        };

        const newAdmin = await Admin.create([admin], { session });

        if (!newAdmin.length) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Fail to create Admin');
        }

        await session.commitTransaction();
        await session.endSession();
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();

        throw error;
    }

    return null;
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
