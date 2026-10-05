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
        type: {
            type: String,
            enum: categoryType,
            required: [true, 'Type is required.'],
        },
        name: {
            type: String,
            required: [true, 'Name is required.'],
        },
    },
    {
        timestamps: true,
    },
);

CategorySchema.index({ group: 1, type: 1, name: 1 }, { unique: true });

export const Category = model<ICategory, CategoryModel>(
    'Category',
    CategorySchema,
);
