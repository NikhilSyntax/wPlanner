const User = require("../models/User");

// Return minimal user list for UI dropdowns
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({
      churchId: req.user.churchId,
      approvalStatus: "approved",
    })
      .select("name email role")
      .lean();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload profile photo
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Check file size (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 5MB limit" });
    }

    // Validate file type
    const allowedMimes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Invalid file type. Only JPG, PNG, and GIF allowed" });
    }

    // Construct the file URL - use the relative path from the uploads directory
    const profilePhotoUrl = `/uploads/${req.file.filename}`;

    console.log("Uploading profile photo for user:", req.user.userId);
    console.log("File saved as:", req.file.filename);
    console.log("Profile photo URL:", profilePhotoUrl);

    // Update user with new profile photo URL
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profilePhotoUrl },
      { new: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User updated successfully with profile photo");

    res.json({
      message: "Profile photo updated successfully",
      profilePhotoUrl: user.profilePhotoUrl,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (err) {
    console.error("Error uploading profile photo:", err);
    res.status(500).json({ message: "Failed to upload profile photo" });
  }
};
