import { Schema, model } from 'mongoose';
import { IAdmin } from './admin.interface';
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';

const adminSchema = new Schema<IAdmin>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            required: [true, 'userId is required'],
            ref: 'User',
        },
        adminId: {
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
        profileImageURL: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

// Pre-save middleware to format the phone number
adminSchema.pre('save', function (next) {
    if (this.phone && this.isModified('phone')) {
        this.phone = formatPhoneNumber(this.phone);
    }
    next();
});

// Create and export the model
export const Admin = model<IAdmin>('Admin', adminSchema);
