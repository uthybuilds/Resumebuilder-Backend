import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Resume from "../models/Resume.js";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

const generateToken = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return token;
};
// POST: /api/users/register
// CONTROLLER FOR USER REGISTRATION
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // check if required field are present
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // check if user already exists
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      if (!user.isVerified) {
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const hashedVerificationToken = crypto
          .createHash("sha256")
          .update(verificationToken)
          .digest("hex");
        user.verificationToken = hashedVerificationToken;
        user.verificationTokenExpires = Date.now() + 30 * 60 * 1000;
        await user.save();

        const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
        const message = `Please click on the following link to verify your email address: ${verifyUrl} \n\nThis link expires in 30 minutes.`;
        try {
          await sendEmail({
            email: user.email,
            subject: "Verify your email address",
            message,
            html: `<p>Please click on the following link to verify your email address:</p><a href="${verifyUrl}">${verifyUrl}</a><p>This link expires in 30 minutes.</p>`,
          });
          return res.status(200).json({
            message: "Account exists but not verified. Verification email resent.",
          });
        } catch (error) {
          return res.status(500).json({
            message: "Email could not be sent. Please try again later.",
          });
        }
      }
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      verificationToken: hashedVerificationToken,
      verificationTokenExpires: Date.now() + 30 * 60 * 1000, // 30 minutes
      isVerified: false,
    });

    // Send verification email
    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    const message = `Please click on the following link to verify your email address: ${verifyUrl} \n\nThis link expires in 30 minutes.`;

    try {
      await sendEmail({
        email: newUser.email,
        subject: "Verify your email address",
        message,
        html: `<p>Please click on the following link to verify your email address:</p><a href="${verifyUrl}">${verifyUrl}</a><p>This link expires in 30 minutes.</p>`,
      });
      return res.status(201).json({
        message:
          "User created. Verification email sent.",
        verifyUrl,
      });
    } catch (error) {
      // Email failed, keep the account and provide direct verification URL fallback
      return res.status(201).json({
        message:
          "Verification email could not be sent. Redirecting you to verify now.",
        verifyUrl,
      });
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// POST: /api/users/verify-email
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST: /api/users/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Please provide an email" });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      // Do not reveal if user exists
      return res.status(200).json({
        message: "Password reset link sent if the email exists.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordTokenExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const message = `You requested a password reset. Please click on the following link to reset your password: ${resetUrl} \n\nThis link expires in 30 minutes.`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset Request",
        message,
        html: `<p>You requested a password reset. Please click on the following link to reset your password:</p><a href="${resetUrl}">${resetUrl}</a><p>This link expires in 30 minutes.</p>`,
      });
      return res.status(200).json({
        message: "Password reset link sent if the email exists.",
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordTokenExpires = undefined;
      await user.save();
      return res.status(500).json({ message: "Email could not be sent" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST: /api/users/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


// DEV-ONLY: reset user password without login
// POST: /api/users/dev-reset-password
export const devResetPassword = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Not allowed in production" });
    }
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and newPassword required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// controller for user login
// POST: /api/users/login

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // check if password is correct
    if (!user.comparePassword(password)) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "Please verify your email address" });
    }

    // return success message
    const token = generateToken(user._id);
    user.password = undefined;

    return res.status(200).json({ message: "Login succesful", token, user });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// controller for getting user by id
// GET: /api/user/data
export const getUserById = async (req, res) => {
  try {
    const userId = req.userId;
    // check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // return user
    user.password = undefined;
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// controller for getting the user resumes
// GET: /api/user/resume

export const getUserResumes = async (req, res) => {
  try {
    const userId = req.userId;
    // return user resumes
    const resumes = await Resume.find({ userId });
    return res.status(200).json({ resumes });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
