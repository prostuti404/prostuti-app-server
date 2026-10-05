import { StatusCodes } from 'http-status-codes';
import { SortOrder, Types } from 'mongoose';
import AppError from '../../classes/errorClasses/AppError';
import { calculatePagination } from '../../helpers/pagenationHelper';
import { IPaginationOptions } from '../../interfaces/common';
import { TJWTDecodedUser } from '../../interfaces/jwt/jwt.type';
import { Admin } from '../admin/admin.model';
import { Category } from '../category/category.model';
import { questionPatternSearchableFields } from './questionPattern.constant';
import {
    IQuestionPattern,
    IQuestionPatternFilters,
} from './questionPattern.interface';
import { QuestionPattern } from './questionPattern.model';

const createQuestionPattern = async (
    userInfo: TJWTDecodedUser,
    payload: Partial<IQuestionPattern>,
) => {
    //check admin is exist or not
    const checkAdmin = await Admin.findOne({ user_id: userInfo.userId });
    if (!checkAdmin) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Admin not found');
    }

    // Check category exists
    if (payload.category_id) {
        await Promise.all(
            payload.category_id.map(async (categoryId: Types.ObjectId) => {
                const checkCategory = await Category.findOne({
                    _id: categoryId,
                });
                if (!checkCategory) {
                    throw new AppError(
                        StatusCodes.NOT_FOUND,
                        `Category ${categoryId} not found`,
                    );
                }
                return checkCategory;
            }),
        );
    }

    //create question pattern
    const questionPattern = await QuestionPattern.create({
        ...payload,
        createdBy: checkAdmin._id,
    });
    if (!questionPattern) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            'Question pattern not created',
        );
    }
    await questionPattern.populate('category_id');
    await questionPattern.populate('createdBy');
    return questionPattern;
};

const getAllQuestionPatterns = async (
    filters: IQuestionPatternFilters,
    paginationOptions: IPaginationOptions,
    userInfo: TJWTDecodedUser,
) => {
    const {
        searchTerm,
        categoryGroup,
        categoryType,
        categoryName,
        ...filtersData
    } = filters;
    const { page, limit, skip, sortBy, sortOrder } =
        calculatePagination(paginationOptions);

    const andConditions = [];
    if (searchTerm) {
        andConditions.push({
            $or: questionPatternSearchableFields.map((field) => ({
                [field]: {
                    $regex: searchTerm,
                    $options: 'i',
                },
            })),
        });
    }

    // filtering data
    if (Object.keys(filtersData).length) {
        andConditions.push({
            $and: Object.entries(filtersData).map(([field, value]) => ({
                [field]: value,
            })),
        });
    }

    // Category-based filtering
    if (
        categoryGroup ||
        categoryType ||
        categoryName
    ) {
        const categoryFilter: any = {};
        if (categoryGroup) categoryFilter.group = categoryGroup;
        if (categoryType) categoryFilter.type = categoryType;
        if (categoryName) categoryFilter.name = categoryName;

        const matchingCategories =
            await Category.find(categoryFilter).select('_id');
        const categoryIds = matchingCategories.map((cat) => cat._id);
        andConditions.push({ category_id: { $in: categoryIds } });
    }

    const sortConditions: { [key: string]: SortOrder } = {};

    if (sortBy && sortOrder) {
        sortConditions[sortBy] = sortOrder;
    }

    const whereConditions =
        andConditions.length > 0 ? { $and: andConditions } : {};

    const count = await QuestionPattern.countDocuments(whereConditions);
    const result = await QuestionPattern.find(whereConditions)
        .sort(sortConditions)
        .skip(skip)
        .limit(limit)
        .populate('category_id')
        .populate('createdBy');

    return {
        meta: {
            page,
            limit: limit === 0 ? count : limit,
            count,
        },
        data: result,
    };
};

const getQuestionPatternByID = async (id: string) => {
    const questionPattern = await QuestionPattern.findById(id)
        .populate('category_id')
        .populate('createdBy');
    if (!questionPattern) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Question pattern not found');
    }
    return questionPattern;
};

const updateQuestionPattern = async (
    id: string,
    payload: Partial<IQuestionPattern>,
    userInfo: TJWTDecodedUser,
) => {
   // Check admin exists
  const checkAdmin = await Admin.findOne({ user_id: userInfo.userId });
  if (!checkAdmin) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Admin not found');
  }

  // Check question pattern exists
  const checkQuestionPattern = await QuestionPattern.findById(id);
  if (!checkQuestionPattern) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Question pattern not found');
  }

  // Check if the admin is authorized to update
  if (checkQuestionPattern.createdBy.toString() !== checkAdmin._id.toString()) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized to update this question pattern');
  }

  // Determine which category_id to use
  const effectiveCategoryId = payload.category_id || checkQuestionPattern.category_id;

  // Check if categories exist
  await Promise.all(
    effectiveCategoryId.map(async (categoryId: Types.ObjectId) => {
      const checkCategory = await Category.findOne({ _id: categoryId });
      if (!checkCategory) {
        throw new AppError(StatusCodes.NOT_FOUND, `Category ${categoryId} not found`);
      }
      return checkCategory;
    }),
  );

  // Update question pattern
  const questionPattern = await QuestionPattern.findByIdAndUpdate(
    id,
    {
      ...(payload.category_id && { category_id: payload.category_id }),
      ...(payload.time && { time: payload.time }),
      ...(payload.questionType && { questionType: payload.questionType }),
      ...(payload.mainSubjects && { mainSubjects: payload.mainSubjects }),
      ...(payload.optionalSubjects && { optionalSubjects: payload.optionalSubjects }),
      updatedBy: checkAdmin._id,
    },
    { new: true, runValidators: true }
  )
    .populate('category_id')
    .populate('createdBy')
    .populate('updatedBy');

  if (!questionPattern) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Question pattern not updated');
  }

  return questionPattern;
};

const deleteQuestionPatternByID = async (
    id: string,
    userInfo: TJWTDecodedUser,
) => {
    //check admin is exist or not
    const checkAdmin = await Admin.findOne({ user_id: userInfo.userId });
    if (!checkAdmin) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Admin not found');
    }
    //check question pattern is exist or not
    const checkQuestionPattern = await QuestionPattern.findById(id);
    if (!checkQuestionPattern) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Question pattern not found');
    }
    if (
        checkQuestionPattern.createdBy.toString() !== checkAdmin._id.toString()
    ) {
        throw new AppError(
            StatusCodes.UNAUTHORIZED,
            'You are not authorized to delete this question pattern',
        );
    }

    const result = await QuestionPattern.findByIdAndDelete(id);
    if (!result) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            'Question pattern not deleted',
        );
    }
    return result;
};

export const QuestionPatternService = {
    createQuestionPattern,
    getAllQuestionPatterns,
    getQuestionPatternByID,
    updateQuestionPattern,
    deleteQuestionPatternByID,
};
