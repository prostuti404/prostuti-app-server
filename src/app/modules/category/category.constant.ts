export type CategoryGroup = 'Science' | 'Arts' | 'Commerce';
export type CategoryType = 'Academic' | 'Admission';

export const categoryGroup: CategoryGroup[] = ['Science', 'Arts', 'Commerce'];
export const categoryType: CategoryType[] = ['Academic', 'Admission'];

export const categoryFilterableFields = [
    'searchTerm',
    'group',
    'type',
    'name'
];

export const categorySearchableFields = [
    'group',
    'type',
    'name'
];
