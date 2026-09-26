import { Schema, model } from 'mongoose';
import { ITeacher, TImage } from './teacher.interface';
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';
import { categoryType } from '../category/category.constant';
import { ASSIGNED_WORKS } from './teacher.constant';

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

const teacherSchema = new Schema<ITeacher>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            required: [true, 'user_id is required'],
            ref: 'User',
        },
        teacherId: {
            type: String,
            required: [true, 'teacherId is required'],
            unique: true,
        },
        name: {
            type: String,
            trim: true,
            minlength: [2, 'teacherName must be at least 2 characters long'],
            maxlength: [
                100,
                'teacherName cannot be more than 100 characters long',
            ],
        },
        phone: {
            type: String,
            trim: true,
            validate: {
                validator: function (v: string) {
                    if (!v) return true;
                    return /^(\+?880|0)1[3456789]\d{8}$/.test(v);
                },
                message: (props) =>
                    `${props.value} is not a valid phone number!`,
            },
        },
        email: {
            type: String,
            required: [true, 'teacherEmail is required'],
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
        joinedDate: {
            type: String,
            validate: {
                validator: function (v: string) {
                    // Validate format: "Month DD,YYYY"
                    return /^(January|February|March|April|May|June|July|August|September|October|November|December)\s([0-9]{2}),([0-9]{4})$/.test(
                        v,
                    );
                },
                message: (props) =>
                    `${props.value} is not a valid date format! Use format: 'Month DD,YYYY'`,
            },
        },
        subjects: {
            type: [String],
            default: [],
        },
        assignedWorks: {
            type: [String],
            default: [],
            validate: {
                validator: function (works: string[]) {
                    // Use type assertion to satisfy TypeScript
                    const allowedWorks = Object.values(
                        ASSIGNED_WORKS,
                    ) as string[];
                    return works.every((work) => allowedWorks.includes(work));
                },
                message: `Each assigned work must be one of: ${Object.values(ASSIGNED_WORKS).join(', ')}`,
            },
        },
        jobType: {
            type: String,
            enum: {
                values: categoryType,
                message: `Invalid jobType. Allowed values are: ${Object.values(categoryType).join(', ')}`,
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

// Pre-save middleware for save operations
// Pre-save middleware to format the phone number
teacherSchema.pre('save', function (next) {
    if (this.phone && this.isModified('phone')) {
        this.phone = formatPhoneNumber(this.phone);
    }
    next();
});

// Pre-update middleware for update operations
// Pre-update middleware to format the phone number
teacherSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate() as { phone?: string };
    if (update?.phone) {
        update.phone = formatPhoneNumber(update.phone);
    }
    next();
});

// Create and export the model
export const Teacher = model<ITeacher>('Teacher', teacherSchema);
