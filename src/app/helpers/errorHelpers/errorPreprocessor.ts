/* eslint-disable @typescript-eslint/no-explicit-any */
import { ZodError } from 'zod';
import handleZodError from './handleZodError';
import handleValidationError from './handleValidationError';
import handleCastError from './handleCastError';
import handleDuplicateKeyError from './handleDuplicateKeyError';
import AppError from '../../classes/errorClasses/AppError';
import handleAppError from './handleAppError';
import handleJWTExpiredError from './handleJWTExpiredError';
import handleUnexpectedJWTTokenError from './handleUnexpectedJWTTokenError';
import handleJsonWebTokenError from './handleJsonWebTokenError';
import handleUnknownError from './handleUnknownError';

const errorPreprocessor = (error: any) => {
    // Handle Zod Error
    if (error instanceof ZodError) {
        return handleZodError(error);
    }
    //Handle Mongoose validation Error
    else if (error.name === 'ValidationError') {
        return handleValidationError(error);
    }
    // Handle Mongoose CastError
    else if (error.name === 'CastError') {
        return handleCastError(error);
    }
    // Handle Mongoose Duplicate Key Error
    else if (error.code === 11000) {
        return handleDuplicateKeyError(error);
    }
    // Handle throw App Errors
    else if (error instanceof AppError) {
        return handleAppError(error);
    }
    // Handle JWT Token Errors
    else if (error.name === 'TokenExpiredError') {
        return handleJWTExpiredError(error);
    } else if (error.message?.startsWith('Unexpected token')) {
        return handleUnexpectedJWTTokenError(error);
    } else if (error.name === 'JsonWebTokenError') {
        return handleJsonWebTokenError(error);
    }
    // Handle Others Unknown Error
    else {
        return handleUnknownError(error);
    }
};

export default errorPreprocessor;
