/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../classes/errorClasses/AppError';
import {
    IChatMessage,
    IBroadcastRequest,
    IChatFilters,
    BroadcastStatus
} from './chat.interface';
import { ChatMessage, BroadcastRequest } from './chat.model';
import { BROADCAST_EXPIRY_HOURS, BROADCAST_STATUS, CHAT_PAGINATION } from './chat.constant';
import { User } from '../user/user.model';
import { Student } from '../student/student.model';
import { Teacher } from '../teacher/teacher.model';
import { USER_ROLE } from '../user/user.constant';

/**
 * Creates a new broadcast request from a student
 */
const createBroadcastRequest = async (
    studentId: string,
    message: string,
    subject: string
): Promise<IBroadcastRequest> => {
    // Check if student exists
    const user = await User.findOne({
        _id: studentId,
        role: USER_ROLE.student,
        isDeleted: false,
        status: 'active'
    });

    if (!user) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Student not found or inactive');
    }

    const studentRecord = await Student.findOne({ user_id: studentId });
    if (!studentRecord || !studentRecord.isSubscribed) {
        throw new AppError(StatusCodes.FORBIDDEN, 'You must be a subscriber to use the Doubt Solve feature.');
    }

    // Set expiry time (24 hours from now)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + BROADCAST_EXPIRY_HOURS);

    // Create the broadcast request
    const broadcastRequest = await BroadcastRequest.create({
        student_id: new Types.ObjectId(studentId),
        message,
        subject,
        status: BROADCAST_STATUS.PENDING as BroadcastStatus,
        expiry_time: expiryTime
    });

    return broadcastRequest;
};

/**
 * Get all pending broadcast requests for teachers
 */
const getPendingBroadcastRequests = async (): Promise<IBroadcastRequest[]> => {
    const broadcastRequests = await BroadcastRequest.find({
        status: BROADCAST_STATUS.PENDING as BroadcastStatus,
        expiry_time: { $gt: new Date() }
    })
        .populate({
            path: 'student_id',
            select: 'registeredId',
            model: User,
        })
        .sort({ createdAt: -1 });

    // Populate with student details
    const populatedRequests = await Promise.all(
        broadcastRequests.map(async (request) => {
            const studentDetail = await Student.findOne({
                user_id: request.student_id
            }).select('name categoryType');

            return {
                ...request.toObject(),
                student: studentDetail
            };
        })
    );

    return populatedRequests;
};

/**
 * Accept a broadcast request by a teacher
 */
const acceptBroadcastRequest = async (
    broadcastId: string,
    teacherId: string
): Promise<IBroadcastRequest> => {
    console.log(broadcastId);
    const teacher = await User.findOne({
        _id: teacherId,
        role: USER_ROLE.teacher,
        isDeleted: false,
        status: 'active'
    });

    if (!teacher) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Teacher not found or inactive');
    }

    // Find and update the broadcast request
    const broadcastRequest = await BroadcastRequest.findOne({
        _id: broadcastId,
        status: BROADCAST_STATUS.PENDING,
        expiry_time: { $gt: new Date() }
    });

    if (!broadcastRequest) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Broadcast request not found or already processed');
    }

    // Generate a unique conversation ID
    const conversationId = `${broadcastRequest.student_id}_${teacherId}_${Date.now()}`;

    // Update the broadcast request
    broadcastRequest.status = BROADCAST_STATUS.ACCEPTED as BroadcastStatus;
    broadcastRequest.accepted_by = new Types.ObjectId(teacherId);
    broadcastRequest.conversation_id = conversationId;
    await broadcastRequest.save();

    // Auto-send greeting message

    const greetingMessage = `Hello, How can I assist you?`;

    await ChatMessage.create({
        sender_id: new Types.ObjectId(teacherId),
        sender_role: 'teacher',
        recipient_id: broadcastRequest.student_id,
        conversation_id: conversationId,
        message: greetingMessage,
        read: false
    });

    return broadcastRequest;
};

/**
 * Decline a broadcast request
 */
const declineBroadcastRequest = async (
    broadcastId: string,
    teacherId: string
): Promise<IBroadcastRequest> => {
    // Check if teacher exists
    const teacher = await User.findOne({
        _id: teacherId,
        role: USER_ROLE.teacher
    });

    if (!teacher) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Teacher not found');
    }

    // Find and update the broadcast request
    const broadcastRequest = await BroadcastRequest.findOne({
        _id: broadcastId,
        status: BROADCAST_STATUS.PENDING
    });

    if (!broadcastRequest) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Broadcast request not found or already processed');
    }

    // Update the broadcast request
    broadcastRequest.status = BROADCAST_STATUS.DECLINED as BroadcastStatus;
    await broadcastRequest.save();

    return broadcastRequest;
};

