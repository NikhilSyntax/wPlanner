const Message = require('../models/Message');
const { getIO } = require('../sockets/socketServer');

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

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const message = new Message({
      event: eventId,
      sender: req.user.userId,
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
