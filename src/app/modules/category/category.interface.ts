import { Model } from 'mongoose';
import { CategoryGroup, CategoryType } from './category.constant';

export type ICategory = {
    group: CategoryGroup;
    type: CategoryType;
    name: string;
};

export type CategoryModel = Model<ICategory, Record<string, unknown>>;

export type ICategoryFilters = {
    searchTerm?: string;
    group?: string;
    type?: string;
    name?: string;
};
