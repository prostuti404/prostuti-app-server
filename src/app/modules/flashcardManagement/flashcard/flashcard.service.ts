import { StatusCodes } from 'http-status-codes';
import AppError from '../../../classes/errorClasses/AppError';
import { TJWTDecodedUser } from '../../../interfaces/jwt/jwt.type';
import { Student } from '../../student/student.model';
import { IFlashcardItem } from '../flashcardItem/flashcardItem.interface';
import { IFlashcard, IFlashcardFilters } from './flashcard.interface';
import { Flashcard } from './flashcard.model';
import { FlashcardItem } from '../flashcardItem/flashcardItem.model';
import { Category } from '../../category/category.model';
import mongoose, { SortOrder, Types } from 'mongoose';
import { IPaginationOptions } from '../../../interfaces/common';
import { calculatePagination } from '../../../helpers/pagenationHelper';
import { flashcardSearchableFields } from './flashcard.constant';
import { User } from '../../user/user.model';
import { FlashcardHistory } from '../flashcardHistory/flashcardHistory.model';
import { Teacher } from '../../teacher/teacher.model';
import { Admin } from '../../admin/admin.model';
import { IStudent } from '../../student/student.interface';
import { ITeacher } from '../../teacher/teacher.interface';
import { ICardInteraction } from '../flashcardHistory/flashcardHistory.interface';

const createFlashcard = async (
    payload: Partial<IFlashcard & { items: Partial<IFlashcardItem>[] }>,
    userInfo: TJWTDecodedUser,
) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Fetch student and category in parallel
        const [studentDetails, checkCategory] = await Promise.all([
            Student.findOne({ user_id: userInfo.userId }),
            Category.findById(payload.categoryId),
        ]);

        if (!studentDetails) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
        }
        if (!checkCategory) {
            throw new AppError(
                StatusCodes.NOT_FOUND,
                'Category does not exist',
            );
        }

        // Validate flashcard items
        if (!payload.items || payload.items.length === 0) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                'Flashcard must have at least one item',
            );
        }

        // Prepare and create flashcard
        const flashcard = new Flashcard({
            title: payload.title,
            visibility: payload.visibility,
            categoryId: checkCategory._id,
            studentId: studentDetails._id,
            isApproved: payload.visibility === 'ONLY_ME',
        });
        await flashcard.save({ session });

        // Prepare and create flashcard items
        const flashcardItems = payload.items.map((item) => ({
            flashcardId: flashcard._id,
            term: item.term,
            answer: item.answer,
            viewCount: 0,
            favoritedBy: [],
        }));
        const createdItems = await FlashcardItem.insertMany(flashcardItems, {
            session,
        });

        // Commit transaction
        await session.commitTransaction();
        return { flashcard, items: createdItems };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};
