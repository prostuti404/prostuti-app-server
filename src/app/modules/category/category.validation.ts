import { z } from 'zod';
import { categoryGroup, categoryType } from './category.constant';

const createCategory = z.object({
    body: z
        .object({
            group: z.enum([...categoryGroup] as [string, ...string[]], {
                required_error: 'Category group is required.',
            }),
            type: z.enum([...categoryType] as [string, ...string[]], {
                required_error: 'Category type is required.',
            }),
            name: z
                .string({
                    required_error: 'Category name is required',
                })
                .min(1, 'Category name cannot be an empty string'),
        })
        .strict()
        .refine(
            (data) => {
                if ((data.group === 'Arts' || data.group === 'Commerce') && data.type === 'Admission') {
                    return data.name === 'University';
                }
                return true;
            },
            {
                message: 'Arts and Commerce admission only supports University.',
                path: ['name'],
            }
        ),
});

const updateCategory = z.object({
    body: z
        .object({
            group: z.enum([...categoryGroup] as [string, ...string[]]).optional(),
            type: z.enum([...categoryType] as [string, ...string[]]).optional(),
            name: z
                .string()
                .min(1, 'Category name cannot be an empty string')
                .optional(),
        })
        .strict(),
});

export const CategoryValidation = {
    createCategory,
    updateCategory,
};
