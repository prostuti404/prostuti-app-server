import { TUserRole } from '../../modules/user/user.interface';
import { Types } from 'mongoose';

export type TJWTDecodedUser = {
    userId: string;
    email: string;
    role: TUserRole;
    iat: number;
    exp: number;
    isSuperAdmin?: boolean;
};

export type TJWTPayload = {
    userId: Types.ObjectId;
    email?: string;
    role: TUserRole;
    isSuperAdmin?: boolean;
};
