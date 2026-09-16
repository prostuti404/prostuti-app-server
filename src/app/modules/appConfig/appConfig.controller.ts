import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendSuccessResponse from '../../utils/sendSuccessResponse';
import { appConfigService } from './appConfig.service';
import { jwtHelpers } from '../../helpers/jwtHelpers/jwtHelpers';
import config from '../../config';
import { Student } from '../student/student.model';

const getAppConfig = catchAsync(async (req: Request, res: Response) => {
    let result = await appConfigService.getAppConfig();
    let responseData: any = result ? result.toObject() : {};

    // Map legacy freeAccessFeatures strings to ENUM style if necessary
    if (responseData.freeAccessFeatures && Array.isArray(responseData.freeAccessFeatures)) {
        responseData.freeAccessFeatures = responseData.freeAccessFeatures.map((f: string) => 
            f === 'Mock Tests' ? 'MOCK_TEST' :
            f === 'Live Classes' ? 'LIVE_CLASS' :
            f === 'Recorded Videos' ? 'RECORDED_VIDEO' : f
        );
    }

    // Check for authorization header to append student-specific data
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            if (token) {
                const decoded = jwtHelpers.verifyToken(token, config.jwt_access_token_secret as string);
                
                if (decoded && decoded.role === 'student') {
                    const student = await Student.findOne({ user_id: decoded.userId });
                    if (student) {
                        const trialStartDate = student.trialStartDate || new Date(); // Fallback if missing
                        const freeTrialDays = responseData.freeTrialDays || 7;
                        
                        const trialEndDate = new Date(trialStartDate.getTime() + freeTrialDays * 24 * 60 * 60 * 1000);
                        const currentDate = new Date();
                        
                        const isTrialActive = currentDate <= trialEndDate;
                        const trialDaysLeft = isTrialActive 
                            ? Math.ceil((trialEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                            
                        responseData = {
                            ...responseData,
                            isTrialActive,
                            trialDaysLeft,
                            mockTestsUsed: student.mockTestsUsed || 0,
                            liveClassesUsed: student.liveClassesUsed || 0,
                        };
                    }
                }
            }
        } catch (err) {
            // If token is invalid or expired, just ignore and return standard config
            console.error('Error decoding token in config route:', err);
        }
    }

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'App configuration retrieved successfully',
        data: responseData,
    });
});

const updateAppConfig = catchAsync(async (req: Request, res: Response) => {
    const result = await appConfigService.updateAppConfig(req.body);

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'App configuration updated successfully',
        data: result,
    });
});

export const appConfigController = {
    getAppConfig,
    updateAppConfig,
};
