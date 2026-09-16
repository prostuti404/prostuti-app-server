import { Schema, model } from 'mongoose';
import { IStudent, TImage, IStudentCategory } from './student.interface';
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';
import { categoryType, mainCategories, getValidSubCategories, MainCategory } from '../auth/category/category.constant';

const imageSchema = new Schema<TImage>(
    {
        diskType: {
            type: String,
            required: [true, 'Image disk type is required'],
        },
        path: {
            type: String,
            required: [true, 'Image url is required'],
        },
        originalName: {
            type: String,
            required: [true, 'Image original name is required'],
        },
        modifiedName: {
            type: String,
            required: [true, 'Image modified name is required'],
        },
        fileId: {
            type: String,
            required: [true, 'File ID is required'],
        },
    },
    { _id: false, versionKey: false },
);

// Category schema
const categorySchema = new Schema<IStudentCategory>(
    {
        mainCategory: {
            type: String,
            enum: {
                values: mainCategories as unknown as string[],
                message: `{VALUE} is not a valid main category. Allowed values are: ${mainCategories.join(', ')}`,
            },
            required: [true, 'Main category is required'],
        },
        subCategory: {
            type: String,
            validate: {
                validator: function(this: IStudentCategory, subCat: string) {
                    if (!subCat) {
                        return this.mainCategory === MainCategory.JOB; // Only Job can have no subcategory
                    }

                    const validSubcategories = getValidSubCategories(this.mainCategory);
                    return validSubcategories.includes(subCat);
                },
                message: function(props) {
                    const mainCat = (props as any).parent.mainCategory as string;
                    const validSubcategories = getValidSubCategories(mainCat);
                    if (validSubcategories.length === 0) {
                        return 'This category should not have a subcategory';
                    }
                    return `Invalid subcategory. Valid subcategories for ${mainCat} are: ${validSubcategories.join(', ')}`;
                }
            }
        },
    },
    { _id: false, versionKey: false },
);

// Student Schema
const studentSchema = new Schema<IStudent>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            required: [true, 'user_id is required'],
            ref: 'User',
        },
        studentId: {
            type: String,
            required: [true, 'studentId is required'],
            unique: true,
        },
        name: {
            type: String,
            trim: true,
            maxlength: [20, 'Student name cannot be more than 20 characters'],
        },
        // Keeping old categoryType for backward compatibility
        categoryType: {
            type: String,
            enum: {
                values: categoryType as unknown as string[],
                message: `{VALUE} is not a valid categoryType. Allowed values are: ${categoryType.join(', ')}`,
            },
        },
        // New category field
        category: {
            type: categorySchema,
        },
        phone: {
            type: String,
            validate: [
                {
                    validator: function (phone: string) {
                        return /^(\+?880|0)1[3456789]\d{8}$/.test(phone);
                    },
                    message: 'Invalid Bangladeshi phone number',
                },
            ],
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            validate: {
                validator: function (v: string) {
                    return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(
                        v,
                    );
                },
                message: (props) =>
                    `${props.value} is not a valid email address!`,
            },
        },
        image: {
            type: imageSchema,
        },
        enrolledCourses: [
            { type: Schema.Types.ObjectId, ref: 'EnrolledCourse' },
        ],
        subscriptionStartDate: { type: Date },
        subscriptionEndDate: { type: Date },
        trialStartDate: { type: Date, default: Date.now },
        mockTestsUsed: { type: Number, default: 0 },
        liveClassesUsed: { type: Number, default: 0 },
        isSubscribed:{
            type:Boolean,
            default:false,
        }
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

// Pre-save middleware to format the phone number
studentSchema.pre('save', function (next) {
    if (this.phone && this.isModified('phone')) {
        this.phone = formatPhoneNumber(this.phone);
    }
    next();
});

studentSchema.index({ subscriptionEndDate: 1 });

// Create a Model
export const Student = model<IStudent>('Student', studentSchema);