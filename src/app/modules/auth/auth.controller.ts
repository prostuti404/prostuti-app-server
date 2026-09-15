import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendSuccessResponse from '../../utils/sendSuccessResponse';
import { authService } from './auth.service';
import { Request, Response } from 'express';
import config from '../../config';
import { mainCategories, getValidSubCategories } from './category/category.constant';

const registerStudent = catchAsync(async (req: Request, res: Response) => {
    const { otpCode, name, email, phone, password, categoryType, subCategory } = req.body;
    // Add subCategory to destructuring

    const result = await authService.registerStudent(
        otpCode,
        name,
        email,
        phone,
        password,
        categoryType,
        subCategory, // Pass subCategory to service
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Students registered successfully',
        data: result,
    });
});

// Login User (student, teacher and admin)
const loginUser = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.loginUser(req.body);

    if (!result.isStudent && result.refreshToken) {
        // For web (admin/teacher), set refresh token as HTTP-only cookie

        const maxAge = result.refreshTokenExpiresIn
            ? result.refreshTokenExpiresIn * 1000 // convert to milliseconds
            : Number(config.refresh_token_default_cookie_age); // default to 7 days if undefined

        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            maxAge,
        });

        // Only send access token in response for web
        sendSuccessResponse(res, {
            statusCode: StatusCodes.OK,
            message: 'User login successfully',
            data: {
                accessToken: result.accessToken,
            },
        });
    } else {
        // For mobile (student) or non-web admin/teacher, send both tokens
        sendSuccessResponse(res, {
            statusCode: StatusCodes.OK,
            message: 'User login successfully',
            data: {
                accessToken: result.accessToken,
                accessTokenExpiresIn: result.accessTokenExpiresIn,
                refreshToken: result.refreshToken,
                refreshTokenExpiresIn: result.refreshTokenExpiresIn,
            },
        });
    }
});

// Get refresh token for student
const getStudentRefreshToken = catchAsync(
    async (req: Request, res: Response) => {
        const { refreshToken } = req.body;

        const result = await authService.getStudentRefreshToken(refreshToken);

        sendSuccessResponse(res, {
            statusCode: StatusCodes.OK,
            message: 'Access token and refresh token retrieved successfully',
            data: {
                accessToken: result.accessToken,
                accessTokenExpiresIn: result.accessTokenExpiresIn,
                refreshToken: result.refreshToken,
                refreshTokenExpiresIn: result.refreshTokenExpiresIn,
            },
        });
    },
);

// Get refresh token for teacher admin
const getTeacherAdminRefreshToken = catchAsync(
    async (req: Request, res: Response) => {
        const { refreshToken } = req.cookies;

        const result =
            await authService.getTeacherAdminRefreshToken(refreshToken);

        sendSuccessResponse(res, {
            statusCode: StatusCodes.OK,
            message: 'Access token retrieved successfully',
            data: {
                accessToken: result.accessToken,
            },
        });
    },
);

// Get refresh token for teacher admin
const resetStudentPassword = catchAsync(async (req: Request, res: Response) => {
    const { otpCode, phone, newPassword } = req.body;

    const result = await authService.resetStudentPassword(
        otpCode,
        phone,
        newPassword,
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Password reset successfully',
        data: result,
    });
});

// Change password
const changeUserPassword = catchAsync(async (req, res) => {
    const result = await authService.changeUserPassword(req.user, req.body);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Password changed successfully',
        data: result,
    });
});

const getRegistrationCategories = catchAsync(async (req: Request, res: Response) => {
    const data = mainCategories.map((mainCategory) => {
        return {
            mainCategory,
            subCategories: getValidSubCategories(mainCategory as any),
        };
    });

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Registration categories retrieved successfully',
        data,
    });
});

export const authController = {
    registerStudent,
    loginUser,
    getStudentRefreshToken,
    getTeacherAdminRefreshToken,
    resetStudentPassword,
    changeUserPassword,
    getRegistrationCategories,
};
