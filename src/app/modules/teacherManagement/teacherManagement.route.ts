import express from 'express';
import { teacherManagementController } from './teacherManagement.controller';
import auth from '../../middlewares/auth';
import superAdmin from '../../middlewares/superAdmin';
import { USER_ROLE } from '../user/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { teacherManagementValidator } from './teacherManagement.validation';

const router = express.Router();

router
    .get('/', auth(USER_ROLE.admin), teacherManagementController.getAllTeacher)
    .get(
        '/:teacherId',
        auth(USER_ROLE.admin),
        teacherManagementController.getTeacherInformation,
    )
    .patch(
        '/assigned-works',
        auth(USER_ROLE.admin),
        validateRequest(
            teacherManagementValidator.updateTeacherAssignedWorksValidationSchema,
        ),
        teacherManagementController.updateTeacherAssignedWorks,
    )
    .delete(
        '/:teacherId',
        auth(USER_ROLE.admin),
        superAdmin,
        teacherManagementController.deleteTeacher,
    );

export const teacherManagementRoute = router;