/**
 * Mark expired broadcast requests
 * This should be called periodically by a scheduled job
 */
const markExpiredBroadcastRequests = async (): Promise<number> => {
    const result = await BroadcastRequest.updateMany(
        {
            status: BROADCAST_STATUS.PENDING as BroadcastStatus,
            expiry_time: { $lte: new Date() }
        },
        {
            status: BROADCAST_STATUS.EXPIRED as BroadcastStatus
        }
    );

    return result.modifiedCount;
};

/**
 * Get active conversations for a user (student or teacher)
 */
const getActiveConversations = async (userId: string, role: string): Promise<IBroadcastRequest[]> => {
    const query: any = {
        status: BROADCAST_STATUS.ACCEPTED as BroadcastStatus
    };

    if (role === USER_ROLE.student) {
        query.student_id = new Types.ObjectId(userId);
    } else if (role === USER_ROLE.teacher) {
        query.accepted_by = new Types.ObjectId(userId);
    }

    const conversations = await BroadcastRequest.find(query)
        .sort({ updatedAt: -1 });

    // Get the other participant's details
    const populatedConversations = await Promise.all(
        conversations.map(async (conversation) => {
            let participant;

            if (role === USER_ROLE.student) {
                const teacher = await Teacher.findOne({
                    user_id: conversation.accepted_by
                }).select('name');

                participant = teacher;
            } else {
                const student = await Student.findOne({
                    user_id: conversation.student_id
                }).select('name');

                participant = student;
            }

            // Get the last message
            const lastMessage = await ChatMessage.findOne({
                conversation_id: conversation.conversation_id
            })
                .sort({ createdAt: -1 })
                .limit(1);

            return {
                ...conversation.toObject(),
                participant,
                lastMessage
            };
        })
    );

    return populatedConversations;
};

/**
 * Store a chat message
 */
const storeMessage = async (message: Partial<IChatMessage>): Promise<IChatMessage> => {
    const newMessage = await ChatMessage.create(message);
    return newMessage;
};

/**
 * Get chat history for a conversation
 */
const getChatHistory = async (filters: IChatFilters): Promise<{ messages: IChatMessage[], total: number; }> => {
    const { conversation_id, sender_id, recipient_id, page = CHAT_PAGINATION.DEFAULT_PAGE, limit = CHAT_PAGINATION.DEFAULT_LIMIT } = filters;

    const query: any = {};

    if (conversation_id) {
        query.conversation_id = conversation_id;
    }

    if (sender_id && recipient_id) {
        query.$or = [
            { sender_id, recipient_id },
            { sender_id: recipient_id, recipient_id: sender_id }
        ];
    }

    const skip = (page - 1) * limit;
    const limitValue = Math.min(Number(limit), CHAT_PAGINATION.MAX_LIMIT);

    const [messages, total] = await Promise.all([
        ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitValue),
        ChatMessage.countDocuments(query)
    ]);

    return {
        messages: messages.reverse(), // Return in chronological order
        total
    };
};

/**
 * Mark messages as read
 */
const markMessagesAsRead = async (conversation_id: string, user_id: string): Promise<number> => {
    const result = await ChatMessage.updateMany(
        {
            conversation_id,
            recipient_id: user_id,
            read: false
        },
        {
            read: true
        }
    );

    return result.modifiedCount;
};

/**
 * Get unread message count for a user
 */
const getUnreadMessageCount = async (user_id: string): Promise<{ total: number, conversations: any[]; }> => {
    const unreadMessages = await ChatMessage.aggregate([
        {
            $match: {
                recipient_id: new Types.ObjectId(user_id),
                read: false
            }
        },
        {
            $group: {
                _id: '$conversation_id',
                count: { $sum: 1 },
                lastMessage: { $last: '$$ROOT' }
            }
        }
    ]);

    const total = unreadMessages.reduce((sum, item) => sum + item.count, 0);

    return {
        total,
        conversations: unreadMessages
    };
};

/**
 * Get student's active broadcast requests
 */
const getStudentActiveBroadcasts = async (studentId: string): Promise<IBroadcastRequest[]> => {
    const broadcasts = await BroadcastRequest.find({
        student_id: studentId,
        status: BROADCAST_STATUS.PENDING as BroadcastStatus,
        expiry_time: { $gt: new Date() }
    })
        .sort({ createdAt: -1 });

    return broadcasts;
};

export const chatService = {
    createBroadcastRequest,
    getPendingBroadcastRequests,
    acceptBroadcastRequest,
    declineBroadcastRequest,
    markExpiredBroadcastRequests,
    getActiveConversations,
    storeMessage,
    getChatHistory,
    markMessagesAsRead,
    getUnreadMessageCount,
    getStudentActiveBroadcasts
};