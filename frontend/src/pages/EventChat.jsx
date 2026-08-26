import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Chat as ChatIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getEventDisplayTitle } from '../utils/eventTitle';
import { isEventLocked, EVENT_LOCKED_MESSAGE } from '../utils/eventLock';
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

function parseAddsCommand(content) {
  const trimmed = (content || '').trim();
  if (trimmed === '/adds') return { isAdds: true, title: '' };
  const match = trimmed.match(/^\/adds\s+(.+)$/s);
  if (match) return { isAdds: true, title: match[1].trim() };
  return { isAdds: false, title: '' };
}

function EventChat() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const currentUserId = user?.id || user?._id;
  const currentUserPhoto = user?.profilePhotoUrl;

  const [eventData, setEventData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageIdsRef = useRef(new Set());

  const isLocked = isEventLocked(eventData, user);
  const eventTitle = getEventDisplayTitle(eventData) || 'Event';

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

    const load = async () => {
      try {
        setLoading(true);
        setChatError('');
        const [msgRes, eventRes] = await Promise.all([
          api.get(`/events/${eventId}/messages`),
          api.get(`/events/${eventId}`),
        ]);
        if (cancelled) return;
        setEventData(eventRes.data);
        messageIdsRef.current.clear();
        const list = (msgRes.data?.messages || []).map((m) => {
          const n = normalizeMessage(m, currentUserId, currentUserPhoto);
          messageIdsRef.current.add(n._id);
          return n;
        });
        setMessages(list);
      } catch (err) {
        if (!cancelled) {
          setChatError(
            err?.response?.data?.message || 'Failed to load event chat'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      'https://wplanner-j7a7.onrender.com';
    const socket = io(socketUrl, {
      path: '/socket.io',
      query: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinRoom', { eventId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('newMessage', (msg) => {
      appendMessage(msg);
    });

    socket.on('error', (payload) => {
      setChatError(payload?.message || 'Could not connect to chat');
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [eventId, appendMessage, currentUserId, currentUserPhoto]);

  const openAddSong = (title = '') => {
    const q = new URLSearchParams();
    q.set('openAddSong', '1');
    if (title) q.set('addSongTitle', title);
    navigate(`/events/${eventId}?${q.toString()}`);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (isLocked || !text || sending) return;

    // Slash command: open Add Song UI on event page
    if (text === '/adds' || text.startsWith('/adds ')) {
      const title = text === '/adds' ? '' : text.replace(/^\/adds\s+/, '');
      openAddSong(title);
      setInput('');
      return;
    }

    try {
      setSending(true);
      setChatError('');
      const res = await api.post(`/events/${eventId}/messages`, {
        content: text,
      });
      appendMessage(res.data);
      setInput('');
    } catch (err) {
      setChatError(
        err?.response?.data?.message || 'Failed to send message'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <IconButton
          onClick={() => navigate(`/events/${eventId}`)}
          aria-label="Back to event"
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Event Chat
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {eventTitle}
          </Typography>
        </Box>
        <ChatIcon color="primary" />
      </Stack>

      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {EVENT_LOCKED_MESSAGE} You can still read past messages.
        </Alert>
      )}

      {chatError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setChatError('')}
        >
          {chatError}
        </Alert>
      )}

      <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: 'action.hover',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            Team conversation
          </Typography>
          <Typography
            variant="caption"
            color={connected ? 'success.main' : 'text.secondary'}
          >
            {connected ? 'Live' : 'Connecting…'}
          </Typography>
        </Box>

        <CardContent
          sx={{
            p: 0,
            height: { xs: '50vh', sm: 420 },
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
          }}
        >
          <Box sx={{ flex: 1, p: 2 }}>
            {messages.length === 0 ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  px: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No messages yet. Say hello to your team!
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {messages.map((msg) => {
                  const addsCmd = parseAddsCommand(msg.content);
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
                      sx={{ maxWidth: '85%' }}
                    >
                      <Avatar
                        src={resolveMediaUrl(msg.senderPhotoUrl)}
                        alt={msg.senderName}
                        sx={{
                          width: 28,
                          height: 28,
                          fontSize: '0.75rem',
                          bgcolor: 'primary.main',
                          flexShrink: 0,
                        }}
                      >
                        {msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            ml: msg.isOwn ? 0 : 0.5,
                            mr: msg.isOwn ? 0.5 : 0,
                            mb: 0.25,
                            display: 'block',
                            textAlign: msg.isOwn ? 'right' : 'left',
                          }}
                        >
                          {msg.senderName}
                        </Typography>
                        <Box
                          role={addsCmd.isAdds ? 'button' : undefined}
                          tabIndex={addsCmd.isAdds ? 0 : undefined}
                          onClick={
                            addsCmd.isAdds
                              ? () => openAddSong(addsCmd.title)
                              : undefined
                          }
                          onKeyDown={
                            addsCmd.isAdds
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openAddSong(addsCmd.title);
                                  }
                                }
                              : undefined
                          }
                          sx={{
                            px: 1.75,
                            py: 1.25,
                            borderRadius: 2.5,
                            bgcolor: msg.isOwn ? 'primary.main' : 'grey.900',
                            border: 'none',
                            boxShadow: 1,
                            ...(addsCmd.isAdds && {
                              cursor: 'pointer',
                              '&:hover': { filter: 'brightness(1.08)' },
                            }),
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: '#fff',
                            }}
                          >
                            {msg.content}
                          </Typography>
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            textAlign: msg.isOwn ? 'right' : 'left',
                            mt: 0.5,
                            px: 0.5,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  );
                })}
                <div ref={messagesEndRef} />
              </Stack>
            )}
          </Box>
        </CardContent>

        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              maxRows={3}
              size="small"
              placeholder={
                isLocked
                  ? 'Chat is locked for completed events'
                  : 'Type a message…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLocked || sending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      color="primary"
                      onClick={sendMessage}
                      disabled={isLocked || sending || !input.trim()}
                      aria-label="Send message"
                    >
                      <SendIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Press Enter to send · Shift+Enter for a new line
          </Typography>
        </Box>
      </Card>

      <Button
        variant="text"
        onClick={() => navigate(`/events/${eventId}`)}
        sx={{ mt: 2, textTransform: 'none' }}
      >
        Back to event details
      </Button>
    </Box>
  );
}

export default EventChat;
