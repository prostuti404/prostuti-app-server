import express from 'express';
import { userController } from './user.controller';
import validateRequest from '../../middlewares/validateRequest';
import { userValidator } from './user.validation';
import auth from '../../middlewares/auth';
import superAdmin from '../../middlewares/superAdmin';
import { USER_ROLE } from './user.constant';

const router = express.Router();

router
    .get('/profile', auth(), userController.profile)
    .post(
        '/create-teacher',
        auth(USER_ROLE.admin),
        superAdmin,
        validateRequest(userValidator.createTeacherValidationSchema),
        userController.createTeacher,
    )
    .post(
        '/create-admin',
        auth(USER_ROLE.admin),
        superAdmin,
        validateRequest(userValidator.createTeacherAdminValidationSchema),
        userController.createAdmin,
    );

export const userRoute = router;
