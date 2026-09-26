import { Router } from 'express';
import { debugController } from './debug.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';

const router = Router();

// Test endpoint to trigger socket events for a student
router.post('/trigger-socket', auth(USER_ROLE.student), debugController.triggerSocketEvent);

export const debugRoutes = router;
