import { StatusCodes } from 'http-status-codes';
import { IErrorResponse, TErrorSources } from '../../utils/sendErrorResponse';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleUnknownError = (error: any): IErrorResponse => {
    const message = error?.message || 'Internal server error';
    const errorSources: TErrorSources = [{ path: '', message }];

    return {
        statusCode: error?.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        message,
        errorSources,
    };
};

export default handleUnknownError;
