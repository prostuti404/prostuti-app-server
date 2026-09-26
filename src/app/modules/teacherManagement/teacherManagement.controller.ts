import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendSuccessResponse from '../../utils/sendSuccessResponse';
import { teacherManagementService } from './teacherManagement.service';

// Get All Teachers
const getAllTeacher = catchAsync(async (req: Request, res: Response) => {
    const result = await teacherManagementService.getAllTeacher(req.query);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'All teachers retrieved successfully',
        data: result,
    });
});

// Get A Teacher Information
const getTeacherInformation = catchAsync(
    async (req: Request, res: Response) => {
        const { teacherId } = req.params;

        const result =
            await teacherManagementService.getTeacherInformation(teacherId);

        sendSuccessResponse(res, {
            statusCode: StatusCodes.OK,
            message: 'Teacher information retrieved successfully',
            data: result,
        });
    },
);

//  Update Teacher Assigned Works
const updateTeacherAssignedWorks = catchAsync(
    async (req: Request, res: Response) => {
        const result =
            await teacherManagementService.updateTeacherAssignedWorks(req.body);

        sendSuccessResponse(res, {
            statusCode: StatusCodes.OK,
            message: 'Teacher assigned works updated successfully',
            data: result,
        });
    },
);

const deleteTeacher = catchAsync(async (req: Request, res: Response) => {
    const { teacherId } = req.params;
    const result = await teacherManagementService.deleteTeacher(teacherId);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Teacher deleted successfully',
        data: result,
    });
});

export const teacherManagementController = {
    getAllTeacher,
    getTeacherInformation,
    updateTeacherAssignedWorks,
    deleteTeacher
};
