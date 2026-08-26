import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Chat as ChatIcon,
  Send as SendIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import api, { API_ORIGIN } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { resolveMediaUrl } from '../utils/mediaUrl';

function normalizeMessage(msg, currentUserId, currentUserPhoto) {
  const sender = msg?.sender;
  const senderId =
    (typeof sender === 'object' ? sender?._id : sender) || msg?.userId || '';
  const senderName =
    (typeof sender === 'object' ? sender?.name : null) ||
    msg?.senderName ||
    'Unknown';
  const isOwn = String(senderId) === String(currentUserId);
  const senderPhotoUrl =
    (typeof sender === 'object' ? sender?.profilePhotoUrl : null) ||
    msg?.senderPhotoUrl ||
    (isOwn ? currentUserPhoto : null);
  return {
    _id: msg?._id || `${senderId}-${msg?.createdAt}`,
    content: msg?.content || msg?.message || '',
    createdAt: msg?.createdAt || new Date().toISOString(),
    senderId: String(senderId),
    senderName,
    senderPhotoUrl,
    isOwn,
  };
}

function TeamChat() {
  const { id: teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const currentUserId = user?.id || user?._id;
  const currentUserPhoto = user?.profilePhotoUrl;

  const [teamData, setTeamData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageIdsRef = useRef(new Set());

  const teamName = teamData?.team?.name || 'Team Chat';

  const appendMessage = useCallback(
    (raw) => {
      const normalized = normalizeMessage(raw, currentUserId, currentUserPhoto);
      if (messageIdsRef.current.has(normalized._id)) return;
      messageIdsRef.current.add(normalized._id);
      setMessages((prev) => [...prev, normalized]);
    },
    [currentUserId, currentUserPhoto]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load team info and initial messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setChatError('');
        const [tRes, mRes] = await Promise.all([
          api.get(`/teams/${teamId}`),
          api.get(`/teams/${teamId}/team-messages`).catch(() =>
            api.get(`/teams/${teamId}/messages`)
          ),
        ]);
        if (cancelled) return;
        setTeamData(tRes.data);
        const list = mRes.data?.messages || [];
        messageIdsRef.current.clear();
        const norm = list.map((m) => {
          const n = normalizeMessage(m, currentUserId, currentUserPhoto);
          messageIdsRef.current.add(n._id);
          return n;
        });
        setMessages(norm);
      } catch (err) {
        if (!cancelled) {
          setChatError(
            err?.response?.data?.message || 'Could not load team chat.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, currentUserId, currentUserPhoto]);

  // Connect socket room
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !teamId) return;

    const socket = io(API_ORIGIN, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { token },
      headers: { Authorization: `Bearer ${token}` },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinTeam', { teamId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('newMessage', (msg) => {
      appendMessage(msg);
    });

    return () => {
      socket.disconnect();
    };
  }, [teamId, appendMessage]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    try {
      setSending(true);
      setChatError('');
      const res = await api.post(`/teams/${teamId}/team-messages`, {
        content: trimmed,
      }).catch(() => api.post(`/teams/${teamId}/messages`, { content: trimmed }));
      appendMessage(res.data);
      setInput('');
    } catch (err) {
      setChatError(err?.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        gap={1}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <IconButton onClick={() => navigate(`/teams/${teamId}`)} sx={{ p: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {teamName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Team Chat & Announcements
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            size="small"
            icon={<GroupsIcon sx={{ fontSize: '15px !important' }} />}
            label={`${teamData?.members?.length || 0} Members`}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            size="small"
            label={connected ? 'Live' : 'Connecting...'}
            color={connected ? 'success' : 'default'}
            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
          />
        </Box>
      </Box>

      {chatError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setChatError('')}>
          {chatError}
        </Alert>
      )}

      {/* Messages Card */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '70vh' }}>
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'background.default' : '#f8fafc',
            }}
          >
            {messages.length === 0 ? (
              <Box textAlign="center" my="auto" py={6} color="text.secondary">
                <ChatIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body1" fontWeight={600}>
                  No messages yet.
                </Typography>
                <Typography variant="caption">
                  Start the conversation with your team! Messages will notify members on their phones.
                </Typography>
              </Box>
            ) : (
              messages.map((m) => (
                <Box
                  key={m._id}
                  sx={{
                    display: 'flex',
                    flexDirection: m.isOwn ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: 1,
                  }}
                >
                  <Avatar
                    sx={{ width: 32, height: 32, fontSize: '0.85rem' }}
                    src={m.senderPhotoUrl ? resolveMediaUrl(m.senderPhotoUrl) : undefined}
                  >
                    {m.senderName?.charAt(0)?.toUpperCase() || 'U'}
                  </Avatar>

                  <Box sx={{ maxWidth: '75%' }}>
                    {!m.isOwn && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ display: 'block', mb: 0.25, ml: 1 }}
                      >
                        {m.senderName}
                      </Typography>
                    )}

                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        px: 2,
                        borderRadius: 3,
                        bgcolor: m.isOwn ? 'primary.main' : 'background.paper',
                        color: m.isOwn ? '#ffffff' : 'text.primary',
                        border: m.isOwn ? 'none' : '1px solid',
                        borderColor: 'divider',
                        boxShadow: m.isOwn
                          ? '0 2px 8px rgba(37, 99, 235, 0.25)'
                          : '0 1px 3px rgba(0,0,0,0.05)',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: m.isOwn ? '#ffffff !important' : 'text.primary',
                          fontWeight: 500,
                          lineHeight: 1.45,
                        }}
                      >
                        {m.content}
                      </Typography>
                    </Paper>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        mt: 0.35,
                        textAlign: m.isOwn ? 'right' : 'left',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        px: 0.5,
                      }}
                    >
                      {m.senderName} • {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Box */}
          <Box
            component="form"
            onSubmit={handleSend}
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder={`Message ${teamName}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                },
              }}
            />
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={!input.trim() || sending}
              endIcon={<SendIcon />}
              sx={{
                borderRadius: 3,
                px: 2.5,
                fontWeight: 700,
                textTransform: 'none',
                minWidth: 100,
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default TeamChat;
