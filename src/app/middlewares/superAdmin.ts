import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { StatusCodes } from 'http-status-codes';
import AppError from '../classes/errorClasses/AppError';
import { User } from '../modules/user/user.model';

const superAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User is not found');
    }

    if (!user.isSuperAdmin) {
        throw new AppError(StatusCodes.FORBIDDEN, 'You are not authorized! Only Super Admin can perform this action.');
    }

    next();
});

export default superAdmin;
