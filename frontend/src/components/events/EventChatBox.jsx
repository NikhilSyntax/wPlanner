import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  Stack,
  CircularProgress,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Send as SendIcon,
  OpenInNew as OpenInNewIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import api, { API_ORIGIN } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';

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
    _id: msg?._id || `${senderId}-${msg?.createdAt || Date.now()}`,
    content: msg?.content || msg?.message || '',
    createdAt: msg?.createdAt || new Date().toISOString(),
    senderId: String(senderId),
    senderName,
    senderPhotoUrl,
    isOwn,
  };
}

export default function EventChatBox({ eventId, isLocked = false, maxHeight = 340 }) {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const currentUserId = user?.id || user?._id;
  const currentUserPhoto = user?.profilePhotoUrl;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageIdsRef = useRef(new Set());

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

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('accessToken');
    if (!eventId) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/events/${eventId}/messages`);
        if (cancelled) return;
        messageIdsRef.current.clear();
        const list = (res.data?.messages || []).map((m) => {
          const n = normalizeMessage(m, currentUserId, currentUserPhoto);
          messageIdsRef.current.add(n._id);
          return n;
        });
        setMessages(list);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load chat');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMessages();

    const socket = io(API_ORIGIN, {
      path: '/socket.io',
      query: { token },
      headers: { Authorization: `Bearer ${token}` },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinRoom', { eventId });
    });

    socket.on('connect_error', (err) => {
      console.warn('Chat socket connect error:', err?.message);
      setConnected(false);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('newMessage', (msg) => {
      appendMessage(msg);
    });

    socket.on('error', (payload) => {
      setError(payload?.message || 'Chat socket connection issue');
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [eventId, appendMessage, currentUserId, currentUserPhoto]);

  const handleSendMessage = async () => {
    const text = input.trim();
    if (isLocked || !text || sending) return;

    try {
      setSending(true);
      setError('');
      const res = await api.post(`/events/${eventId}/messages`, {
        content: text,
      });
      appendMessage(res.data);
      setInput('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        mt: 2.5,
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(255, 77, 40, 0.25)'
            : 'rgba(255, 77, 40, 0.18)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 4px 20px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? '#141414' : '#fafafa',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <ChatIcon sx={{ color: '#ff4d28', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.98rem' }}>
            Event Chat
          </Typography>
          <Chip
            icon={<CircleIcon sx={{ fontSize: '8px !important', color: connected ? '#10b981' : '#9ca3af' }} />}
            label={connected ? 'Live' : 'Connecting'}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 700,
              bgcolor: connected ? 'rgba(16, 185, 129, 0.1)' : 'action.hover',
              color: connected ? '#10b981' : 'text.secondary',
              pl: 0.5,
            }}
          />
        </Box>

        <Tooltip title="Expand Full Page Chat" arrow>
          <IconButton
            size="small"
            onClick={() => navigate(`/events/${eventId}/chat`)}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: '#ff4d28' },
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ m: 1.5, py: 0.5, fontSize: '0.78rem' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Messages Container */}
      <CardContent
        sx={{
          p: 2,
          height: maxHeight,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? '#0d0d0d' : '#fcfcfc',
        }}
      >
        {loading ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={24} sx={{ color: '#ff4d28' }} />
          </Box>
        ) : messages.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 2,
            }}
          >
            <ChatIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
              No messages yet.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem', mt: 0.5 }}>
              Say hello or coordinate service cues with your team!
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {messages.map((msg) => {
              const senderInitials = msg.senderName?.charAt(0)?.toUpperCase() || '?';
              const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <Box
                  key={msg._id}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.isOwn ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="flex-end"
                    sx={{ maxWidth: '88%' }}
                  >
                    {!msg.isOwn && (
                      <Avatar
                        src={resolveMediaUrl(msg.senderPhotoUrl)}
                        alt={msg.senderName}
                        sx={{
                          width: 26,
                          height: 26,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          bgcolor: '#ff4d28',
                          flexShrink: 0,
                          mb: 0.25,
                        }}
                      >
                        {senderInitials}
                      </Avatar>
                    )}

                    <Box sx={{ maxWidth: '100%' }}>
                      {!msg.isOwn && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            ml: 0.5,
                            mb: 0.25,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#ffffff',
                          }}
                        >
                          {msg.senderName}
                        </Typography>
                      )}

                      <Box
                        sx={{
                          px: 1.75,
                          py: 1,
                          borderRadius: msg.isOwn
                            ? '14px 14px 2px 14px'
                            : '14px 14px 14px 2px',
                          bgcolor: msg.isOwn ? '#10b981' : '#ff4d28',
                          color: '#ffffff',
                          boxShadow: msg.isOwn
                            ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                            : '0 2px 8px rgba(255, 77, 40, 0.3)',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '0.84rem',
                            lineHeight: 1.45,
                            color: '#ffffff',
                            fontWeight: 500,
                          }}
                        >
                          {msg.content}
                        </Typography>
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          textAlign: msg.isOwn ? 'right' : 'left',
                          mt: 0.35,
                          px: 0.5,
                          fontSize: '0.68rem',
                          color: 'rgba(255, 255, 255, 0.75)',
                          fontWeight: 500,
                        }}
                      >
                        {timeStr}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Stack>
        )}
      </CardContent>

      {/* Input area */}
      <Box
        sx={{
          p: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? '#141414' : '#fafafa',
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder={
            isLocked
              ? 'Chat locked for completed events'
              : 'Message worship team…'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLocked || sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSendMessage}
                  disabled={isLocked || sending || !input.trim()}
                  size="small"
                  sx={{
                    color: '#10b981',
                    '&.Mui-disabled': { color: 'text.disabled' },
                  }}
                  aria-label="Send message"
                >
                  {sending ? (
                    <CircularProgress size={16} sx={{ color: '#10b981' }} />
                  ) : (
                    <SendIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              fontSize: '0.84rem',
              color: '#ffffff',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? '#0d0d0d' : '#1e1e1e',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255, 255, 255, 0.55)',
              opacity: 1,
            },
          }}
        />
      </Box>
    </Card>
  );
}
