import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendSuccessResponse from '../../utils/sendSuccessResponse';
import { CategoryService } from './categroy.service';
import pick from '../../helpers/pick';
import { paginationFields } from '../../constant';
import { categoryFilterableFields } from './category.constant';
import { TJWTDecodedUser } from '../../interfaces/jwt/jwt.type';

const createCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.createCategory(
        req.user as TJWTDecodedUser,
        req.body,
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Category created successfully',
        data: result,
    });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, categoryFilterableFields);
    const paginationOptions = pick(req.query, paginationFields);
    const result = await CategoryService.getAllCategories(
        filters,
        paginationOptions,
        req.user as TJWTDecodedUser,
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Categories are retrieved successfully',
        data: result.data,
        meta: result.meta,
    });
});

const getCategoryByID = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.getCategoryByID(
        (req.params.id as string),
        req.user as TJWTDecodedUser,
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Single Category retrieved successfully',
        data: result,
    });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.updateCategory(
        (req.params.id as string),
        req.user as TJWTDecodedUser,
        req.body,
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Category is updated successfully',
        data: result,
    });
});

const deleteCategoryByID = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.deleteCategoryByID(
        (req.params.id as string),
        req.user as TJWTDecodedUser,
    );

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Category is deleted successfully',
        data: result._id,
    });
});

const getCategoryHierarchy = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.getCategoryHierarchy();

    sendSuccessResponse(res, {
        statusCode: StatusCodes.OK,
        message: 'Category hierarchy retrieved successfully',
        data: result,
    });
});

export const CategoryController = {
    createCategory,
    getAllCategories,
    getCategoryByID,
    updateCategory,
    deleteCategoryByID,
    getCategoryHierarchy,
};
