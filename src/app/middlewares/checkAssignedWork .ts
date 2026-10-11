import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { StatusCodes } from 'http-status-codes';
import AppError from '../classes/errorClasses/AppError';
import { Teacher } from '../modules/teacher/teacher.model';
import { TAssignedWorks } from '../modules/teacher/teacher.interface';

const checkAssignedWork = (...requiredWorks: TAssignedWorks[]) => {
    return catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
            if (req.user?.role === 'admin') {
                return next();
            }

            const userId = req.user?.userId;

            // Fetch teacher from the database
            const teacher = await Teacher.findOne({ user_id: userId });

            // Check if teacher exists
            if (!teacher) {
                throw new AppError(StatusCodes.NOT_FOUND, 'Teacher not found');
            }

            // Check if the teacher has required assigned works
            const hasRequiredWork = requiredWorks.every((work) =>
                teacher.assignedWorks.includes(work),
            );

            if (!hasRequiredWork) {
                throw new AppError(
                    StatusCodes.FORBIDDEN,
                    'You do not have permission to perform this action',
                );
            }

            next();
        },
    );
};

export default checkAssignedWork;
