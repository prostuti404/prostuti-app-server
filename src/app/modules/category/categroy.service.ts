import { StatusCodes } from 'http-status-codes';
import { SortOrder } from 'mongoose';
import AppError from '../../classes/errorClasses/AppError';
import { calculatePagination } from '../../helpers/pagenationHelper';
import { IPaginationOptions } from '../../interfaces/common';
import { TJWTDecodedUser } from '../../interfaces/jwt/jwt.type';
import { categorySearchableFields } from './category.constant';
import { ICategory, ICategoryFilters } from './category.interface';
import { Category } from './category.model';

const createCategory = async (
    userInfo: TJWTDecodedUser,
    payload: Partial<ICategory>,
): Promise<any> => {
    const data = await Category.create(payload);
    return data;
};

const getAllCategories = async (
    filters: ICategoryFilters,
    paginationOptions: IPaginationOptions,
    userInfo: TJWTDecodedUser,
): Promise<{ meta: any; data: any[] }> => {
    const { searchTerm, ...filtersData } = filters;

    const { page, limit, skip, sortBy, sortOrder } =
        calculatePagination(paginationOptions);

    const andConditions = [];

    if (searchTerm) {
        andConditions.push({
            $or: categorySearchableFields.map((field) => ({
                [field]: {
                    $regex: searchTerm,
                    $options: 'i',
                },
            })),
        });
    }

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

    const count = await Category.countDocuments(whereConditions);
    const result = await Category.find(whereConditions)
        .sort(sortConditions)
        .skip(skip)
        .limit(limit);

    return {
        meta: {
            page,
            limit: limit === 0 ? count : limit,
            count,
        },
        data: result,
    };
};

const getCategoryByID = async (
    id: string,
    userInfo: TJWTDecodedUser,
): Promise<any> => {
    const data = await Category.findById(id);
    if (!data) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Category not found.');
    }

    return data;
};

const updateCategory = async (
    id: string,
    userInfo: TJWTDecodedUser,
    payload: Partial<ICategory>,
): Promise<any> => {
    const category = await Category.findById(id);
    if (!category) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Category not found.');
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return updatedCategory;
};

const deleteCategoryByID = async (
    id: string,
    userInfo: TJWTDecodedUser,
): Promise<any> => {
    const data = await Category.findByIdAndDelete(id);
    if (!data) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Category not found.');
    }

    return data;
};

const getCategoryHierarchy = async (): Promise<any> => {
    const result = await Category.aggregate([
        {
            $group: {
                _id: { group: '$group', type: '$type' },
                categories: { $push: { name: '$name', _id: '$_id' } },
            },
        },
        {
            $group: {
                _id: '$_id.group',
                types: {
                    $push: {
                        type: '$_id.type',
                        categories: '$categories',
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                group: '$_id',
                types: 1,
            },
        },
    ]);

    return result;
};

export const CategoryService = {
    createCategory,
    getAllCategories,
    getCategoryByID,
    updateCategory,
    deleteCategoryByID,
    getCategoryHierarchy,
};
