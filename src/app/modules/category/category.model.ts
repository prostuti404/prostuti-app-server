import { Schema, model } from 'mongoose';
import { categoryGroup, categoryType } from './category.constant';
import { CategoryModel, ICategory } from './category.interface';

const CategorySchema = new Schema<ICategory, CategoryModel>(
    {
        group: {
            type: String,
            enum: categoryGroup,
            required: [true, 'Group is required.'],
        },
        subject: {
            type: String,
            required: [true, 'Subject is required.'],
            trim: true,
        },
        lesson: {
            type: String,
            required: [true, 'Lesson is required.'],
            trim: true,
        },
        type: {
            type: String,
            enum: categoryType,
            default: 'Academic',
        },
        name: {
            type: String,
            default: function (this: any) {
                if (this && this.subject) {
                    return this.lesson ? `${this.subject} - ${this.lesson}` : this.subject;
                }
                return '';
            },
        },
    },
    {
        timestamps: true,
    },
);

CategorySchema.index({ group: 1, subject: 1, lesson: 1 }, { unique: true, sparse: true });

export const Category = model<ICategory, CategoryModel>(
    'Category',
    CategorySchema,
);
