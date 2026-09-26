/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser } from '../user/user.interface';
import { User } from '../user/user.model';
import AppError from '../../classes/errorClasses/AppError';
import { StatusCodes } from 'http-status-codes';
import { Student } from '../student/student.model';
import { ILoginStudent } from './auth.interface';
import { USER_ROLE, USER_STATUS } from '../user/user.constant';
import config from '../../config';
import { jwtHelpers } from '../../helpers/jwtHelpers/jwtHelpers';
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';
import { PhoneVerification } from '../phoneVerification/phoneVerification.model';
import { PHONE_VERIFICATION_TYPE } from '../phoneVerification/phoneVerification.constant';
import { convertJWTExpireTimeToSeconds } from './auth.utils';

import { TJWTDecodedUser } from '../../interfaces/jwt/jwt.type';
import { MainCategory } from './category/category.constant';

// Register Student
const registerStudent = async (
    otpCode: string,
    name: string,
    email: string,
    phone: string,
    password: string,
    categoryType: string,
    subCategory?: string, // Add subCategory parameter
) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // Check if the phone number is verified
        const verifiedPhone = await PhoneVerification.findOne({
            phoneNumber: formatPhoneNumber(phone),
            phoneVerificationType: PHONE_VERIFICATION_TYPE.ACCOUNT_CREATION,
            verified: true,
            otpCode,
        });

        if (!verifiedPhone) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                'Invalid OTP or phone number',
            );
        }

        // Delete verified phone number
        await PhoneVerification.findOneAndDelete({
            phoneNumber: formatPhoneNumber(phone),
            phoneVerificationType: PHONE_VERIFICATION_TYPE.ACCOUNT_CREATION,
            verified: true,
            otpCode,
        });

        const user: Partial<IUser> = {
            registeredId: `SID${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            password,
            phone,
            role: USER_ROLE.student,
        };

        if (email && email.trim() !== '') {
            user.email = email;
        }

        // Crate a user to User model (Transaction 1)
        const newUser = await User.create([user], { session });

        if (!newUser.length) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Fail to create user');
        }

        // Create the category object based on categoryType
        const categoryObj: any = {
            mainCategory: categoryType,
        };

        // If category is not Job and subCategory is provided, add it to the category object
        if (categoryType !== MainCategory.JOB && subCategory) {
            categoryObj.subCategory = subCategory;
        }

        // Create a student to Student model (Transaction 2) - with categoryType and category
        const student = {
            user_id: newUser[0]._id,
            studentId: newUser[0].registeredId,
            name: name,
            email: newUser[0].email,
            phone: newUser[0].phone,
            categoryType: categoryType,
            category: categoryObj,
            subscriptionStartDate: null,
            subscriptionEndDate: null,
        };

        const newStudent = await Student.create([student], { session });

        if (!newStudent.length) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                'Fail to create student',
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

// Login User (student, teacher and admin)
const loginUser = async (payload: ILoginStudent) => {
    const { rememberMe, email, phone, password } = payload;

    let query = {};
    if (email) {
        query = { email };
    } else {
        query = {
            $or: [
                { phone: formatPhoneNumber(phone) },
                { phone: phone }
            ]
        };
    }

    const user = await User.findOne(query).select('+password');

    // Check if the user exist in database
    if (!user) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User is not found');
    }

    // Check if the user is already deleted
    if (user.isDeleted) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is deleted');
    }

    // Check if the user is blocked
    if (user.status === USER_STATUS.blocked) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is blocked');
    }

    // Check Password is correct
    if (!(await User.isPasswordMatched(password, user.password))) {
        throw new AppError(StatusCodes.FORBIDDEN, 'Invalid password');
    }

    // Access Granted: Send Access Token

    // For student
    if (user.role === USER_ROLE.student) {
        const jwtPayload = { userId: user._id, role: user.role, isSuperAdmin: user.isSuperAdmin };

        const accessTokenExpiresIn = convertJWTExpireTimeToSeconds(
            config.jwt_student_access_token_expires_in,
        );
        const refreshTokenExpiresIn = convertJWTExpireTimeToSeconds(
            rememberMe
                ? rememberMe
                : config.jwt_student_refresh_token_expires_in,
        );

        const accessToken = jwtHelpers.createToken(
            jwtPayload,
            config.jwt_access_token_secret,
            config.jwt_student_access_token_expires_in,
        );

        const refreshToken = jwtHelpers.createToken(
            jwtPayload,
            config.jwt_refresh_token_secret,
            rememberMe
                ? rememberMe
                : config.jwt_student_refresh_token_expires_in,
        );

        return {
            accessToken,
            accessTokenExpiresIn,
            refreshToken,
            refreshTokenExpiresIn,
            isStudent: true,
        };
    }
    // For teacher and admin
    else {
        const jwtPayload = { userId: user._id, role: user.role, isSuperAdmin: user.isSuperAdmin };
        const refreshTokenExpiresIn = convertJWTExpireTimeToSeconds(
            config.jwt_refresh_token_expired_in,
        );

        const accessToken = jwtHelpers.createToken(
            jwtPayload,
            config.jwt_access_token_secret,
            rememberMe ? rememberMe : config.jwt_access_token_expired_in,
        );

        const refreshToken = jwtHelpers.createToken(
            jwtPayload,
            config.jwt_refresh_token_secret,
            rememberMe ? rememberMe : config.jwt_refresh_token_expired_in,
        );

        return {
            accessToken,
            refreshToken,
            refreshTokenExpiresIn,
            isStudent: false,
        };
    }
};

// Get refresh and access token for student
const getStudentRefreshToken = async (token: string) => {
    // Check if the given token is valid
    const decoded = jwtHelpers.verifyToken(
        token,
        config.jwt_refresh_token_secret,
    );

    const { userId, iat, exp } = decoded;

    // Check if the user is exist
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User not found!');
    }

    // Check the role
    if (user.role !== USER_ROLE.student) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized!');
    }

    // Check if the user is already deleted
    if (user?.isDeleted) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is deleted!');
    }

    // Check if the user is blocked
    if (user?.status === USER_STATUS.blocked) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is blocked!');
    }

    // Is JWT issued before password changed
    if (
        user.passwordChangedAt &&
        User.isJWTIssuedBeforePasswordChanged(
            user.passwordChangedAt,
            iat as number,
        )
    ) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized!');
    }

    const jwtPayload = { userId: user._id, role: user.role, isSuperAdmin: user.isSuperAdmin };

    const accessTokenExpiresIn = convertJWTExpireTimeToSeconds(
        config.jwt_student_access_token_expires_in,
    );

    const accessToken = jwtHelpers.createToken(
        jwtPayload,
        config.jwt_access_token_secret,
        config.jwt_student_access_token_expires_in,
    );

    // Check if the decoded refresh token's expiration matches the default refresh token expiration
    const defaultRefreshTokenExpiresIn = convertJWTExpireTimeToSeconds(
        config.jwt_student_refresh_token_expires_in,
    );
    const tokenExpiresIn = exp - iat;

    if (tokenExpiresIn === defaultRefreshTokenExpiresIn) {
        const refreshToken = jwtHelpers.createToken(
            jwtPayload,
            config.jwt_refresh_token_secret,
            config.jwt_student_refresh_token_expires_in,
        );

        return {
            accessToken,
            accessTokenExpiresIn,
            refreshToken,
            refreshTokenExpiresIn: defaultRefreshTokenExpiresIn,
        };
    } else {
        return {
            accessToken,
            accessTokenExpiresIn,
        };
    }
};

// Get refresh token for teacher admin
const getTeacherAdminRefreshToken = async (token: string) => {
    // Check if the given token is valid
    const decoded = jwtHelpers.verifyToken(
        token,
        config.jwt_refresh_token_secret,
    );

    const { userId, role, iat } = decoded;

    // Check if the user is exist
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User not found!');
    }

    // Check the role
    if (user.role !== role) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized!');
    }
    // Check the role
    if (user.role === USER_ROLE.student) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized!');
    }

    // Check if the user is already deleted
    if (user?.isDeleted) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is deleted!');
    }

    // Check if the user is blocked
    if (user?.status === USER_STATUS.blocked) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is blocked!');
    }

    // Is JWT issued before password changed
    if (
        user.passwordChangedAt &&
        User.isJWTIssuedBeforePasswordChanged(
            user.passwordChangedAt,
            iat as number,
        )
    ) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized!');
    }

    // Create access token for teacher admin
    const jwtPayload = { userId: user._id, role: user.role, isSuperAdmin: user.isSuperAdmin };
    const accessToken = jwtHelpers.createToken(
        jwtPayload,
        config.jwt_access_token_secret,
        config.jwt_access_token_expired_in,
    );

    return {
        accessToken,
    };
};

// Forget student password and Reset password
const resetStudentPassword = async (
    otpCode: string,
    phone: string,
    newPassword: string,
) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // Check if the phone number is verified
        const verifiedPhone = await PhoneVerification.findOne({
            phoneNumber: formatPhoneNumber(phone),
            phoneVerificationType: PHONE_VERIFICATION_TYPE.PASSWORD_RESET,
            verified: true,
            otpCode,
        });

        if (!verifiedPhone) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                'Invalid OTP or phone number',
            );
        }

        // Delete the verified number
        await PhoneVerification.findOneAndDelete({
            phoneNumber: formatPhoneNumber(phone),
            phoneVerificationType: PHONE_VERIFICATION_TYPE.PASSWORD_RESET,
            verified: true,
            otpCode,
        });
        // Check if the user is exist
        const user = await User.findOne({
            $or: [
                { phone: formatPhoneNumber(phone) },
                { phone: phone }
            ]
        });

        if (!user) {
            throw new AppError(StatusCodes.NOT_FOUND, 'User not found!');
        }

        // Check the role
        if (user.role !== USER_ROLE.student) {
            throw new AppError(
                StatusCodes.UNAUTHORIZED,
                'You are not authorized!',
            );
        }

        // Check if the user is already deleted
        if (user?.isDeleted) {
            throw new AppError(StatusCodes.FORBIDDEN, 'User is deleted!');
        }

        // Check if the user is blocked
        if (user?.status === USER_STATUS.blocked) {
            throw new AppError(StatusCodes.FORBIDDEN, 'User is blocked!');
        }

        // Update The password
        const newHashedPassword = await bcrypt.hash(
            newPassword,
            Number(config.bcrypt_salt),
        );

        await User.findOneAndUpdate(
            {
                phone: user.phone,
                role: user.role,
            },
            {
                password: newHashedPassword,
            },
        );

        await session.commitTransaction();
        session.endSession();
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }

    return null;
};

// Change password
const changeUserPassword = async (
    user: TJWTDecodedUser,
    payload: { oldPassword: string; newPassword: string },
) => {
    const userData = await User.findById(user.userId).select('password');

    // Check if the user exist in database
    if (!userData) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User is not found');
    }

    // Check if the user is already deleted
    if (userData.isDeleted) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is deleted');
    }

    // Check if the user is blocked
    if (userData.status === USER_STATUS.blocked) {
        throw new AppError(StatusCodes.FORBIDDEN, 'User is blocked');
    }

    // Check the old Password is correct
    if (
        !(await User.isPasswordMatched(payload.oldPassword, userData.password))
    ) {
        throw new AppError(StatusCodes.FORBIDDEN, 'Invalid old password');
    }

    // // Update the password
    const newHashedPassword = await bcrypt.hash(
        payload.newPassword,
        Number(config.bcrypt_salt),
    );

    await User.findByIdAndUpdate(
        {
            _id: userData._id,
            role: userData.role,
        },
        {
            password: newHashedPassword,
            passwordChangedAt: new Date(),
        },
    );

    return null;
};

export const authService = {
    registerStudent,
    loginUser,
    getStudentRefreshToken,
    getTeacherAdminRefreshToken,
    resetStudentPassword,
    changeUserPassword,
};
