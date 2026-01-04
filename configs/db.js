import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => {
      console.log("Database connected successfully");
    });

    let mongodbURI = process.env.MONGODB_URI;
    const defaultDbName = "resume-builder";

    if (!mongodbURI) {
      throw new Error("MONGODB_URI enviroment variable not set");
    }
    const hasDbPath = /mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(mongodbURI);
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;

    await mongoose.connect(mongodbURI, hasDbPath ? {} : { dbName });
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
    throw error;
  }
};

export default connectDB;
