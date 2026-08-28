const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Church = require("../models/Church");
const config = require("../config/config")();
const authConfig = require("../config/auth");
const { generateUniqueChurchCode } = require("../utils/churchUtils");

// Helper to generate both access and refresh tokens
async function generateTokens(user) {
  const accessToken = authConfig.createJWT(user);
  const refreshToken = authConfig.createRefreshToken(user);
  // Store refresh token in user document for revocation (keep recent 10 to avoid unbounded growth)
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(refreshToken);
  if (user.refreshTokens.length > 10) {
    user.refreshTokens = user.refreshTokens.slice(-10);
  }
  await user.save();
  return { accessToken, refreshToken };
}

// Register new user (email/password flow) with optional church join/create
exports.register = async (req, res) => {
  const { name, email, password, role, joinOrCreate, churchCode, churchName } =
    req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  try {
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Determine churchId based on joinOrCreate flag
    let churchId;
    let approvalStatus = "approved";
    let approvedAt = new Date();

    if (joinOrCreate === "join") {
      if (!churchCode)
        return res.status(400).json({ message: "Church code required" });
      const normalizedChurchCode = churchCode.trim().toUpperCase();
      const church = await Church.findOne({ churchCode: normalizedChurchCode });
      if (!church)
        return res.status(400).json({ message: "Invalid church code" });
      churchId = church._id;
      approvalStatus = "pending";
      approvedAt = undefined;
    } else if (joinOrCreate === "create") {
      if (role !== "Admin") {
        return res
          .status(400)
          .json({ message: "Only the Admin role can create a new church" });
      }
      if (!churchName)
        return res.status(400).json({ message: "Church name required" });
      const code = await generateUniqueChurchCode();
      const newChurch = await Church.create({
        name: churchName,
        churchCode: code,
        // createdBy will be set after user creation
      });
      churchId = newChurch._id;
    } else {
      return res.status(400).json({ message: "Invalid joinOrCreate value" });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const isNewChurchAdmin = joinOrCreate === "create";
    const newUser = new User({
      name,
      email: normalizedEmail,
      password: hash,
      role,
      isAdmin: isNewChurchAdmin,
      isSubAdmin: false,
      churchId,
      approvalStatus: isNewChurchAdmin ? "approved" : approvalStatus,
      approvedAt: isNewChurchAdmin ? new Date() : approvedAt,
      refreshTokens: [],
    });
    await newUser.save();

    // If church was just created, set its createdBy field
    if (joinOrCreate === "create") {
      await Church.findByIdAndUpdate(churchId, { createdBy: newUser._id });
    }

    const tokens = await generateTokens(newUser);
    res.status(201).json({
      user: {
        id: newUser._id,
        name,
        email,
        role,
        isAdmin: newUser.isAdmin,
        isSubAdmin: !!newUser.isSubAdmin,
        churchId,
        approvalStatus: newUser.approvalStatus,
        profilePhotoUrl: newUser.profilePhotoUrl,
      },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(400).json({
        message:
          "Email already exists or legacy duplicate index conflict. Please retry after server restart.",
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Email/password login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const identifier = email?.trim().toLowerCase();
  try {
    if (!identifier) {
      return res.status(400).json({ message: "Email or username is required" });
    }
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { email: `${identifier}@wplanner.app` },
        { name: new RegExp(`^${identifier}$`, "i") },
      ],
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });
    const tokens = await generateTokens(user);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        isSubAdmin: !!user.isSubAdmin,
        churchId: user.churchId,
        approvalStatus: user.approvalStatus,
        profilePhotoUrl: user.profilePhotoUrl,
      },
      ...tokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "-password -refreshTokens",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Refresh token endpoint
exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ message: "Missing refresh token" });
  try {
    const decoded = jwt.verify(refreshToken, config.secrets.refreshSecret);
    const user = await User.findById(decoded.userId);
    if (
      !user ||
      !user.refreshTokens ||
      !user.refreshTokens.includes(refreshToken)
    ) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }
    // Remove old token (rotate)
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    const newTokens = await generateTokens(user);
    res.json(newTokens);
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

// Logout – revoke refresh token
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ message: "Missing refresh token" });
  try {
    const decoded = jwt.verify(refreshToken, config.secrets.refreshSecret);
    const user = await User.findById(decoded.userId);
    if (user && user.refreshTokens) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
      await user.save();
    }
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: "Invalid token" });
  }
};

// OAuth callbacks placeholder – not yet updated for new schema
exports.oauthCallback = (provider) => async (req, res) => {
  // TODO: update for new user schema
  res.status(501).json({ message: "OAuth not implemented for new schema yet" });
};
