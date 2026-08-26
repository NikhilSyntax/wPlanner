const mongoose = require('mongoose');
const Message = require('../models/Message');
const Event = require('../models/Event');
const Team = require('../models/Team');
const User = require('../models/User');
const { getIO } = require('../sockets/socketServer');
const { sendNotification } = require('../utils/notificationService');

/**
 * Safely extract the sender's userId string from the JWT-decoded req.user.
 * Returns a plain hex string like "6a8e8d4db801adfaa80c3b49".
 */
function getSenderId(reqUser) {
  const raw = reqUser.userId || reqUser._id || reqUser.id;
  return raw ? raw.toString() : '';
}

function serializeMessage(msg) {
  const doc = msg.toObject ? msg.toObject() : msg;
  const sender = doc.sender;
  return {
    _id: doc._id,
    content: doc.content,
    createdAt: doc.createdAt,
    type: doc.type,
    sender:
      sender && typeof sender === 'object'
        ? {
            _id: sender._id,
            name: sender.name,
            profilePhotoUrl: sender.profilePhotoUrl || null,
          }
        : sender,
    senderName:
      sender && typeof sender === 'object' ? sender.name || 'Unknown' : 'Unknown',
  };
}

// Get messages for an event (paginated)
exports.getMessages = async (req, res) => {
  try {
    const { eventId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ event: eventId })
      .populate('sender', 'name profilePhotoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ event: eventId });

    res.json({
      messages: messages.reverse().map(serializeMessage),
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a new message in Event Chat
exports.sendMessage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const senderIdStr = getSenderId(req.user);

    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const message = new Message({
      event: eventId,
      sender: senderIdStr,
      content,
      type: req.body?.type || 'text',
      fileUrl: req.body?.fileUrl,
      mentions: req.body?.mentions || [],
    });

    await message.save();
    await message.populate('sender', 'name profilePhotoUrl');

    const payload = serializeMessage(message);
    const io = getIO();
    if (io) {
      io.to(eventId).emit('newMessage', payload);
    }

    // Async push notifications to event roster members (EXCLUDING the sender)
    (async () => {
      try {
        const event = await Event.findById(eventId).select('event assignments team createdBy');
        if (event) {
          const eventTitle = event.event?.title || 'Worship Service';
          const senderName = message.sender?.name || 'Someone';
          const recipients = new Set();

          if (Array.isArray(event.assignments)) {
            for (const a of event.assignments) {
              const uid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
              if (uid && uid !== senderIdStr) recipients.add(uid);
            }
          }
          if (event.createdBy && event.createdBy.toString() !== senderIdStr) {
            recipients.add(event.createdBy.toString());
          }

          for (const uid of recipients) {
            if (uid && uid !== senderIdStr) {
              sendNotification({
                recipientId: uid,
                senderId: senderIdStr,
                type: 'chat_mention',
                title: `💬 ${senderName} (${eventTitle})`,
                message: content,
                link: `/events/${eventId}/chat`,
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('[EventChat] Notification dispatch error:', e.message);
      }
    })();

    res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages for a Team
exports.getTeamMessages = async (req, res) => {
  try {
    const { teamId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ team: teamId })
      .populate('sender', 'name profilePhotoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ team: teamId });

    res.json({
      messages: messages.reverse().map(serializeMessage),
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a new message in Team Chat
exports.sendTeamMessage = async (req, res) => {
  try {
    const { teamId } = req.params;
    const senderIdStr = getSenderId(req.user);

    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const message = new Message({
      team: teamId,
      sender: senderIdStr,
      content,
      type: req.body?.type || 'text',
      fileUrl: req.body?.fileUrl,
      mentions: req.body?.mentions || [],
    });

    await message.save();
    await message.populate('sender', 'name profilePhotoUrl');

    const payload = serializeMessage(message);
    const io = getIO();
    if (io) {
      io.to(`team_${teamId}`).emit('newMessage', payload);
    }

    // Async push notifications to all team members (EXCLUDING the sender)
    (async () => {
      try {
        const team = await Team.findById(teamId).select('team members');
        if (team) {
          const teamName = team.team?.name || 'Team';
          const senderName = message.sender?.name || 'Someone';

          if (Array.isArray(team.members)) {
            for (const m of team.members) {
              const uid = m.userId?._id ? m.userId._id.toString() : m.userId?.toString();
              if (uid && uid !== senderIdStr) {
                sendNotification({
                  recipientId: uid,
                  senderId: senderIdStr,
                  type: 'chat_mention',
                  title: `💬 ${senderName} (${teamName})`,
                  message: content,
                  link: `/teams/${teamId}/chat`,
                }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        console.warn('[TeamChat] Notification dispatch error:', e.message);
      }
    })();

    res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages for Church Roster Chat
exports.getChurchMessages = async (req, res) => {
  try {
    const churchId = req.user.churchId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ church: churchId })
      .populate('sender', 'name profilePhotoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ church: churchId });

    res.json({
      messages: messages.reverse().map(serializeMessage),
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a new message in Church Roster Chat
exports.sendChurchMessage = async (req, res) => {
  try {
    const churchId = req.user.churchId;
    const senderIdStr = getSenderId(req.user);

    console.log('[ChurchChat] senderId =', senderIdStr, '| churchId =', churchId);

    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const message = new Message({
      church: churchId,
      sender: senderIdStr,
      content,
      type: req.body?.type || 'text',
      fileUrl: req.body?.fileUrl,
      mentions: req.body?.mentions || [],
    });

    await message.save();
    await message.populate('sender', 'name profilePhotoUrl');

    const payload = serializeMessage(message);
    const io = getIO();
    if (io) {
      io.to(`church_${churchId}`).emit('newMessage', payload);
    }

    // Async push notifications to all OTHER approved church roster members (NEVER the sender)
    (async () => {
      try {
        // Convert to ObjectId so $ne matches correctly against _id (ObjectId field)
        let senderObjectId;
        try {
          senderObjectId = new mongoose.Types.ObjectId(senderIdStr);
        } catch (_) {
          senderObjectId = senderIdStr;
        }

        const members = await User.find({
          churchId,
          approvalStatus: 'approved',
          _id: { $ne: senderObjectId },
        }).select('_id name');

        console.log('[ChurchChat] Sender excluded:', senderIdStr, '| Notifying', members.length, 'members');

        const senderName = message.sender?.name || 'Someone';

        for (const m of members) {
          const uid = m._id.toString();
          // Belt-and-suspenders: double check uid is not the sender
          if (uid && uid !== senderIdStr) {
            console.log('[ChurchChat]   -> Notifying:', uid, m.name);
            sendNotification({
              recipientId: uid,
              senderId: senderIdStr,
              type: 'chat_mention',
              title: `💬 ${senderName} (Church Roster)`,
              message: content,
              link: `/teams?chat=open`,
            }).catch(() => {});
          } else {
            console.log('[ChurchChat]   -> SKIPPED (self):', uid, m.name);
          }
        }
      } catch (e) {
        console.warn('[ChurchChat] Notification dispatch error:', e.message);
      }
    })();

    res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a message (admin/team_leader only)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByIdAndDelete(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
