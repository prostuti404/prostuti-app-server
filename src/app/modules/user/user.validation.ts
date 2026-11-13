import { z } from 'zod';
import { ASSIGNED_WORKS } from '../teacher/teacher.constant';

const bangladeshiPhoneRegex = /^(\+?880|0)1[3456789]\d{8}$/;

const createTeacherAdminValidationSchema = z.object({
    body: z.object({
        name: z
            .string({
                invalid_type_error: 'Name must be a string',
            })
            .trim()
            .min(1, 'Admin name must be at least 1 character')
            .max(100, 'Admin name cannot exceed 100 characters')
            .optional(),

        phone: z
            .string({
                invalid_type_error: 'Phone must be a string',
            })
            .trim()
            .refine((v) => !v || bangladeshiPhoneRegex.test(v), {
                message: 'Invalid Bangladeshi phone number (e.g., 01700000000)',
            })
            .optional(),

        email: z
            .string({
                required_error: 'Email is required',
                invalid_type_error: 'Email must be a string',
            })
            .email('Invalid email format'),

        password: z
            .string({
                required_error: 'Password is required',
                invalid_type_error: 'Password must be a string',
            })
            .min(6, 'Password must be at least 6 characters long')
            .max(20, 'Password must not exceed 20 characters'),
    }),
});

const createTeacherValidationSchema = z.object({
    body: z.object({
        name: z
            .string({
                invalid_type_error: 'Name must be a string',
            })
            .trim()
            .min(1, 'Teacher name must be at least 1 character')
            .max(100, 'Teacher name cannot exceed 100 characters')
            .optional(),

        phone: z
            .string({
                invalid_type_error: 'Phone must be a string',
            })
            .trim()
            .refine((v) => !v || bangladeshiPhoneRegex.test(v), {
                message: 'Invalid Bangladeshi phone number (e.g., 01700000000)',
            })
            .optional(),

        email: z
            .string({
                required_error: 'Email is required',
                invalid_type_error: 'Email must be a string',
            })
            .email('Invalid email format'),

        password: z
            .string({
                required_error: 'Password is required',
                invalid_type_error: 'Password must be a string',
            })
            .min(6, 'Password must be at least 6 characters long')
            .max(20, 'Password must not exceed 20 characters'),

        subjects: z
            .array(z.string())
            .optional(),

        assignedWorks: z
            .array(z.string())
            .refine(
                (works) => {
                    const allowedWorks = Object.values(
                        ASSIGNED_WORKS,
                    ) as string[];
                    return works.every((work) => allowedWorks.includes(work));
                },
                {
                    message: `Each assigned work must be one of: ${Object.values(ASSIGNED_WORKS).join(', ')}`,
                },
            )
            .optional(),
    }),
});

export const userValidator = {
    createTeacherAdminValidationSchema,
    createTeacherValidationSchema,
};
