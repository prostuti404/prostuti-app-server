import express from "express";
import auth from "../../middlewares/auth";
import { SubscriptionController } from "./subscription.controller";

const router = express.Router();

router.get("/plans",SubscriptionController.getSubscriptionPlans)
router.get("/all-subscription",auth(),SubscriptionController.getAllSubscriptions)
router.get("/:id",auth(),SubscriptionController.getSubscriptionByID)

export const SubscriptionRoute = router;