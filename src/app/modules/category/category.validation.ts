import { z } from 'zod';
import { categoryGroup, categoryType } from './category.constant';

const createCategory = z.object({
    body: z
        .object({
            group: z.enum([...categoryGroup] as [string, ...string[]], {
                required_error: 'Category group is required.',
            }),
            subject: z
                .string({
                    required_error: 'Subject name is required.',
                })
                .min(1, 'Subject name cannot be an empty string'),
            lesson: z
                .string({
                    required_error: 'Lesson name is required.',
                })
                .min(1, 'Lesson name cannot be an empty string'),
            type: z.enum([...categoryType] as [string, ...string[]]).optional(),
            name: z.string().optional(),
        })
        .strict(),
});

const updateCategory = z.object({
    body: z
        .object({
            group: z.enum([...categoryGroup] as [string, ...string[]]).optional(),
            subject: z.string().min(1).optional(),
            lesson: z.string().min(1).optional(),
            type: z.enum([...categoryType] as [string, ...string[]]).optional(),
            name: z.string().min(1).optional(),
        })
        .strict(),
});

export const CategoryValidation = {
    createCategory,
    updateCategory,
};
