/* eslint-disable no-unused-vars */

import { Model } from 'mongoose';
import { USER_ROLE, USER_STATUS } from './user.constant';

export type TUserRole = keyof typeof USER_ROLE;
export type TUserStatus = keyof typeof USER_STATUS;

export interface IUser {
    registeredId: string;
    password: string;
    phone: string;
    email: string;
    passwordChangedAt: Date;
    isDeleted: boolean;
    status: TUserStatus;
    role: TUserRole;
    isSuperAdmin?: boolean;
}

export interface IUserModel extends Model<IUser> {
    isPasswordMatched(
        passwordFromReq: string,
        passwordInDB: string,
    ): Promise<boolean>;
    isJWTIssuedBeforePasswordChanged(
        passwordChangedTimeStamp: Date,
        jwtIssuedTimeStamp: number,
    ): boolean;
}
