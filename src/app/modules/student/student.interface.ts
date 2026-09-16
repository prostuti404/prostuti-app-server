import { Types } from 'mongoose';
import { MainCategory } from '../auth/category/category.constant';

export interface TImage {
    diskType: string;
    path: string;
    originalName: string;
    modifiedName: string;
    fileId: string;
}

export interface IStudentCategory {
    mainCategory: MainCategory;
    subCategory?: string;
}

export interface IStudent {
    user_id: Types.ObjectId;
    studentId: string;
    name: string;
    categoryType?: string; // Keeping for backward compatibility but marking optional
    category?: IStudentCategory; // New category structure
    phone: string;
    email: string;
    image?: TImage;
    enrolledCourses?: Types.ObjectId[],
    subscriptionStartDate?: Date;
    subscriptionEndDate?: Date;
    trialStartDate?: Date;
    mockTestsUsed?: number;
    liveClassesUsed?: number;
    isSubscribed:boolean
}

// Define allowed update fields type
export type TAllowedStudentUpdates = Pick<IStudent, 'name'>;

export type TUpdatePayloadType = Partial<
    TAllowedStudentUpdates & { image?: TImage }
>;

export type TCategoryUpdatePayload = {
    mainCategory: MainCategory;
    subCategory?: string;
};