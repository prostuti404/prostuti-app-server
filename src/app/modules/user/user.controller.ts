import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendSuccessResponse from '../../utils/sendSuccessResponse';
import { userService } from './user.service';

const createTeacher = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.createTeacher(req.body);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Teacher is created successfully',
        data: result,
    });
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.createAdmin(req.body);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Admin is created successfully',
        data: result,
    });
});

const profile = catchAsync(async (req, res) => {
    const { userId, role } = req.user;

    const result = await userService.profile(userId, role);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'User profile is retrieved successfully',
        data: result,
    });
});

export const userController = {
    createTeacher,
    createAdmin,
    profile,
};