const getAllFlashcards = async (
    filters: IFlashcardFilters,
    paginationOptions: IPaginationOptions,
    userInfo: TJWTDecodedUser,
) => {
    const {
        searchTerm,
        visibility,
        categoryGroup,
        categoryType,
        categoryDivision,
        categoryUniversityType,
        categoryUniversityName,
        categoryChapter,
        categorySubject,
        categoryJobType,
        categoryJobName,
        categoryUnit,
        categoryLesson,
        ...filtersData
    } = filters;

    const { page, limit, skip, sortBy, sortOrder } =
        calculatePagination(paginationOptions);

    const andConditions = [];

    // searching data
    if (searchTerm) {
        andConditions.push({
            $or: flashcardSearchableFields.map((field) => ({
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

    if (
        categoryGroup ||
        categoryType ||
        categoryDivision ||
        categoryUniversityType ||
        categoryUniversityName ||
        categoryChapter ||
        categorySubject||
        categoryJobType ||
        categoryJobName ||
        categoryUnit||
        categoryLesson
    ) {
        const categoryFilter: any = {};
        if (categoryGroup) categoryFilter.group = categoryGroup;
        if (categoryType) categoryFilter.type = categoryType;
        if (categoryDivision) categoryFilter.division = categoryDivision;
        if (categoryUniversityType)
            categoryFilter.universityType = categoryUniversityType;
        if (categoryUniversityName)
            categoryFilter.universityName = categoryUniversityName;
        if (categoryChapter) categoryFilter.chapter = categoryChapter;
        if (categorySubject) categoryFilter.subject = categorySubject;
        if (categoryJobType) categoryFilter.jobType = categoryJobType;
        if (categoryJobName) categoryFilter.jobName = categoryJobName;
        if (categoryUnit) categoryFilter.unit = categoryUnit;
        if (categoryLesson) categoryFilter.lesson = categoryLesson;

        const matchingCategories =
            await Category.find(categoryFilter).select('_id');
        const categoryIds = matchingCategories.map((cat) => cat._id);
        andConditions.push({ categoryId: { $in: categoryIds } });
    }

    // filter Visibility
    if (userInfo.role === 'student') {
        const checkStudent = await Student.findOne({
            user_id: userInfo.userId,
        });
        if (!checkStudent) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
        }

        if (visibility === 'ONLY_ME') {
            andConditions.push({
                visibility: 'ONLY_ME',
                studentId: checkStudent._id,
            });
        } else if (visibility === 'EVERYONE') {
            andConditions.push({
                visibility: 'EVERYONE',
            });
        } else {
            andConditions.push({
                $or: [
                    { visibility: 'EVERYONE' },
                    {
                        $and: [
                            { visibility: 'ONLY_ME' },
                            { studentId: checkStudent._id },
                        ],
                    },
                ],
            });
        }
    } else {
        if (visibility) {
            andConditions.push({ visibility });
        }
    }

    const sortConditions: { [key: string]: SortOrder } = {};

    if (sortBy && sortOrder) {
        sortConditions[sortBy] = sortOrder;
    }

    const whereConditions =
        andConditions.length > 0 ? { $and: andConditions } : {};

    const count = await Flashcard.countDocuments(whereConditions);
    const result = await Flashcard.find(whereConditions)
        .sort(sortConditions)
        .skip(skip)
        .limit(limit)
        .populate('categoryId')
        .populate('studentId')
        .populate('approvedBy');

    // Add item count for each flashcard
    const flashcardIds = result.map((flashcard) => flashcard._id);
    const itemCounts = await FlashcardItem.aggregate([
        { $match: { flashcardId: { $in: flashcardIds } } },
        { $group: { _id: '$flashcardId', itemCount: { $sum: 1 } } },
    ]);

    // Map item counts to flashcards
    const dataWithItemCount = result.map((flashcard) => {
        const countEntry = itemCounts.find((c) => c._id.equals(flashcard._id));
        return {
            ...flashcard.toObject(),
            itemCount: countEntry ? countEntry.itemCount : 0,
        };
    });

    return {
        meta: {
            page,
            limit: limit === 0 ? count : limit,
            count,
        },
        data: dataWithItemCount,
    };
};

const getFlashcardByID = async (id: string, userInfo: TJWTDecodedUser) => {
    // Check user details
    const checkUser = await User.findById(userInfo.userId);
    if (!checkUser) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User does not exist');
    }

    // Check flashcard with student and category details populated
    const checkFlashcard = await Flashcard.findById(id)
        .populate('studentId', 'name email')
        .populate('categoryId', 'group subject lesson name type')
        .populate('approvedBy', 'name email');
    if (!checkFlashcard) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Flashcard does not exist');
    }

    // Fetch all items
    const items = await FlashcardItem.find({ flashcardId: checkFlashcard._id });
    if (!items || items.length === 0) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'No items found for this flashcard',
        );
    }

    let mappedItems;
    if (checkUser.role === 'teacher' || checkUser.role === 'admin') {
        // Teachers and admins: map items directly
        mappedItems = items.map((item) => ({
            _id: item._id,
            flashcardId: item.flashcardId,
            term: item.term,
            answer: item.answer,
            viewCount: item.viewCount || 0,
            isFavourite:
                item.favoritedBy?.includes(
                    new Types.ObjectId(userInfo.userId),
                ) || false,
            isKnown: false, // Default for non-students
            isLearned: false, // Default for non-students
        }));
    } else {
        const checkStudent = await Student.findOne({
            user_id: userInfo.userId,
        });
        if (!checkStudent) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
        }

        // Visibility check for students
        if (
            checkFlashcard.visibility === 'ONLY_ME' &&
            checkFlashcard.studentId._id.toString() !==
                checkStudent._id.toString()
        ) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                'This flashcard is private',
            );
        }

        const checkFlashcardHistory = await FlashcardHistory.findOne({
            studentId: checkStudent._id,
            flashcardId: id,
        });
        if (checkFlashcardHistory) {
            // Returning student: map history cardInteractions with item details
            mappedItems = checkFlashcardHistory.cardInteractions.map(
                (interaction) => {
                    const item = items.find(
                        (i) =>
                            i._id.toString() === interaction.cardId.toString(),
                    );
                    return {
                        _id: item?._id,
                        flashcardId: checkFlashcard._id,
                        term: item?.term || '',
                        answer: item?.answer || '',
                        viewCount: item?.viewCount || 0,
                        isFavourite:
                            item?.favoritedBy?.includes(
                                new Types.ObjectId(userInfo.userId),
                            ) || false,
                        isKnown: interaction.isKnown,
                        isLearned: interaction.isLearned,
                    };
                },
            );
        } else {
            // First-time student: map items with default history flags
            mappedItems = items.map((item) => ({
                _id: item._id,
                flashcardId: item.flashcardId,
                term: item.term,
                answer: item.answer,
                viewCount: item.viewCount || 0,
                isFavourite:
                    item.favoritedBy?.includes(
                        new Types.ObjectId(userInfo.userId),
                    ) || false,
                isKnown: false,
                isLearned: false,
            }));
        }
    }

    // Return flashcard with all fields and mapped items
    return {
        ...checkFlashcard.toObject(), // Convert Mongoose document to plain object
        items: mappedItems,
    };
};
const updateFlashcard = async (
    id: string,
    payload: Partial<
        IFlashcard & { items: Partial<IFlashcardItem & { id?: string }>[] }
    >,
    userInfo: TJWTDecodedUser,
) => {
    // Check user details
    const checkUser = await User.findById(userInfo.userId);
    if (!checkUser) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User does not exist');
    }

    // Check flashcard with student details populated
    const checkFlashcard = await Flashcard.findById(id);
    if (!checkFlashcard) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Flashcard does not exist');
    }

    // Authorization check
    let checkStudent: (IStudent & { _id: Types.ObjectId }) | null = null;
    let checkTeacher: (ITeacher & { _id: Types.ObjectId }) | null = null;

    if (checkUser.role === 'student') {
        checkStudent = await Student.findOne({ user_id: userInfo.userId });
        if (!checkStudent) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
        }
        if (
            checkFlashcard.studentId.toString() !== checkStudent._id.toString()
        ) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                'You can only update flashcards you created',
            );
        }
    } else if (checkUser.role === 'teacher') {
        checkTeacher = await Teacher.findOne({ user_id: userInfo.userId });
        if (!checkTeacher) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Teacher does not exist');
        }
        // Check if teacher is assigned for Flashcard
        if (!checkTeacher.assignedWorks.includes('FLASHCARD')) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                'You are not assigned to update flashcards',
            );
        }
    } else if (checkUser.role !== 'admin') {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'Only the creator, assigned teacher, or admin can update this flashcard',
        );
    }

    // Update flashcard fields
    if (payload.title) checkFlashcard.title = payload.title;
    if (payload.visibility) checkFlashcard.visibility = payload.visibility;

    // Handle items update
    let updatedItems = await FlashcardItem.find({
        flashcardId: checkFlashcard._id,
    });
    if (payload.items && payload.items.length > 0) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const newItems: any[] = [];
            for (const payloadItem of payload.items) {
                if (payloadItem.id) {
                    // Update existing item
                    const existingItem = updatedItems.find(
                        (item) => item._id.toString() === payloadItem.id,
                    );
                    if (existingItem) {
                        if (payloadItem.term)
                            existingItem.term = payloadItem.term;
                        if (payloadItem.answer)
                            existingItem.answer = payloadItem.answer;
                        await existingItem.save({ session });
                    } else {
                        throw new AppError(
                            StatusCodes.BAD_REQUEST,
                            `Item with ID ${payloadItem.id} not found`,
                        );
                    }
                } else {
                    // Create new item (term and answer are required by Zod)
                    const newItem = new FlashcardItem({
                        flashcardId: checkFlashcard._id,
                        term: payloadItem.term,
                        answer: payloadItem.answer,
                        viewCount: 0,
                        favoritedBy: [],
                    });
                    await newItem.save({ session });
                    newItems.push(newItem);
                }
            }

            // Sync FlashcardHistory for student (only if history exists)
            if (checkUser.role === 'student' && checkStudent) {
                let history = await FlashcardHistory.findOne({
                    studentId: checkStudent._id,
                    flashcardId: id,
                }).session(session);

                if (history && newItems.length > 0) {
                    const existingCardIds = history.cardInteractions.map((ci) =>
                        ci.cardId.toString(),
                    );
                    const newCardInteractions = newItems.map((item) => ({
                        cardId: item._id,
                        isKnown: false,
                        isLearned: false,
                    }));
                    history.cardInteractions = [
                        ...history.cardInteractions,
                        ...newCardInteractions.filter(
                            (ci) =>
                                !existingCardIds.includes(ci.cardId.toString()),
                        ),
                    ];
                    await history.save({ session });
                }
            }

            await checkFlashcard.save({ session });
            await session.commitTransaction();
        } catch (error) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            throw error instanceof AppError
                ? error
                : new AppError(
                      StatusCodes.INTERNAL_SERVER_ERROR,
                      'Failed to update flashcard',
                  );
        } finally {
            session.endSession();
        }
    } else {
        await checkFlashcard.save();
    }

    return checkFlashcard;
};

