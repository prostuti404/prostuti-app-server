import { StatusCodes } from 'http-status-codes';
import mongoose, { SortOrder, Types } from 'mongoose';
import AppError from '../../classes/errorClasses/AppError';
import { calculatePagination } from '../../helpers/pagenationHelper';
import { IPaginationOptions } from '../../interfaces/common';
import { TJWTDecodedUser } from '../../interfaces/jwt/jwt.type';
import { Category } from '../category/category.model';
import { QuestionType } from '../question/question.constant';
import { Question } from '../question/question.model';
import { Student } from '../student/student.model';
import { quizSearchableFields, QuizzerFilter } from './quiz.constant';
import { IQuizFilters } from './quiz.interface';
import { Quiz } from './quiz.model';
import { FavouriteQuestion } from '../favouriteQuestion/favouriteQuestion.model';
import { TestHistory } from '../courseManagement/test-history/testHistory.model';
import { WrongQuestion } from '../wrongQuestion/wrongQuestion.model';
import { SkippedQuestion } from '../skippedQuestion/skippedQuestion.model';

const createMockQuiz = async (
    userInfo: TJWTDecodedUser,
    payload: {
        questionType: QuestionType;
        subjects: {
            subject:string,
            chapter:string
        }[],
        questionCount: number;
        mcqCount?: number;
        writtenCount?: number;
        isNegativeMarking: boolean;
        time: number;
    },
) => {
    //check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
    }

    // Validate hybrid counts
    if (payload.questionType === 'Hybrid') {
        if (!payload.mcqCount || !payload.writtenCount) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                'MCQ count and Written count are required for Hybrid quiz',
            );
        }
        if (payload.mcqCount + payload.writtenCount !== payload.questionCount) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `MCQ count (${payload.mcqCount}) + Written count (${payload.writtenCount}) must equal total question count (${payload.questionCount})`,
            );
        }
    }

    //check category
    // For now, bypass category check based on subjects since Category no longer has a subject field
    // TODO: Update quiz logic to query Questions directly by subject/chapter or require category_id in payload
    const checkCategory = await Category.find().select({ _id: 1 }).limit(1).lean();
    if (!checkCategory || checkCategory.length === 0) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Category not found');
    }

    // Set default question count
    const questionCount = payload.questionCount || 10;

    let questions: any[] = [];

    if (payload.questionType === 'Hybrid') {
        // For Hybrid: fetch MCQ and Written questions separately
        const mcqCount = payload.mcqCount!;
        const writtenCount = payload.writtenCount!;

        // Fetch MCQ questions
        const mcqFacets = checkCategory.reduce((acc:any, category:any) => {
            acc[category._id] = [
                { $match: { category_id: category._id, type: 'MCQ' } },
                { $sample: { size: mcqCount } },
            ];
            return acc;
        }, {});
        const mcqResult = await Question.aggregate([{ $facet: mcqFacets }]).exec();
        const mcqQuestions = Array.from(
            new Map(Object.values(mcqResult[0]).flat().map((q: any) => [q._id.toString(), q])).values(),
        );

        // Fetch Written questions
        const writtenFacets = checkCategory.reduce((acc:any, category:any) => {
            acc[category._id] = [
                { $match: { category_id: category._id, type: 'Written' } },
                { $sample: { size: writtenCount } },
            ];
            return acc;
        }, {});
        const writtenResult = await Question.aggregate([{ $facet: writtenFacets }]).exec();
        const writtenQuestions = Array.from(
            new Map(Object.values(writtenResult[0]).flat().map((q: any) => [q._id.toString(), q])).values(),
        );

        if (mcqQuestions.length < mcqCount * payload.subjects.length) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Not enough MCQ questions available. Required: ${mcqCount * payload.subjects.length}, Found: ${mcqQuestions.length}`,
            );
        }
        if (writtenQuestions.length < writtenCount * payload.subjects.length) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Not enough Written questions available. Required: ${writtenCount * payload.subjects.length}, Found: ${writtenQuestions.length}`,
            );
        }

        // MCQ first, then Written
        questions = [...mcqQuestions, ...writtenQuestions];
    } else {
        // Original logic for MCQ or Written only
        const facets = checkCategory.reduce((acc:any, category:any) => {
            acc[category._id] = [
                { $match: { category_id: category._id, type: payload.questionType } },
                { $sample: { size: questionCount } },
            ];
            return acc;
        }, {});

        const result = await Question.aggregate([{ $facet: facets }]).exec();
        const questionArray = Object.values(result[0]).flat();
        questions = Array.from(
            new Map(questionArray.map((q: any) => [q._id.toString(), q])).values(),
        );

        if (questions.length < questionCount * payload.subjects.length) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Not enough questions available. Required: ${questionCount * payload.subjects.length}, Found: ${questions.length}`,
            );
        }
    }

    // Create quiz
    const quizData = {
        student_id: checkStudent._id,
        category_id: checkCategory.map((cat) => cat._id),
        type: 'Mock',
        time: payload.time,
        questionCount,
        mcqCount: payload.mcqCount,
        writtenCount: payload.writtenCount,
        isNegativeMarking: payload.isNegativeMarking,
        questionType: payload.questionType,
        questions: questions.map((q) => q._id),
        answers: [],
        totalScore: questions.length,
        score: 0,
        rightScore: 0,
        wrongScore: 0,
    };

    const quiz = await Quiz.create(quizData);

    // Return populated quiz
    const populatedQuiz = await Quiz.findById(quiz._id)
        .populate('questions')
        .populate('category_id')
        .populate('student_id')
        .lean();

    if (!populatedQuiz) {
        throw new AppError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            'Failed to create quiz',
        );
    }

    return populatedQuiz;
};

const submitMockQuiz = async (
    userInfo: TJWTDecodedUser,
    payload: {
        answers: { question_id: string; selectedOption: string }[];
    },
    quiz_id: string,
) => {
    //check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
    }
    //check quiz
    const checkQuiz = await Quiz.findById(quiz_id).populate(
        'questions',
        'correctOption type options',
    );
    if (!checkQuiz) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Quiz not found');
    }
    if (checkQuiz.type !== 'Mock') {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'This route is only for mock quiz',
        );
    }

    // Verify checkQuiz belongs to the student
    if (checkQuiz.student_id.toString() !== checkStudent._id.toString()) {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'You are not authorized to submit this Quiz',
        );
    }

    // Check if quiz is already completed
    if (checkQuiz.completedAt) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Quiz already completed');
    }

    // Validate answers
    if (!payload.answers || payload.answers.length === 0) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'No answers provided');
    }

    // Check if all questions are answered
    if (payload.answers.length !== checkQuiz.questions.length) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `All questions must be answered. Expected ${checkQuiz.questions.length}, received ${payload.answers.length}`,
        );
    }

    // Check for duplicate questionIds in answers
    const submittedQuestionIds = payload.answers.map((a) => a.question_id);
    const uniqueQuestionIds = new Set(submittedQuestionIds);
    if (uniqueQuestionIds.size !== submittedQuestionIds.length) {
        const duplicates = submittedQuestionIds.filter(
            (id, index) => submittedQuestionIds.indexOf(id) !== index,
        );
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Duplicate question IDs detected: ${[...new Set(duplicates)].join(', ')}`,
        );
    }

    // Validate question IDs match quiz questions
    const quizQuestionIds = checkQuiz.questions.map((q: any) =>
        q._id.toString(),
    );
    const invalidQuestionIds = submittedQuestionIds.filter(
        (id) => !quizQuestionIds.includes(id),
    );
    if (invalidQuestionIds.length > 0) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Invalid question IDs provided: ${invalidQuestionIds.join(', ')}`,
        );
    }

    // Build question map with type info for per-question scoring
    const questionMap = new Map(
        checkQuiz.questions.map((q: any) => [
            q._id.toString(),
            { correctOption: q.correctOption, options: q.options || [], type: q.type },
        ]),
    );

    // Initialize formatted answers
    const formattedAnswers = [];
    let score = 0;
    let rightScore = 0;
    let wrongScore = 0;
    const negativeMarkingValue = checkQuiz.isNegativeMarking ? 0.5 : 0;

    // Process each answer based on the question's individual type
    for (const answer of payload.answers) {
        const question = questionMap.get(answer.question_id);
        const questionType = checkQuiz.questionType === 'Hybrid' ? question?.type : checkQuiz.questionType;

        if (questionType === 'MCQ') {
            // Skip answer
            if (answer.selectedOption === 'null') {
                await SkippedQuestion.findOneAndUpdate(
                    { student_id: checkStudent._id },
                    { $addToSet: { question_id: answer.question_id } },
                    { upsert: true }
                );
                formattedAnswers.push({
                    question_id: new mongoose.Types.ObjectId(answer.question_id),
                    selectedOption: answer.selectedOption,
                    mark: 0,
                });
                continue;
            }
            const isCorrect = question?.correctOption === answer.selectedOption;
            if (isCorrect) {
                rightScore++;
            } else {
                await WrongQuestion.findOneAndUpdate(
                    { student_id: checkStudent._id },
                    { $addToSet: { question_id: answer.question_id } },
                    { upsert: true }
                );
                wrongScore++;
            }
            formattedAnswers.push({
                question_id: new mongoose.Types.ObjectId(answer.question_id),
                selectedOption: answer.selectedOption,
                mark: isCorrect ? 1 : 0,
            });
        } else if (questionType === 'Written') {
            // Written questions: just store the answer, no scoring
            formattedAnswers.push({
                question_id: new mongoose.Types.ObjectId(answer.question_id),
                selectedOption: answer.selectedOption,
                mark: 0,
            });
        } else {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Unsupported question type: ${questionType}`,
            );
        }
    }

    // Calculate final score (only MCQ portion contributes)
    score = rightScore - wrongScore * negativeMarkingValue;

    // Update quiz
    checkQuiz.answers = formattedAnswers;
    checkQuiz.score = score < 0 ? 0 : score;
    checkQuiz.rightScore = rightScore;
    checkQuiz.wrongScore = wrongScore;

    checkQuiz.completedAt = new Date();

    await checkQuiz.save();

    // Return result with populated data
    const result = await Quiz.findById(checkQuiz._id)
        .populate('category_id')
        .populate('student_id')
        .lean();

    return result;
};

