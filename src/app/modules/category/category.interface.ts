import { Model } from 'mongoose';
import { CategoryGroup, CategoryType } from './category.constant';

export type ICategory = {
    group: CategoryGroup;
    subject: string;
    lesson: string;
    type?: CategoryType;
    name?: string;
};

export type CategoryModel = Model<ICategory, Record<string, unknown>>;

export type ICategoryFilters = {
    searchTerm?: string;
    group?: string;
    subject?: string;
    lesson?: string;
    type?: string;
    name?: string;
    onlyCreated?: string | boolean;
};