const deleteFlashcardByID = async (id: string, userInfo: TJWTDecodedUser) => {
    // Check user details
    const checkUser = await User.findById(userInfo.userId);
    if (!checkUser) {
        throw new AppError(StatusCodes.NOT_FOUND, 'User does not exist');
    }

    // Find the FlashcardItem
    const itemIdToDelete = new Types.ObjectId(id);
    const itemToDelete = await FlashcardItem.findById(itemIdToDelete);
    if (!itemToDelete) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'Flashcard item does not exist',
        );
    }

    // Check the associated flashcard with student and approvedBy details populated
    const checkFlashcard = await Flashcard.findById(itemToDelete.flashcardId);
    if (!checkFlashcard) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'Associated flashcard does not exist',
        );
    }

    // Authorization check
    let checkStudent: (IStudent & { _id: Types.ObjectId }) | null = null;
    let checkTeacher: (ITeacher & { _id: Types.ObjectId }) | null = null;

    if (checkUser.role === 'student') {
        checkStudent = await Student.findOne({ user_id: userInfo.userId });
        if (!checkStudent) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
        }
        if (
            checkFlashcard.studentId.toString() !== checkStudent._id.toString()
        ) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                'You can only delete items from flashcards you created',
            );
        }
    } else if (checkUser.role === 'teacher') {
        checkTeacher = await Teacher.findOne({ user_id: userInfo.userId });
        if (!checkTeacher) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Teacher does not exist');
        }
        // Check if teacher is assigned for Flashcard
        if (!checkTeacher.assignedWorks.includes('FLASHCARD')) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                'You are not assigned to delete items from flashcards',
            );
        }
    } else if (checkUser.role !== 'admin') {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'Only the creator, assigned teacher, or admin can delete items from this flashcard',
        );
    }

    // Delete the item and update history in a transaction
    let history;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Delete the item
        await FlashcardItem.deleteOne({ _id: itemIdToDelete }, { session });

        // Update FlashcardHistory for student (if it exists)
        if (checkUser.role === 'student' && checkStudent) {
            history = await FlashcardHistory.findOne({
                studentId: checkStudent._id,
                flashcardId: checkFlashcard._id,
            }).session(session);

            if (history) {
                history.cardInteractions = history.cardInteractions.filter(
                    (interaction) => !itemIdToDelete.equals(interaction.cardId),
                );
                await history.save({ session });
            }
        }

        await session.commitTransaction();
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        throw new AppError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            'Failed to delete flashcard item',
        );
    } finally {
        session.endSession();
    }
    return itemToDelete;
};

