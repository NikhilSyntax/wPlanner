const Team = require('../models/Team');
const User = require('../models/User');

// List all teams (simple view for UI dropdowns)
exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find({ churchId: req.user.churchId })
      .select('team members')
      .populate('members.userId', 'name role');
    res.json(teams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single team by ID
exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate(
      'members.userId',
      'name email role'
    );
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new team (admin only)
exports.createTeam = async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const team = new Team({
      churchId: req.user.churchId,
      team: { name, description, type },
      createdBy: req.user.userId
    });
    await team.save();
    res.status(201).json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update existing team (admin only)
exports.updateTeam = async (req, res) => {
  try {
    const updates = req.body;
    const team = await Team.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a team (admin only)
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a user to a team (admin only)
exports.addMember = async (req, res) => {
  try {
    const { userId, roles } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!team.churchId?.equals(req.user.churchId)) {
      return res.status(403).json({ message: 'Cross-church access denied' });
    }

    const user = await User.findById(userId).select('churchId approvalStatus isAdmin role').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.churchId?.equals(req.user.churchId)) {
      return res.status(403).json({ message: 'User is not in your church' });
    }
    if (user.approvalStatus !== 'approved') {
      return res.status(400).json({ message: 'User is not approved yet' });
    }
    const roleStr = String(user.role || '').toLowerCase().trim();
    if (user.isAdmin || roleStr === 'admin') {
      return res.status(400).json({ message: 'Admins cannot be added into a team.' });
    }

    const alreadyMember = team.members.some(
      (m) => m.userId.toString() === userId.toString()
    );
    if (alreadyMember) {
      return res.status(400).json({ message: 'User already in team' });
    }

    team.members.push({
      userId,
      roles: Array.isArray(roles) ? roles : [],
      joinedAt: new Date(),
    });
    team.updatedAt = new Date();
    await team.save();

    const populated = await Team.findById(team._id).populate(
      'members.userId',
      'name email role'
    );
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