const createQuizzerQuiz = async (
    userInfo: TJWTDecodedUser,
    payload: {
        questionType: QuestionType;
        subjects: {
            subject:string,
            chapter:string
        }[],
        questionFilters: QuizzerFilter[];
        questionCount: number;
        mcqCount?: number;
        writtenCount?: number;
        isNegativeMarking: boolean;
        time: number;
    },
) => {
    //check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
    }

    //check category
    // For now, bypass category check based on subjects since Category no longer has a subject field
    const checkCategory = await Category.find().select({ _id: 1 }).limit(1).lean();
    if (!checkCategory || checkCategory.length === 0) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Category not found');
    }

    // Set default question count
    const questionCount = payload.questionCount || 10;

    // Get question IDs based on filters
    let questionIds: Types.ObjectId[] = [];
    const categoryIds = checkCategory.map((cat) => cat._id);

    for (const filter of payload.questionFilters) {
        // For Hybrid, query both MCQ and Written types
        const typeFilter = payload.questionType === 'Hybrid' 
            ? { $in: ['MCQ', 'Written'] } 
            : payload.questionType;
        switch (filter) {
            case 'Favorite':
                const favorite = await FavouriteQuestion.findOne({
                    student_id: checkStudent._id,
                }).lean();
                if (favorite && favorite.favourite_questions.length > 0) {
                    const validFavorites = await Question.find({
                        _id: { $in: favorite.favourite_questions },
                        category_id: { $in: categoryIds },
                        type: typeFilter,
                    }).distinct('_id');
                    questionIds.push(
                        ...validFavorites.map(
                            (id) => new mongoose.Types.ObjectId(id),
                        ),
                    );
                }
                break;

            case 'Wrong':
                const wrong = await WrongQuestion.findOne({
                    student_id: checkStudent._id,
                }).lean();
                if (wrong && wrong.question_id.length > 0) {
                    const validWrongs = await Question.find({
                        _id: { $in: wrong.question_id },
                        category_id: { $in: categoryIds },
                        type: typeFilter,
                    }).distinct('_id');
                    questionIds.push(
                        ...validWrongs.map(
                            (id) => new mongoose.Types.ObjectId(id),
                        ),
                    );
                }
                break;
                

            case 'Skipped':
                const skipped = await SkippedQuestion.findOne({
                    student_id: checkStudent._id,
                }).lean();
                if (skipped && skipped.question_id.length > 0) {
                    const validSkippeds = await Question.find({
                        _id: { $in: skipped.question_id },
                        category_id: { $in: categoryIds },
                        type: typeFilter,
                    }).distinct('_id');
                    questionIds.push(
                        ...validSkippeds.map(
                            (id) => new mongoose.Types.ObjectId(id),
                        ),
                    );
                }
                break;
                
        }
    }

    // Deduplicate question IDs
    questionIds = [...new Set(questionIds.map((id) => id.toString()))].map(
        (id) => new mongoose.Types.ObjectId(id),
    );

    // Check if any questions were found
    if (questionIds.length === 0) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `No questions found for filters '${payload.questionFilters.join(
                ', ',
            )}' in the specified categories and question type`,
        );
    }

    // Aggregate questions
    const typeMatchFilter = payload.questionType === 'Hybrid'
        ? { $in: ['MCQ', 'Written'] }
        : payload.questionType;
    const facets = checkCategory.reduce((acc:any, category:any) => {
        acc[category._id] = [
            {
                $match: {
                    _id: { $in: questionIds },
                    category_id: category._id,
                    type: typeMatchFilter,
                },
            },
            {
                $sample: { size: questionCount },
            },
        ];
        return acc;
    }, {});

    const result = await Question.aggregate([
        {
            $facet: facets,
        },
    ]).exec();

    // Flatten and deduplicate questions
    const questionArray = Object.values(result[0]).flat();
    const questions = Array.from(
        new Map(questionArray.map((q: any) => [q._id.toString(), q])).values(),
    );

    // Validate question count
    if (questions.length < questionCount * payload.subjects.length) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Not enough questions available for filters '${payload.questionFilters.join(
                ', ',
            )}'. Required: ${questionCount * payload.subjects.length}, Found: ${
                questions.length
            }`,
        );
    }

    // Create quiz
    const quizData = {
        student_id: checkStudent._id,
        category_id: checkCategory.map((cat) => cat._id),
        type: 'Quizzer',
        time: payload.time,
        questionCount,
        mcqCount: payload.mcqCount,
        writtenCount: payload.writtenCount,
        isNegativeMarking: payload.isNegativeMarking,
        questionType: payload.questionType,
        questions: questions.map((q) => q._id),
        answers: [],
        totalScore: questions.length,
        score: 0,
        rightScore: 0,
        wrongScore: 0,
    };

    const quiz = await Quiz.create(quizData);

    // Return populated quiz
    const populatedQuiz = await Quiz.findById(quiz._id)
        .populate('questions')
        .populate('category_id')
        .populate('student_id')
        .lean();

    if (!populatedQuiz) {
        throw new AppError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            'Failed to create quiz',
        );
    }

    return populatedQuiz;
};

const submitQuizzerQuiz = async (
    userInfo: TJWTDecodedUser,
    payload: {
        answers: { question_id: string; selectedOption: string }[];
    },
    quiz_id: string,
) => {
    //check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
    }
    //check quiz
    const checkQuiz = await Quiz.findById(quiz_id).populate(
        'questions',
        'correctOption type options',
    );
    if (!checkQuiz) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Quiz not found');
    }
    if (checkQuiz.type !== 'Quizzer') {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'This route is only for quizzer quiz',
        );
    }

    // Verify checkQuiz belongs to the student
    if (checkQuiz.student_id.toString() !== checkStudent._id.toString()) {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'You are not authorized to submit this Quiz',
        );
    }

    // Check if quiz is already completed
    if (checkQuiz.completedAt) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Quiz already completed');
    }

    // Validate answers
    if (!payload.answers || payload.answers.length === 0) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'No answers provided');
    }

    // Check if all questions are answered
    if (payload.answers.length !== checkQuiz.questions.length) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `All questions must be answered. Expected ${checkQuiz.questions.length}, received ${payload.answers.length}`,
        );
    }

    // Check for duplicate questionIds in answers
    const submittedQuestionIds = payload.answers.map((a) => a.question_id);
    const uniqueQuestionIds = new Set(submittedQuestionIds);
    if (uniqueQuestionIds.size !== submittedQuestionIds.length) {
        const duplicates = submittedQuestionIds.filter(
            (id, index) => submittedQuestionIds.indexOf(id) !== index,
        );
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Duplicate question IDs detected: ${[...new Set(duplicates)].join(', ')}`,
        );
    }

    // Validate question IDs match quiz questions
    const quizQuestionIds = checkQuiz.questions.map((q: any) =>
        q._id.toString(),
    );
    const invalidQuestionIds = submittedQuestionIds.filter(
        (id) => !quizQuestionIds.includes(id),
    );
    if (invalidQuestionIds.length > 0) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Invalid question IDs provided: ${invalidQuestionIds.join(', ')}`,
        );
    }

    // Build question map with type info for per-question scoring
    const questionMap = new Map(
        checkQuiz.questions.map((q: any) => [
            q._id.toString(),
            { correctOption: q.correctOption, options: q.options || [], type: q.type },
        ]),
    );

    // Initialize formatted answers
    const formattedAnswers = [];
    let score = 0;
    let rightScore = 0;
    let wrongScore = 0;
    const negativeMarkingValue = checkQuiz.isNegativeMarking ? 0.5 : 0;

    // Process each answer based on the question's individual type
    for (const answer of payload.answers) {
        const question = questionMap.get(answer.question_id);
        const questionType = checkQuiz.questionType === 'Hybrid' ? question?.type : checkQuiz.questionType;

        if (questionType === 'MCQ') {
            if (answer.selectedOption === 'null') {
                await SkippedQuestion.findOneAndUpdate(
                    { student_id: checkStudent._id },
                    { $addToSet: { question_id: answer.question_id } },
                    { upsert: true }
                );
                formattedAnswers.push({
                    question_id: new mongoose.Types.ObjectId(answer.question_id),
                    selectedOption: answer.selectedOption,
                    mark: 0,
                });
                continue;
            }
            const isCorrect = question?.correctOption === answer.selectedOption;
            if (isCorrect) {
                rightScore++;
            } else {
                await WrongQuestion.findOneAndUpdate(
                    { student_id: checkStudent._id },
                    { $addToSet: { question_id: answer.question_id } },
                    { upsert: true }
                );
                wrongScore++;
            }
            formattedAnswers.push({
                question_id: new mongoose.Types.ObjectId(answer.question_id),
                selectedOption: answer.selectedOption,
                mark: isCorrect ? 1 : 0,
            });
        } else if (questionType === 'Written') {
            formattedAnswers.push({
                question_id: new mongoose.Types.ObjectId(answer.question_id),
                selectedOption: answer.selectedOption,
                mark: 0,
            });
        } else {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Unsupported question type: ${questionType}`,
            );
        }
    }

    // Calculate final score (only MCQ portion contributes)
    score = rightScore - wrongScore * negativeMarkingValue;

    // Update quiz
    checkQuiz.answers = formattedAnswers;
    checkQuiz.score = score < 0 ? 0 : score;
    checkQuiz.rightScore = rightScore;
    checkQuiz.wrongScore = wrongScore;

    checkQuiz.completedAt = new Date();

    await checkQuiz.save();

    // Return result with populated data
    const result = await Quiz.findById(checkQuiz._id)
        .populate('category_id')
        .populate('student_id')
        .lean();

    return result;
};