const approveFlashcardByID = async (
    id: string,
    payload: { categoryId?: string },
    userInfo: TJWTDecodedUser
) => {
    const checkFlashcard = await Flashcard.findOne({
        _id: id,
        visibility: 'EVERYONE',
        isApproved: false,
    });
    if (!checkFlashcard) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'Flashcard does not exist or already approved',
        );
    }

    if (payload?.categoryId) {
        const checkCategory = await Category.findById(payload.categoryId);
        if (!checkCategory) {
            throw new AppError(
                StatusCodes.NOT_FOUND,
                'Selected category does not exist',
            );
        }
        checkFlashcard.categoryId = checkCategory._id;
    }

    if (userInfo.role === 'admin') {
        const checkAdmin = await Admin.findOne({ user_id: userInfo.userId });
        if (checkAdmin) {
            checkFlashcard.approvedBy = checkAdmin._id;
        }
    } else {
        const checkTeacher = await Teacher.findOne({ user_id: userInfo.userId });
        if (!checkTeacher) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Teacher does not exist');
        }
        checkFlashcard.approvedBy = checkTeacher._id;
    }

    checkFlashcard.isApproved = true;
    await checkFlashcard.save();
    return checkFlashcard;
};

const SwipeFlashcardItemByID = async (
    id: string,
    payload: { swipeDirection: 'right' | 'left' },
    userInfo: TJWTDecodedUser,
) => {
    // Check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
    }

    // Check flashcard item
    const checkFlashcardItem = await FlashcardItem.findById(id);
    if (!checkFlashcardItem) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'Flashcard item does not exist',
        );
    }

    // Check flashcard
    const checkFlashcard = await Flashcard.findById(
        checkFlashcardItem.flashcardId,
    );
    if (!checkFlashcard) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Flashcard does not exist');
    }
    let history;

    // Handle swipe in a transaction
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Fetch all items for the flashcard
        const allItems = await FlashcardItem.find({
            flashcardId: checkFlashcard._id,
        }).session(session);

        // Find or create FlashcardHistory and initialize with all items if new
        history = await FlashcardHistory.findOne({
            studentId: checkStudent._id,
            flashcardId: checkFlashcard._id,
        }).session(session);

        if (!history) {
            history = new FlashcardHistory({
                studentId: checkStudent._id,
                flashcardId: checkFlashcard._id,
                cardInteractions: allItems.map((item) => ({
                    cardId: item._id,
                    isKnown: false,
                    isLearned: false,
                })),
            });
        } else {
            // Add any missing items to history
            const existingCardIds = history.cardInteractions.map((ci) =>
                ci.cardId.toString(),
            );
            const newCardInteractions = allItems
                .filter(
                    (item) => !existingCardIds.includes(item._id.toString()),
                )
                .map((item) => ({
                    cardId: item._id,
                    isKnown: false,
                    isLearned: false,
                }));
            history.cardInteractions = [
                ...history.cardInteractions,
                ...newCardInteractions,
            ];
        }

        // Find the specific card interaction
        const interaction = history.cardInteractions.find((ci) =>
            ci.cardId.equals(checkFlashcardItem._id),
        );
        if (!interaction) {
            throw new AppError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                'Card interaction not found after initialization',
            );
        }

        // Update based on swipe direction
        if (payload.swipeDirection === 'right') {
            interaction.isKnown = true;
            checkFlashcardItem.viewCount =
                (checkFlashcardItem.viewCount || 0) + 1;
            await checkFlashcardItem.save({ session });
        } else if (payload.swipeDirection === 'left') {
            interaction.isLearned = true;
        }

        await history.save({ session });
        await session.commitTransaction();
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        throw error instanceof AppError
            ? error
            : new AppError(
                  StatusCodes.INTERNAL_SERVER_ERROR,
                  'Failed to process swipe action',
              );
    } finally {
        session.endSession();
    }
    return history;
};

