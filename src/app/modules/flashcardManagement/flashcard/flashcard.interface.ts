import { Model, Types } from 'mongoose';
import { VisibilityType } from './flashcard.constant';

export type IFlashcard = {
    title: string;
    visibility:VisibilityType
    categoryId: Types.ObjectId;
    studentId: Types.ObjectId;
    isApproved: boolean;
    approvedBy:Types.ObjectId

};
export type FlashcardModel = Model<
IFlashcard,
Record<string, unknown>
>;
export type IFlashcardFilters = {
    searchTerm?: string;
    title?: string;
    visibility?: string
    studentId?: string; 
    isApproved?: string;
    categoryGroup?: string;
    categoryType?: string
    categoryDivision?: string
    categoryUniversityType?: string;
    categoryUniversityName?: string;
    categoryChapter?: string;
    categorySubject?: string;
    categoryJobType?: string;
    categoryJobName?: string;
    categoryUnit?: string;
    categoryLesson?: string;
  };