import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoutes.js";
import resumeRouter from "./routes/resumeRoutes.js";
import aiRouter from "./routes/aiRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

//  Database connection
await connectDB();

app.use(express.json());
app.use(cors());

if (!process.env.RESEND_API_KEY) {
  console.log("RESEND_API_KEY not set");
}
if (!process.env.FROM_EMAIL) {
  console.log("FROM_EMAIL not set");
}

app.get("/", (req, res) => res.send("server is live..."));
app.use("/api/users", userRouter);
app.use("/api/resumes", resumeRouter);
app.use("/api/ai", aiRouter);

app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});
