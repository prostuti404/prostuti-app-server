import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { authController } from './auth.controller';
import { authValidator } from './auth.validation';
import auth from '../../middlewares/auth';

const router = express.Router();

router
    .get(
        '/registration-categories',
        authController.getRegistrationCategories,
    )
    .post(
        '/register-student',
        validateRequest(authValidator.registerStudentValidationSchema),
        authController.registerStudent,
    )
    .post(
        '/login',
        validateRequest(authValidator.loginUserSchema),
        authController.loginUser,
    )
    .post(
        '/refresh-token',
        validateRequest(authValidator.teacherAdminRefreshTokenValidationSchema),
        authController.getTeacherAdminRefreshToken,
    )
    .post(
        '/student/refresh-token',
        validateRequest(authValidator.studentRefreshTokenValidationSchema),
        authController.getStudentRefreshToken,
    )
    .post(
        '/student/reset-password',
        validateRequest(authValidator.studentResetPasswordValidationSchema),
        authController.resetStudentPassword,
    )
    .post(
        '/change-password',
        auth(),
        validateRequest(authValidator.changePasswordValidationSchema),
        authController.changeUserPassword,
    );

export const authRoute = router;
