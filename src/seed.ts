import mongoose from 'mongoose';
import config from './app/config';
import { Category } from './app/modules/category/category.model';
import { Course } from './app/modules/courseManagement/course/course.model';
import { Student } from './app/modules/student/student.model';
import { Question } from './app/modules/question/question.model';
import { Flashcard } from './app/modules/flashcardManagement/flashcard/flashcard.model';
import { Quiz } from './app/modules/quiz/quiz.model';
import { Admin } from './app/modules/admin/admin.model';
import { Teacher } from './app/modules/teacher/teacher.model';
import { User } from './app/modules/user/user.model';

const seedCategories = [
    { group: 'Science', type: 'Academic', name: 'HSC 2027' },
    { group: 'Science', type: 'Academic', name: 'HSC 2028' },
    { group: 'Science', type: 'Academic', name: 'HSC 2029' },
    { group: 'Science', type: 'Admission', name: 'Medical' },
    { group: 'Science', type: 'Admission', name: 'Engineering' },
    { group: 'Science', type: 'Admission', name: 'University' },
    { group: 'Science', type: 'Admission', name: 'Agriculture' },

    { group: 'Arts', type: 'Academic', name: 'HSC 2027' },
    { group: 'Arts', type: 'Academic', name: 'HSC 2028' },
    { group: 'Arts', type: 'Academic', name: 'HSC 2029' },
    { group: 'Arts', type: 'Admission', name: 'University' },

    { group: 'Commerce', type: 'Academic', name: 'HSC 2027' },
    { group: 'Commerce', type: 'Academic', name: 'HSC 2028' },
    { group: 'Commerce', type: 'Academic', name: 'HSC 2029' },
    { group: 'Commerce', type: 'Admission', name: 'University' },
];

const seed = async () => {
    try {
        await mongoose.connect(config.database_url as string);
        console.log('Connected to Database');

        // Wipe all categories
        console.log('Wiping existing categories...');
        await Category.deleteMany({});
        
        // Drop existing indexes to remove old schema constraints
        console.log('Dropping old indexes...');
        try {
            await Category.collection.dropIndexes();
        } catch (err) {
            console.log('No indexes to drop or error dropping indexes', err);
        }

        // Wipe dependent models to prevent orphaning (Phase 4 requirement + safety)
        console.log('Wiping related models to prevent orphaning...');
        await Course.deleteMany({});
        await Student.deleteMany({});
        await Question.deleteMany({});
        await Flashcard.deleteMany({});
        await Quiz.deleteMany({});

        // Seed new categories
        console.log('Seeding 15 new categories...');
        await Category.insertMany(seedCategories);

        console.log('Categories seeded successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seed();
