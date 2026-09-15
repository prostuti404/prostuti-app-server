import { StatusCodes } from 'http-status-codes';
import mongoose, { SortOrder } from 'mongoose';
import AppError from '../../../classes/errorClasses/AppError';
import { calculatePagination } from '../../../helpers/pagenationHelper';
import { IPaginationOptions } from '../../../interfaces/common';
import { TJWTDecodedUser } from '../../../interfaces/jwt/jwt.type';
import { User } from '../../user/user.model';
import { Routine } from './rouitine.model';
import { RoutineSearchableFields } from './routine.constant';
import { IRoutine, IRoutineFilters } from './routine.interface';

const createRoutine = async (
    userInfo: TJWTDecodedUser,
    payload: Partial<IRoutine>,
): Promise<any> => {
    //  // Check if the course exists
    //  const courseExists = await Course.findById(payload.course_id);

    //  if (!courseExists) {
    //      throw new Error('Course does not exist');
    //  }

    let routineDate = payload.date ? new Date(payload.date) : undefined;

    // Set the time to 23:59:59.999 (last millisecond of the day)
    if (routineDate) {
        routineDate.setHours(23, 59, 59, 999);
    }
    const newRoutine = new Routine({
        course_id: payload.course_id,
        type: payload.type,
        date: routineDate,
        createdBy: userInfo.userId,
    });
    const data = await newRoutine.save();
    if (!data) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Creation Failed');
    }
    return data;
};

const getAllRoutines = async (
    filters: IRoutineFilters,
    paginationOptions: IPaginationOptions,
    userInfo: TJWTDecodedUser,
): Promise<any> => {
    const { searchTerm, ownRoutine, date, isPublished, ...filtersData } = filters;
    const { page, limit, skip, sortBy, sortOrder } =
        calculatePagination(paginationOptions);

    const andConditions = [];
    if (searchTerm) {
        andConditions.push({
            $or: RoutineSearchableFields.map((field) => ({
                [field]: {
                    $regex: searchTerm,
                    $options: 'i',
                },
            })),
        });
    }
    //only returns the routine that is created by the requested user
    if (ownRoutine === 'true') {
        andConditions.push({
            createdBy: new mongoose.Types.ObjectId(userInfo.userId),
        });
    }

    //only return the routine those will be featured that date
    if (date) {
        const checkDate = new Date(date);
        if (isNaN(checkDate.getTime())) {
            throw new AppError(
                StatusCodes.NOT_ACCEPTABLE,
                'Invalid date format!!!',
            );
        }
        checkDate.setHours(0, 0, 0, 0);

        andConditions.push({
            date: {
                $gte: checkDate,
                $lt: new Date(
                    checkDate.getFullYear(),
                    checkDate.getMonth(),
                    checkDate.getDate() + 1,
                ),
            },
        });
    }

    // Handle isPublished explicitly for legacy records
    if (isPublished !== undefined) {
        if (isPublished === 'true' || isPublished === true) {
            andConditions.push({ isPublished: true });
        } else if (isPublished === 'false' || isPublished === false) {
            andConditions.push({
                $or: [{ isPublished: false }, { isPublished: { $exists: false } }],
            });
        }
    }
    // filtering data
    if (Object.keys(filtersData).length) {
        andConditions.push({
            $and: Object.entries(filtersData).map(([field, value]) => ({
                [field]: value,
            })),
        });
    }

    const sortConditions: { [key: string]: SortOrder } = {};

    if (sortBy && sortOrder) {
        sortConditions[sortBy] = sortOrder;
    }

    const whereConditions =
        andConditions.length > 0 ? { $and: andConditions } : {};

    const count = await Routine.countDocuments(whereConditions);
    const result = await Routine.find(whereConditions)
        .sort(sortConditions)
        .skip(skip)
        .limit(limit)
        .populate({
            path: 'course_id',
        });

    // Map data to ensure isPublished is explicitly returned as boolean
    const formattedResult = result.map((doc: any) => {
        const obj = doc.toObject ? doc.toObject() : doc;
        return {
            ...obj,
            isPublished: obj.isPublished ?? false,
        };
    });

    return {
        meta: {
            page,
            limit: limit === 0 ? count : limit,
            count,
        },
        data: formattedResult,
    };
};

const getRoutineByID = async (id: string): Promise<any> => {
    const data = await Routine.findById(id);
    if (!data) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Not found.');
    }

    return data;
};

const publishRoutine = async (
    id: string,
    isPublished: boolean,
    userInfo: TJWTDecodedUser,
): Promise<any> => {
    const checkRoutine = await Routine.findById(id);
    if (!checkRoutine) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Routine not found.');
    }
    if (checkRoutine.createdBy.toString() !== userInfo.userId) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not allowed to update this routine.');
    }
    const data = await Routine.findByIdAndUpdate(
        id,
        { isPublished, updatedBy: userInfo.userId },
        { new: true },
    );
    if (!data) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Update failed.');
    }
    return data;
};

const deleteRoutineByID = async (
    id: string,
    userInfo: TJWTDecodedUser,
): Promise<any> => {
    const checkUser = await User.findById(userInfo.userId);
    if (!checkUser) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Something went wrong');
    }
    const checkRoutine = await Routine.findById(id);
    if (!checkRoutine) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Not found.');
    }
    if (checkUser._id.toString() !== checkRoutine.createdBy.toString()) {
        throw new AppError(
            StatusCodes.UNAUTHORIZED,
            'You can not delete the routine',
        );
    }
    const data = await Routine.findByIdAndDelete(id);
    if (!data) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Delete Failed');
    }

    return data;
};

export const RoutineService = {
    createRoutine,
    getAllRoutines,
    getRoutineByID,
    publishRoutine,
    deleteRoutineByID,
};
