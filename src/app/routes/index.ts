import { Router } from 'express';

import { questionPatternRoute } from '../modules/QuestionPattern/questionPattern.route';
import { adminRoute } from '../modules/admin/admin.route';
import { assignmentSubmissionRoute } from '../modules/assignmentSubmission/assignmentSubmission.route';
import { authRoute } from '../modules/auth/auth.route';
import { categoryRoute } from '../modules/category/category.route';
import { chatRoute } from '../modules/chat/chat.route';
import { assignmentRoute } from '../modules/courseManagement/assignment/assignment.route';
import { courseRoute } from '../modules/courseManagement/course/course.route';
import { lessonRoute } from '../modules/courseManagement/lesson/lesson.route';
import { noticeRoute } from '../modules/courseManagement/notice/notice.route';
import { recodedClassRoute } from '../modules/courseManagement/recodedClass/recodedClass.route';
import { resourceRoute } from '../modules/courseManagement/resource/resource.route';
import { RoutineRoute } from '../modules/courseManagement/routine/routine.route';
import { TestHistoryRoute } from '../modules/courseManagement/test-history/testHistory.route';
import { TestRoute } from '../modules/courseManagement/test/test.route';
import { courseReviewRoute } from '../modules/courseReview/courseReview.route';
import { editRequestRoute } from '../modules/editRequest/editRequest.route';
import { EnrolledCourseRoute } from '../modules/enrolledCourse/enrolledCourse.route';
import { favouriteQuestionRoute } from '../modules/favouriteQuestion/favouriteQuestion.route';
import { flashcardRoute } from '../modules/flashcardManagement/flashcard/flashcard.route';
import { LeaderBoardRoute } from '../modules/leaderboard/leaderboard.route';
import { notificationRoute } from '../modules/notification/notification.route';
import { PaymentRoute } from '../modules/payment/payment.route';
import { phonVerificationRoute } from '../modules/phoneVerification/phoneVerification.route';
import { ProgressRoute } from '../modules/progress/progress.route';
import { QuestionRoute } from '../modules/question/question.route';
import { quizRoute } from '../modules/quiz/quiz.route';
import { studentRoute } from '../modules/student/student.route';
import { studentNotificationRoute } from '../modules/studentNotification/studentNotification.route';
import { SubscriptionRoute } from '../modules/subscription/subscription.route';
import { teacherRoute } from '../modules/teacher/teacher.route';
import { teacherManagementRoute } from '../modules/teacherManagement/teacherManagement.route';
import { userRoute } from '../modules/user/user.route';
import { VoucherRoute } from '../modules/voucher/voucher.route';
import { analyticsRoute } from '../modules/analytics/analytics.route';
import { TeacherLogRoute } from '../modules/teacherLog/teacherLog.route';
import { RevenueRoute } from '../modules/revenue/revenue.route';
import { appConfigRoutes } from '../modules/appConfig/appConfig.route';
import { debugRoutes } from '../modules/debug/debug.route';

const globalRoute = Router();

const routes = [
    { path: '/student', route: studentRoute },
    { path: '/user', route: userRoute },
    { path: '/auth', route: authRoute },
    { path: '/phone-verification', route: phonVerificationRoute },
    { path: '/category', route: categoryRoute },
    { path: '/question', route: QuestionRoute },
    { path: '/teacher', route: teacherRoute },
    { path: '/favourite', route: favouriteQuestionRoute },
    { path: '/course', route: courseRoute },
    { path: '/recoded-class', route: recodedClassRoute },
    { path: '/notice', route: noticeRoute },
    { path: '/resource', route: resourceRoute },
    { path: '/assignment', route: assignmentRoute },
    { path: '/lesson', route: lessonRoute },
    { path: '/test', route: TestRoute },
    { path: '/test-history', route: TestHistoryRoute },
    { path: '/routine', route: RoutineRoute },
    { path: '/enroll-course', route: EnrolledCourseRoute },
    { path: '/payment', route: PaymentRoute },
    { path: '/subscription', route: SubscriptionRoute },
    { path: '/progress', route: ProgressRoute },
    { path: '/admin', route: adminRoute },
    { path: '/assignment-submission', route: assignmentSubmissionRoute },
    { path: '/voucher', route: VoucherRoute },
    { path: '/teacher-management', route: teacherManagementRoute },
    { path: '/leaderboard', route: LeaderBoardRoute },
    { path: '/flashcard', route: flashcardRoute },
    { path: '/chat', route: chatRoute },
    { path: '/notifications', route: notificationRoute },
    { path: '/edit-requests', route: editRequestRoute },
    { path: '/course-review', route: courseReviewRoute },
    { path: '/student-notification', route: studentNotificationRoute },
    { path: '/quiz', route: quizRoute },
    { path: '/question-pattern', route: questionPatternRoute },
    { path: '/analytics', route: analyticsRoute },
    { path: '/teacher-log', route: TeacherLogRoute },
    {path: '/revenue-management', route: RevenueRoute },
    { path: '/config', route: appConfigRoutes },
    { path: '/test', route: debugRoutes },
];

routes.forEach((route) => globalRoute.use(route.path, route.route));

export default globalRoute;
