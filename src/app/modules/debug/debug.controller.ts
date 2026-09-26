import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendSuccessResponse from '../../utils/sendSuccessResponse';
import { socketHandler } from '../../../server';
import AppError from '../../classes/errorClasses/AppError';

const triggerSocketEvent = catchAsync(async (req: Request, res: Response) => {
    const { userId, role } = req.user;

    if (role !== 'student') {
        throw new AppError(StatusCodes.FORBIDDEN, 'Only students can trigger this test');
    }

    // Trigger COURSE_ENROLLED
    socketHandler.emitCourseEnrolledNotification(
        { user_id: userId },
        { name: 'Dummy Course 101' }
    );

    // Trigger COURSE_NOTICE_NOTIFICATION
    socketHandler.emitCourseNoticeNotification(
        { user_id: userId },
        'Test Notice Title',
        'This is a dummy test notice sent directly to your active connection.'
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Socket events triggered successfully!',
        data: null,
    });
});

export const debugController = {
    triggerSocketEvent,
};