const createSegmentQuiz = async (
    userInfo: TJWTDecodedUser,
    payload: {
        questionType: QuestionType;
        mcqCount?: number;
        writtenCount?: number;
        mainSubjects: { subject: string; questionCount: number }[];
        optionalSubjects?: { subject: string; questionCount: number }[];
        category_id: string[];
        isNegativeMarking: boolean;
        time: number;
    },
) => {
    //check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
    }

    //check category

    const checkCategories = await Category.find({
        _id: { $in: payload.category_id },
    })
        .select({ _id: 1, subject: 1 })
        .lean();
    if (
        !checkCategories ||
        checkCategories.length !== payload.category_id.length
    ) {
        throw new AppError(
            StatusCodes.NOT_FOUND,
            'One or more categories not found',
        );
    }

    // Extract all subjects and their required question counts
    const allSubjects = [
        ...payload.mainSubjects,
        ...(payload.optionalSubjects || []),
    ];

    // Fetch questions for each subject and validate counts
    const typeFilter = payload.questionType === 'Hybrid'
        ? { $in: ['MCQ', 'Written'] }
        : payload.questionType;
    const questionPromises = allSubjects.map(async (sub) => {
        // We will just use the first category in payload.category_id as a fallback
        const categoryForSubject = checkCategories[0];
        if (!categoryForSubject) return [];

        const questions = await Question.aggregate([
            {
                $match: {
                    category_id: categoryForSubject._id,
                    type: typeFilter,
                },
            },
            {
                $sample: { size: sub.questionCount },
            },
        ]).exec();

        // Check if sufficient questions are available for this subject
        if (questions.length < sub.questionCount) {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Not enough ${payload.questionType} questions for subject "${sub.subject}". Required: ${sub.questionCount}, Found: ${questions.length}`,
            );
        }

        return questions;
    });
    const questionArrays = await Promise.all(questionPromises);
    const questions = questionArrays.flat();

    // Filter out duplicates by question `_id`
    const uniqueQuestions = Array.from(
        new Map(questions.map((q: any) => [q._id.toString(), q])).values(),
    );

    // Calculate total required questions
    const totalQuestionCount = allSubjects.reduce(
        (sum, sub) => sum + sub.questionCount,
        0,
    );

    // This check is now redundant due to per-subject validation, but kept for extra safety
    if (uniqueQuestions.length < totalQuestionCount) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Not enough questions available after deduplication. Required: ${totalQuestionCount}, Found: ${uniqueQuestions.length}`,
        );
    }

    // Create quiz
    const quizData = {
        student_id: checkStudent._id,
        category_id: payload.category_id,
        type: 'Segment',
        time: payload.time,
        questionCount: totalQuestionCount,
        mcqCount: payload.mcqCount,
        writtenCount: payload.writtenCount,
        isNegativeMarking: payload.isNegativeMarking,
        questionType: payload.questionType,
        questions: uniqueQuestions.map((q) => q._id),
        answers: [],
        totalScore: uniqueQuestions.length,
        score: 0,
        rightScore: 0,
        wrongScore: 0,
    };

    const quiz = await Quiz.create(quizData);

    // Return populated quiz
    const populatedQuiz = await Quiz.findById(quiz._id)
        .populate('questions')
        .populate('category_id')
        .populate('student_id')
        .lean();

    if (!populatedQuiz) {
        throw new AppError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            'Failed to create quiz',
        );
    }

    return populatedQuiz;
};

