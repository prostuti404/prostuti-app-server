import express from 'express';
import { FlashcardController } from './flashcard.controller';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { FlashcardValidation } from './flashcard.validation';
import checkAssignedWork from '../../../middlewares/checkAssignedWork ';



const router = express.Router();

router.post('/create-flashcard',auth("student"),validateRequest(FlashcardValidation.createFlashcard), FlashcardController.createFlashcard)
router.get('/all-flashcard',auth(), FlashcardController.getAllFlashcards)
router.get('/single-flashcard/:id',auth(), FlashcardController.getFlashcardByID)
router.get("/favorite-flashcard-items",auth("student"),FlashcardController.getFavoriteFlashcardItems)
router.patch('/update-flashcard/:id',auth(),validateRequest(FlashcardValidation.updateFlashcard), FlashcardController.updateFlashcard);
router.patch('/approve-flashcard/:id',auth("admin", "teacher"),checkAssignedWork("Flashcard"), FlashcardController.approveFlashcardByID)
router.delete('/delete-flashcard-item/:id',auth(), FlashcardController.deleteFlashcardByID)
router.patch('/swipe-flashcard-item/:id',auth("student"),validateRequest(FlashcardValidation.swipeFlashcardItemSchema), FlashcardController.SwipeFlashcardItemByID)
router.patch("/favorite-flashcard-item/:id",auth("student"), FlashcardController.favoriteFlashcardByID)


export const flashcardRoute = router;
