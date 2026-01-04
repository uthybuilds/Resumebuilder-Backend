import express from "express";
import {
  getUserResumes,
  loginUser,
  registerUser,
  devResetPassword,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getUserById,
} from "../controllers/userController.js";
import protect from "../middlewares/authMiddleware.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/verify-email", verifyEmail);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.post("/dev-reset-password", devResetPassword);
userRouter.get("/data", protect, getUserById);
userRouter.get("/resumes", protect, getUserResumes);

export default userRouter;
