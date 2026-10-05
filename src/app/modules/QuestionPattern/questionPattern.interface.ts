import { Model, Types } from 'mongoose';
import { QuestionType } from '../question/question.constant';

export type IQuestionPattern = {
    category_id: Types.ObjectId[];
    time: number;
    questionType: QuestionType;   
    mcqCount?: number;
    writtenCount?: number;
    mainSubjects: [
        {
            subject: string;
            questionCount: number;
        },
    ];
    optionalSubjects: [
        {
            subject: string;
            questionCount: number;
        },
    ];
    createdBy: Types.ObjectId;
    updatedBy: Types.ObjectId;
};

export type QuestionPatternModel = Model<
    IQuestionPattern,
    Record<string, unknown>
>;

export type IQuestionPatternFilters = {
    searchTerm?: string;
    createdBy?: string;
    questionType?: string;
    categoryGroup?: string;
    categoryType?: string;
    categoryName?: string;
};
