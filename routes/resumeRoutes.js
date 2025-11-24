import express from "express";
import protect from "../middlewares/authMiddleware.js";
import {
  createUserResume,
  deleteResume,
  getPublicResumeById,
  getResumeById,
  updateResume,
} from "../controllers/resumeController.js";
import upload from "../configs/multer.js";

const resumeRouter = express.Router();
resumeRouter.post("/create", protect, createUserResume);
resumeRouter.put("/update", upload.single("image"), protect, updateResume);
resumeRouter.delete("/delete/:resumeId", protect, deleteResume);
resumeRouter.get("/get/:resumeId", protect, getResumeById);
resumeRouter.get("/public/:resumeId", getPublicResumeById);

export default resumeRouter;
