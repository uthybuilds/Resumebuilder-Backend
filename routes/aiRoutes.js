import express from "express";
import protect from "../middlewares/authMiddleware.js";
import {
  enhanceJobDescription,
  enhanceProfessionalSummary,
  uploadResume,
  searchUniversities,
  listUniversities,
} from "../controllers/aiControllers.js";

const aiRouter = express.Router();

aiRouter.post("/enhance-pro-sum", enhanceProfessionalSummary);
aiRouter.post("/enhance-job-desc", protect, enhanceJobDescription);
aiRouter.post("/upload-resume", protect, uploadResume);
aiRouter.get("/universities", searchUniversities);
aiRouter.get("/universities/all", listUniversities);

export default aiRouter;