const submitSegmentQuiz = async (
    userInfo: TJWTDecodedUser,
    payload: {
        answers: { question_id: string; selectedOption: string }[];
    },
    quiz_id: string,
) => {
    //check student
    const checkStudent = await Student.findOne({ user_id: userInfo.userId });
    if (!checkStudent) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
    }
    //check quiz
    const checkQuiz = await Quiz.findById(quiz_id).populate(
        'questions',
        'correctOption type options',
    );
    if (!checkQuiz) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Quiz not found');
    }
    if (checkQuiz.type !== 'Segment') {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'This route is only for segment quiz',
        );
    }

    // Verify checkQuiz belongs to the student
    if (checkQuiz.student_id.toString() !== checkStudent._id.toString()) {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            'You are not authorized to submit this Quiz',
        );
    }

    // Check if quiz is already completed
    if (checkQuiz.completedAt) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Quiz already completed');
    }

    // Validate answers
    if (!payload.answers || payload.answers.length === 0) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'No answers provided');
    }

    // Check if all questions are answered
    if (payload.answers.length !== checkQuiz.questions.length) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `All questions must be answered. Expected ${checkQuiz.questions.length}, received ${payload.answers.length}`,
        );
    }

    // Check for duplicate questionIds in answers
    const submittedQuestionIds = payload.answers.map((a) => a.question_id);
    const uniqueQuestionIds = new Set(submittedQuestionIds);
    if (uniqueQuestionIds.size !== submittedQuestionIds.length) {
        const duplicates = submittedQuestionIds.filter(
            (id, index) => submittedQuestionIds.indexOf(id) !== index,
        );
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Duplicate question IDs detected: ${[...new Set(duplicates)].join(', ')}`,
        );
    }

    // Validate question IDs match quiz questions
    const quizQuestionIds = checkQuiz.questions.map((q: any) =>
        q._id.toString(),
    );
    const invalidQuestionIds = submittedQuestionIds.filter(
        (id) => !quizQuestionIds.includes(id),
    );
    if (invalidQuestionIds.length > 0) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Invalid question IDs provided: ${invalidQuestionIds.join(', ')}`,
        );
    }

    // Build question map with type info for per-question scoring
    const questionMap = new Map(
        checkQuiz.questions.map((q: any) => [
            q._id.toString(),
            { correctOption: q.correctOption, options: q.options || [], type: q.type },
        ]),
    );

    // Initialize formatted answers
    const formattedAnswers = [];
    let score = 0;
    let rightScore = 0;
    let wrongScore = 0;
    const negativeMarkingValue = checkQuiz.isNegativeMarking ? 0.5 : 0;

    // Process each answer based on the question's individual type
    for (const answer of payload.answers) {
        const question = questionMap.get(answer.question_id);
        const questionType = checkQuiz.questionType === 'Hybrid' ? question?.type : checkQuiz.questionType;

        if (questionType === 'MCQ') {
            if (answer.selectedOption === 'null') {
                await SkippedQuestion.findOneAndUpdate(
                    { student_id: checkStudent._id },
                    { $addToSet: { question_id: answer.question_id } },
                    { upsert: true }
                );
                formattedAnswers.push({
                    question_id: new mongoose.Types.ObjectId(answer.question_id),
                    selectedOption: answer.selectedOption,
                    mark: 0,
                });
                continue;
            }
            const isCorrect = question?.correctOption === answer.selectedOption;
            if (isCorrect) {
                rightScore++;
            } else {
                await WrongQuestion.findOneAndUpdate(
                    { student_id: checkStudent._id },
                    { $addToSet: { question_id: answer.question_id } },
                    { upsert: true }
                );
                wrongScore++;
            }
            formattedAnswers.push({
                question_id: new mongoose.Types.ObjectId(answer.question_id),
                selectedOption: answer.selectedOption,
                mark: isCorrect ? 1 : 0,
            });
        } else if (questionType === 'Written') {
            formattedAnswers.push({
                question_id: new mongoose.Types.ObjectId(answer.question_id),
                selectedOption: answer.selectedOption,
                mark: 0,
            });
        } else {
            throw new AppError(
                StatusCodes.BAD_REQUEST,
                `Unsupported question type: ${questionType}`,
            );
        }
    }

    // Calculate final score (only MCQ portion contributes)
    score = rightScore - wrongScore * negativeMarkingValue;

    // Update quiz
    checkQuiz.answers = formattedAnswers;
    checkQuiz.score = score < 0 ? 0 : score;
    checkQuiz.rightScore = rightScore;
    checkQuiz.wrongScore = wrongScore;

    checkQuiz.completedAt = new Date();

    await checkQuiz.save();

    // Return result with populated data
    const result = await Quiz.findById(checkQuiz._id)
        .populate('category_id')
        .populate('student_id')
        .lean();

    return result;
};
const getAllQuizzes = async (
    filters: IQuizFilters,
    paginationOptions: IPaginationOptions,
): Promise<{ meta: any; data: any[] }> => {
    const { searchTerm, ...filtersData } = filters;

    const { page, limit, skip, sortBy, sortOrder } =
        calculatePagination(paginationOptions);

    const andConditions = [];

    // searching data
    if (searchTerm) {
        andConditions.push({
            $or: quizSearchableFields.map((field) => ({
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
    const sortConditions: { [key: string]: SortOrder } = {};

    if (sortBy && sortOrder) {
        sortConditions[sortBy] = sortOrder;
    }

    const whereConditions =
        andConditions.length > 0 ? { $and: andConditions } : {};

    const count = await Quiz.countDocuments(whereConditions);
    const result = await Quiz.find(whereConditions)
        .populate('student_id')
        .populate('category_id')
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

const getSingleQuiz = async (id: string, userInfo: TJWTDecodedUser) => {
    const checkQuiz = await Quiz.findById(id)
        .populate('questions')
        .populate('student_id')
        .populate('category_id')
        .populate('answers.question_id');
    if (!checkQuiz) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Quiz not found');
    }

    if (userInfo.role === 'student') {
        const checkStudent = await Student.findOne({
            user_id: userInfo.userId,
        });
        if (!checkStudent) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Student not found');
        }
        // Verify checkQuiz belongs to the student
        if (
            checkQuiz.student_id._id.toString() !== checkStudent._id.toString()
        ) {
            throw new AppError(
                StatusCodes.FORBIDDEN,
                'You are not authorized to view this Quiz',
            );
        }
        return checkQuiz;
    } else {
        return checkQuiz;
    }
};
export const QuizService = {
    createMockQuiz,
    submitMockQuiz,
    createQuizzerQuiz,
    submitQuizzerQuiz,
    createSegmentQuiz,
    submitSegmentQuiz,
    getAllQuizzes,
    getSingleQuiz,
};