const favoriteFlashcardByID = async (id: string, userInfo: TJWTDecodedUser) => {
    // Check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
    }

    // Check flashcard item
    const checkFlashcardItem = await FlashcardItem.findById(id);
    if (!checkFlashcardItem) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'Flashcard item does not exist',
        );
    }

    // Check flashcard
    const checkFlashcard = await Flashcard.findById(
        checkFlashcardItem.flashcardId,
    );
    if (!checkFlashcard) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Flashcard does not exist');
    }

    // Check if the item is already favorited
    const studentId = new Types.ObjectId(checkStudent._id);
    if (checkFlashcardItem.favoritedBy.some((id) => id.equals(studentId))) {
        checkFlashcardItem.favoritedBy = checkFlashcardItem.favoritedBy.filter(
            (id) => !id.equals(studentId),
        );
    } else {
        // Add student to favoritedBy array
        checkFlashcardItem.favoritedBy.push(studentId);
    }

    await checkFlashcardItem.save();

    return checkFlashcardItem;
};

const getFavoriteFlashcardItems = async (userInfo: TJWTDecodedUser) => {
    // Check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student does not exist');
    }

    // Fetch all favorited items
    const favoriteItems = await FlashcardItem.find({
        favoritedBy: checkStudent._id,
    });

    // Return favorite items with isFavorite true
    return favoriteItems.map((item) => ({
        ...item.toObject(),
        isFavorite: true, // Always true since these are the user's favorites
    }));
};

export const FlashcardService = {
    createFlashcard,
    getAllFlashcards,
    getFlashcardByID,
    updateFlashcard,
    deleteFlashcardByID,
    approveFlashcardByID,
    SwipeFlashcardItemByID,
    favoriteFlashcardByID,
    getFavoriteFlashcardItems,
};
