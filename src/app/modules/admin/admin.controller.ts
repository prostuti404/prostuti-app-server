import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendSuccessResponse from "../../utils/sendSuccessResponse";
import { adminService } from "./admin.service";

const deleteCourse = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const result = await adminService.deleteCourseFromDB(courseId);

    sendSuccessResponse(res,
        {
            statusCode: StatusCodes.OK,
            message: 'Course deleted successfully',
            data: result,
        });
});

const deleteStudent = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const result = await adminService.deleteStudentFromDB(userId);

    sendSuccessResponse(res,
        {
            statusCode: StatusCodes.OK,
            message: 'Student deleted successfully',
            data: result,
        });

})
const getAllAdmins = catchAsync(async (req, res) => {
    const result = await adminService.getAllAdmins();
    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Admins retrieved successfully',
        data: result,
    });
});

const deleteAdmin = catchAsync(async (req, res) => {
    const { adminId } = req.params;
    const result = await adminService.deleteAdmin(adminId);
    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Admin deleted successfully',
        data: result,
    });
});

export const adminController = {
    deleteCourse,
    deleteStudent,
    getAllAdmins,
    deleteAdmin
}