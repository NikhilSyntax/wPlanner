import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Avatar,
  Tooltip,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Chat as ChatIcon,
  MusicNote as MusicIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  NotificationsActive as NotificationsActiveIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  VolunteerActivism as VolunteerActivismIcon,
  HowToReg as HowToRegIcon,
  Tv as TvIcon,
  ManageAccounts as ManageAccountsIcon,
  Print as PrintIcon,
  Undo as UndoIcon,
  Mic as MicIcon,
  Piano as PianoIcon,
  Headphones as HeadphonesIcon,
  GraphicEq as GraphicEqIcon,
} from '@mui/icons-material';
import api, { apiUrl } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PrintSetlistModal from '../components/events/PrintSetlistModal';
import EventChatBox from '../components/events/EventChatBox';

const EVENT_ROLE_OPTIONS = [
  'Worship Leader',
  'Singer',
  'Guitarist',
  'Keyboardist',
  'Drummer',
  'Bassist',
  'Production',
  'Member',
  'Other',
];
import { getEventDisplayTitle } from '../utils/eventTitle';
import { isEventLocked, EVENT_LOCKED_MESSAGE } from '../utils/eventLock';
import { mergeSetlistWithBank, mergeSongWithBank, songsByIdMap } from '../utils/songDisplay';
import { getRecommendedSongs } from '../utils/songRecommendations';
import { fuzzySearchSongs } from '../utils/fuzzySearch';

const eventTypeColors = {
  service: 'primary',
  rehearsal: 'secondary',
  meeting: 'info',
  special: 'warning',
  other: 'default',
};

const statusColors = {
  draft: 'default',
  published: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const getInstrumentIcon = (role) => {
  const r = String(role || '').toLowerCase().trim();
  const sx = { fontSize: 13 };
  if (['singer', 'vocalist', 'vocals', 'worship leader', 'lead vocals', 'backing vocals'].some(k => r.includes(k)))
    return <MicIcon sx={{ ...sx, color: '#e91e63' }} />;
  if (['guitarist', 'guitar'].some(k => r.includes(k)))
    return <MusicIcon sx={{ ...sx, color: '#ff9800' }} />;
  if (['keyboardist', 'keyboard', 'piano', 'synth'].some(k => r.includes(k)))
    return <PianoIcon sx={{ ...sx, color: '#9c27b0' }} />;
  if (['drummer', 'drums', 'percussion'].some(k => r.includes(k)))
    return <GraphicEqIcon sx={{ ...sx, color: '#2196f3' }} />;
  if (['bassist', 'bass'].some(k => r.includes(k)))
    return <MusicIcon sx={{ ...sx, color: '#4caf50' }} />;
  if (['production', 'audio', 'sound', 'mixer'].some(k => r.includes(k)))
    return <HeadphonesIcon sx={{ ...sx, color: '#607d8b' }} />;
  if (['media', 'slides', 'visual'].some(k => r.includes(k)))
    return <TvIcon sx={{ ...sx, color: '#795548' }} />;
  return <MusicIcon sx={{ ...sx, color: '#9e9e9e' }} />;
};

function SongTitleWithTimeSignature({ title, timeSignature, prefix = '' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
      <Typography variant="body2" component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
        {prefix}{title}
      </Typography>
      {timeSignature ? (
        <Chip
          label={timeSignature}
          size="small"
          sx={{
            height: 19,
            fontSize: '0.6875rem',
            fontWeight: 700,
            bgcolor: 'action.hover',
            px: 0.2,
          }}
        />
      ) : null}
    </Box>
  );
}

function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const isFullAdmin = Boolean(
    user?.isAdmin ||
    user?.role === 'admin' ||
    user?.roles?.includes('admin')
  );
  const [event, setEvent] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unconfirmDialogOpen, setUnconfirmDialogOpen] = useState(false);
  const [songs, setSongs] = useState([]);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongKey, setNewSongKey] = useState('AUTO');
  const [addSongLoading, setAddSongLoading] = useState(false);
  const [addSongError, setAddSongError] = useState('');
  const [setlist, setSetlist] = useState([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  // ----- edit mode for title/description -----
  const [editMode, setEditMode] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event?.title || '');
  const [descDraft, setDescDraft] = useState(event?.description || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [memberUpdatingId, setMemberUpdatingId] = useState(null);
  const [revealedMemberIds, setRevealedMemberIds] = useState(new Set());
  const toggleMemberReveal = (memberId) => {
    setRevealedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  // ----- Volunteer Opt-In ("Available to Serve") State -----
  const [optInDialogOpen, setOptInDialogOpen] = useState(false);
  const [optInRole, setOptInRole] = useState(user?.role || 'Volunteer');
  const [optInNotes, setOptInNotes] = useState('');
  const [optInSubmitting, setOptInSubmitting] = useState(false);
  const [optInMessage, setOptInMessage] = useState('');
  const [optInError, setOptInError] = useState('');
  const [reviewingVolunteerId, setReviewingVolunteerId] = useState(null);

  // ----- Admin Change Event Role State -----
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMemberForRole, setSelectedMemberForRole] = useState(null);
  const [newAssignmentRole, setNewAssignmentRole] = useState('Member');
  const [newAssignmentNotes, setNewAssignmentNotes] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleUpdateError, setRoleUpdateError] = useState('');

  const handleOpenEditRoleDialog = (member) => {
    setSelectedMemberForRole(member);
    setNewAssignmentRole(member.role || 'Member');
    setNewAssignmentNotes(member.notes || '');
    setRoleUpdateError('');
    setRoleDialogOpen(true);
  };

  const handleCloseEditRoleDialog = () => {
    setSelectedMemberForRole(null);
    setRoleDialogOpen(false);
    setIsUpdatingRole(false);
    setRoleUpdateError('');
  };

  const handleSaveEventRole = async () => {
    if (!selectedMemberForRole) return;
    const memberUserId =
      selectedMemberForRole.userId?._id ||
      selectedMemberForRole.userId ||
      selectedMemberForRole._id;
    try {
      setIsUpdatingRole(true);
      setRoleUpdateError('');
      const res = await api.patch(`/events/${id}/assignments/${memberUserId}/role`, {
        role: newAssignmentRole,
        notes: newAssignmentNotes,
      });

      setEvent(res.data.event || res.data);
      if (res.data.event?.assignments) {
        setTeamMembers(res.data.event.assignments);
      } else {
        setTeamMembers((prev) =>
          prev.map((m) => {
            const uid = m.userId?._id || m.userId || m._id;
            return String(uid) === String(memberUserId)
              ? { ...m, role: newAssignmentRole, notes: newAssignmentNotes }
              : m;
          })
        );
      }
      handleCloseEditRoleDialog();
      setSaveMessage({
        type: 'success',
        text: `Updated role to "${newAssignmentRole}" for ${
          selectedMemberForRole.userId?.name || selectedMemberForRole.name || 'member'
        }!`,
      });
      setTimeout(() => setSaveMessage(''), 4500);
    } catch (err) {
      setRoleUpdateError(
        err?.response?.data?.message || 'Failed to update event role'
      );
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Auto-open volunteer opt-in modal if routed from notification contribute button
  useEffect(() => {
    if (searchParams.get('volunteer') === 'true' && !isFullAdmin) {
      setOptInDialogOpen(true);
      const updatedParams = new URLSearchParams(searchParams);
      updatedParams.delete('volunteer');
      setSearchParams(updatedParams, { replace: true });
    }
  }, [searchParams, isFullAdmin, setSearchParams]);

  const handleOptInSubmit = async () => {
    try {
      setOptInSubmitting(true);
      setOptInError('');
      const res = await api.post(`/events/${id}/opt-in`, {
        role: optInRole,
        notes: optInNotes,
      });
      setEvent(res.data.event || res.data);
      if (res.data.event?.assignments) {
        setTeamMembers(res.data.event.assignments);
      }
      setOptInDialogOpen(false);
      setOptInMessage('Thank you for volunteering! Church leaders have been notified.');
      setTimeout(() => setOptInMessage(''), 5000);
    } catch (err) {
      setOptInError(err?.response?.data?.message || 'Failed to volunteer for this service');
    } finally {
      setOptInSubmitting(false);
    }
  };

  const handleWithdrawOptIn = async () => {
    try {
      setOptInSubmitting(true);
      const res = await api.delete(`/events/${id}/opt-in`);
      setEvent(res.data.event || res.data);
      if (res.data.event?.assignments) {
        setTeamMembers(res.data.event.assignments);
      }
      setOptInMessage('Volunteer offer withdrawn.');
      setTimeout(() => setOptInMessage(''), 4000);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to withdraw');
    } finally {
      setOptInSubmitting(false);
    }
  };

  const handleReviewVolunteer = async (targetUserId, action, customRole) => {
    try {
      setReviewingVolunteerId(targetUserId);
      const res = await api.post(`/events/${id}/opt-in/${targetUserId}/review`, {
        action,
        role: customRole,
      });
      setEvent(res.data.event || res.data);
      if (res.data.event?.assignments) {
        setTeamMembers(res.data.event.assignments);
      }
      setOptInMessage(
        action === 'confirm'
          ? 'Volunteer successfully confirmed into the active team roster!'
          : 'Volunteer sign-up dismissed.'
      );
      setTimeout(() => setOptInMessage(''), 4000);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to review volunteer');
    } finally {
      setReviewingVolunteerId(null);
    }
  };

  const handleMemberStatusUpdate = async (member, targetStatus) => {
    try {
      const memberUserId = member.userId?._id || member.userId || member._id;
      const currentUserId = user?.id || user?._id;
      if (String(memberUserId) !== String(currentUserId)) {
        setError("You can only respond to your own assignment.");
        return;
      }
      await api.post(`/events/${id}/assignments/respond`, {
        status: targetStatus,
      });

      // Synchronize NotificationBell and Dashboard in real-time
      window.dispatchEvent(
        new CustomEvent('wplanner:assignment_updated', {
          detail: {
            eventId: id,
            status: targetStatus,
          },
        })
      );
      setTeamMembers((prev) =>
        prev.map((m) => {
          const uId = m.userId?._id || m.userId || m._id;
          return String(uId) === String(memberUserId)
            ? { ...m, status: targetStatus }
            : m;
        })
      );
      setSaveMessage({
        type: 'success',
        text:
          targetStatus === 'accepted'
            ? 'Your assignment is confirmed as Approved!'
            : 'Your assignment is marked as Not Available.',
      });
      setTimeout(() => setSaveMessage(''), 2500);
      await fetchEvent();
    } catch (err) {
      console.error('Failed to update member status:', err);
      setError(err?.response?.data?.message || 'Failed to update member status');
    } finally {
      setMemberUpdatingId(null);
    }
  };

  const handleAdminApprove = async (member) => {
    const memberUserId = member.userId?._id || member.userId || member._id;
    try {
      setTeamMembers((prev) =>
        prev.map((m) => {
          const uid = m.userId?._id || m.userId || m._id;
          return String(uid) === String(memberUserId) ? { ...m, status: 'accepted' } : m;
        })
      );
      await api.patch(`/events/${id}/assignments/${memberUserId}/role`, {
        role: member.role || 'Member',
        status: 'accepted',
      });
      setSaveMessage({ type: 'success', text: `${member.userId?.name || 'Member'} approved!` });
      setTimeout(() => setSaveMessage(''), 2500);
      await loadPageData(false);
    } catch (err) {
      console.error('Failed to approve member:', err);
      setError(err?.response?.data?.message || 'Failed to approve member');
      await loadPageData(false);
    }
  };

  const handleAdminRemove = async (member) => {
    const memberUserId = member.userId?._id || member.userId || member._id;
    try {
      setTeamMembers((prev) =>
        prev.filter((m) => {
          const uid = m.userId?._id || m.userId || m._id;
          return String(uid) !== String(memberUserId);
        })
      );
      await api.patch(`/events/${id}/assignments/${memberUserId}/role`, {
        role: member.role || 'Member',
        status: 'declined',
      });
      setSaveMessage({ type: 'info', text: `${member.userId?.name || 'Member'} removed from team.` });
      setTimeout(() => setSaveMessage(''), 2500);
      await loadPageData(false);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(err?.response?.data?.message || 'Failed to remove member');
      await loadPageData(false);
    }
  };

  const addSongTitleInputRef = useRef(null);
  const setlistCardRef = useRef(null);

  useEffect(() => {
    loadPageData(true);

    const handleAssignmentUpdate = () => {
      loadPageData(false);
    };

    window.addEventListener('wplanner:assignment_updated', handleAssignmentUpdate);
    return () => {
      window.removeEventListener('wplanner:assignment_updated', handleAssignmentUpdate);
    };
  }, [id]);

  const loadPageData = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      setError('');
      const [eventRes, songsRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get('/songs'),
      ]);
      const bankSongs = Array.isArray(songsRes.data)
        ? songsRes.data
        : songsRes.data.songs || [];
      setSongs(bankSongs);
      setEvent(eventRes.data);
      if (eventRes.data.assignments) {
        setTeamMembers(
          eventRes.data.assignments.filter((a) => {
            const userObj = a.userId || a.user || a.member || {};
            const r = String(userObj.role || a.role || '').toLowerCase().trim();
            if (userObj.isAdmin || r === 'admin') return false;
            return true;
          })
        );
      }
      setSetlist(
        mergeSetlistWithBank(eventRes.data.setlist || [], bankSongs)
      );
    } catch (err) {
      console.error(err);
      setError('Failed to load event details');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchSongs = async () => {
    try {
      const res = await api.get('/songs');
      const bankSongs = Array.isArray(res.data) ? res.data : res.data.songs || [];
      setSongs(bankSongs);
      setSetlist((prev) => mergeSetlistWithBank(prev, bankSongs));
    } catch (err) {
      console.error('Failed to load songs:', err);
    }
  };

  const fetchEvent = async () => {
    await loadPageData(false);
  };

  // Chat command: /adds -> open Add Song UI on event page
  useEffect(() => {
    const openAdd = searchParams.get('openAddSong') === '1';
    if (!openAdd || loading || !event) return;
    if (isEventLocked(event, user)) return;

    const title = searchParams.get('addSongTitle') || '';
    if (title) {
      setNewSongTitle(title);
    }

    requestAnimationFrame(() => {
      setlistCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      addSongTitleInputRef.current?.focus?.();
    });

    const next = new URLSearchParams(searchParams);
    next.delete('openAddSong');
    next.delete('addSongTitle');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, loading, event, user]);

  const handleDelete = async () => {
    try {
      await api.delete(`/events/${id}`);
      navigate('/events');
    } catch (err) {
      console.error(err);
      setError('Failed to delete event');
    }
    setDeleteDialogOpen(false);
  };

  const updateEventStatus = async (status, successText) => {
    const title = getEventDisplayTitle(event);
    const body = {
      event: {
        status,
        ...(title ? { title } : {}),
      },
    };
    if (status === 'completed' && setlist.length > 0) {
      body.setlist = setlist.map((s) => s._id);
    }
    await api.put(`/events/${id}`, body);
    setEvent((prev) => (prev ? { ...prev, event: { ...prev.event, status } } : prev));
    setSaveMessage({ type: 'success', text: successText });
    setTimeout(() => {
      fetchEvent();
      setSaveMessage('');
    }, 1500);
  };

  const handleConfirmEvent = async () => {
    try {
      await updateEventStatus('published', 'Event confirmed and published!');
    } catch (err) {
      console.error('Failed to confirm event:', err);
      setError('Failed to confirm event');
    }
  };

  const handleUnconfirmEvent = async () => {
    try {
      await updateEventStatus('draft', 'Event unconfirmed and set to draft.');
    } catch (err) {
      console.error('Failed to unconfirm event:', err);
      setError('Failed to unconfirm event');
    }
  };

  const handleMarkCompleted = async () => {
    try {
      await updateEventStatus(
        'completed',
        'Event marked as completed! Song usage updated.',
      );
    } catch (err) {
      console.error('Failed to mark as completed:', err);
      setError('Failed to mark event as completed');
    }
  };

  const handleUndoCompleted = async () => {
    try {
      await updateEventStatus('published', 'Event marked as confirmed again.');
    } catch (err) {
      console.error('Failed to undo completed:', err);
      setError('Failed to undo completed status');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!event) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Event not found</Alert>
      </Box>
    );
  }

  const eventInfo = event.event || {};
  const scheduleInfo = event.schedule || {};
  const teamInfo = event.team;
  const isLocked = isEventLocked(event, user);
  const canEdit = !isLocked;

  const currentUserId = user?.id || user?._id;
  const userRoleStr = String(user?.role || '').toLowerCase().trim();
  const isAdminUser = Boolean(
    user?.isAdmin ||
    userRoleStr === 'admin' ||
    user?.role === 'Admin' ||
    user?.roles?.some((r) => String(r).toLowerCase().trim() === 'admin')
  );

  const activeTeamMembers = teamMembers.filter((m) => {
    if (m.status === 'opt_in_pending') return false;
    const rawSt = m.status ? String(m.status).toLowerCase() : 'pending';
    if (rawSt === 'declined' || rawSt === 'rejected' || rawSt === 'not_available') return false;
    const userObj = m.userId || m.user || m.member || {};
    const r = String(userObj.role || m.role || '').toLowerCase().trim();
    if (userObj.isAdmin || r === 'admin') return false;
    return true;
  });

  const optedInVolunteers = teamMembers.filter((m) => {
    if (m.status !== 'opt_in_pending') return false;
    const userObj = m.userId || m.user || m.member || {};
    const r = String(userObj.role || m.role || '').toLowerCase().trim();
    if (userObj.isAdmin || r === 'admin') return false;
    return true;
  });

  const isUserInActiveRoster = !isAdminUser && activeTeamMembers.some((m) => {
    const uId = m.userId?._id ? String(m.userId._id) : String(m.userId || m._id || '');
    return uId && currentUserId && uId === String(currentUserId);
  });
  const userOptInAssignment = !isAdminUser
    ? optedInVolunteers.find((m) => {
        const uId = m.userId?._id ? String(m.userId._id) : String(m.userId || m._id || '');
        return uId && currentUserId && uId === String(currentUserId);
      })
    : null;
  const canOptIn = !isAdminUser && !isUserInActiveRoster && eventInfo.status !== 'completed' && eventInfo.status !== 'cancelled' && !isLocked;
  const isWorshipLeader =
    userRoleStr === 'worship leader' ||
    userRoleStr === 'worship_leader' ||
    userRoleStr === 'worshipleader' ||
    user?.roles?.some((r) =>
      ['worship leader', 'worship_leader', 'worshipleader'].includes(String(r).toLowerCase().trim())
    );

  const canReviewVolunteers = Boolean(
    user?.isAdmin ||
    user?.isSubAdmin ||
    userRoleStr === 'admin' ||
    userRoleStr === 'sub_admin' ||
    userRoleStr === 'subadmin' ||
    isWorshipLeader
  );

  const startDate = new Date(scheduleInfo.start);
  const endDate = new Date(scheduleInfo.end);
  const keyOptions = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  const songsById = songsByIdMap(songs);
  const recommendedSongs = getRecommendedSongs({
    songs,
    setlist,
    maxRecommendations: 3,
  });

  const handleQuickAddSong = async () => {
    const title = newSongTitle.trim();
    if (!title) {
      setAddSongError('Song title is required');
      return;
    }
    if (isLocked) {
      setAddSongError('Event is locked and cannot be modified');
      return;
    }
    try {
      setAddSongLoading(true);
      setAddSongError('');

      // Check if this song exists in the church songs bank (exact or close fuzzy match)
      const exactInBank = songs.find(
        (s) => (s.title || '').trim().toLowerCase() === title.toLowerCase()
      );
      const fuzzyMatches = fuzzySearchSongs(songs, title, 0.82);
      const existingInBank = exactInBank || (fuzzyMatches.length > 0 ? fuzzyMatches[0] : null);

      // If already present in current setlist, inform user and do not create duplicate
      if (
        existingInBank &&
        setlist.some((s) => String(s._id) === String(existingInBank._id))
      ) {
        setAddSongError(`"${existingInBank.title}" is already in this event's setlist.`);
        return;
      }

      let songToAdd = existingInBank;
      let isBrandNew = false;
      if (!songToAdd) {
        const res = await api.post('/songs', {
          title,
          key: newSongKey === 'AUTO' ? undefined : newSongKey,
          autoImport: true,
        });
        songToAdd = res.data?.song || res.data;
        isBrandNew = true;
      } else if (newSongKey !== 'AUTO' && newSongKey !== existingInBank.key) {
        const res = await api.put(`/songs/${existingInBank._id}`, { key: newSongKey });
        songToAdd = res.data?.song || res.data;
      }

      if (!songToAdd || !songToAdd._id) {
        throw new Error('Failed to create or retrieve song');
      }

      // Directly add to current setlist and immediately save to event in database
      const updatedSetlistIds = [
        ...setlist.map((s) => s._id),
        songToAdd._id,
      ];

      await api.put(`/events/${id}`, {
        setlist: updatedSetlistIds,
      });

      setNewSongTitle('');
      setNewSongKey('AUTO');
      await loadPageData(false);
      const isAutoImported = songToAdd?.source?.provider === 'ultimate_guitar';
      setSaveMessage({
        type: 'success',
        text: isBrandNew
          ? isAutoImported
            ? `"${songToAdd.title}" imported from Ultimate Guitar and added to setlist!`
            : `"${songToAdd.title || title}" created and added to setlist!`
          : `"${songToAdd.title || title}" added from song bank to setlist!`,
      });
      setTimeout(() => setSaveMessage(''), 3500);
    } catch (err) {
      console.error('Failed to add song:', err);
      setAddSongError(
        err?.response?.data?.message || 'Failed to add song. Try again.'
      );
    } finally {
      setAddSongLoading(false);
    }
  };

  const handleMoveSongUp = (idx) => {
    if (idx > 0) {
      const newSetlist = [...setlist];
      [newSetlist[idx], newSetlist[idx - 1]] = [
        newSetlist[idx - 1],
        newSetlist[idx],
      ];
      setSetlist(newSetlist);
    }
  };

  const handleMoveSongDown = (idx) => {
    if (idx < setlist.length - 1) {
      const newSetlist = [...setlist];
      [newSetlist[idx], newSetlist[idx + 1]] = [
        newSetlist[idx + 1],
        newSetlist[idx],
      ];
      setSetlist(newSetlist);
    }
  };

  const handleSongKeyChange = async (songId, newKey) => {
    if (isLocked) return;
    const applyKey = (list) =>
      list.map((s) => (String(s._id) === String(songId) ? { ...s, key: newKey } : s));
    setSetlist((prev) => applyKey(prev));
    setSongs((prev) => applyKey(prev));
    try {
      const res = await api.put(`/songs/${songId}`, { key: newKey });
      const updatedSong = res.data?.song || res.data;
      if (updatedSong && updatedSong._id) {
        setSongs((prev) =>
          prev.map((s) => (String(s._id) === String(songId) ? updatedSong : s))
        );
        setSetlist((prev) =>
          prev.map((s) =>
            String(s._id) === String(songId) ? { ...s, ...updatedSong } : s
          )
        );
      }
      setSaveMessage({
        type: 'success',
        text: `Key updated to Key ${newKey}!`,
      });
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update song key:', err);
      setSaveMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to update song key.',
      });
      await fetchSongs();
      await fetchEvent();
    }
  };

  const renderKeySelect = (song) =>
    canEdit ? (
      <FormControl size="small" sx={{ minWidth: 85 }}>
        <Select
          value={song.key || 'C'}
          onChange={(e) => handleSongKeyChange(song._id, e.target.value)}
          sx={{
            fontSize: '0.8125rem',
            height: 32,
            borderRadius: 1.5,
            bgcolor: 'background.paper',
            '& .MuiSelect-select': { py: 0.5, px: 1.2 },
          }}
        >
          {keyOptions.map((k) => (
            <MenuItem key={k} value={k} sx={{ fontSize: '0.8125rem' }}>
              Key: {k}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    ) : song.key ? (
      <Chip size="small" label={`Key: ${song.key}`} variant="outlined" sx={{ fontWeight: 600 }} />
    ) : null;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Aesthetic & Ergonomic Header Section */}
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          p: { xs: 2, sm: '14px 20px' },
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: { xs: 1.75, md: 2 },
        }}
      >
        {/* Left Side: Back Button + Title & Badges & Date */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.75,
            minWidth: 0,
          }}
        >
          <IconButton
            onClick={() => navigate('/events')}
            size="small"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
              flexShrink: 0,
            }}
            title="Back to Events"
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* Title & Status Chips Inline Row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                variant="h5"
                component="h1"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.25rem', sm: '1.45rem' },
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                }}
              >
                {getEventDisplayTitle(event) || 'Event Details'}
              </Typography>

              {eventInfo.type && (
                <Chip
                  label={
                    eventInfo.type.charAt(0).toUpperCase() +
                    eventInfo.type.slice(1)
                  }
                  size="small"
                  color={eventTypeColors[eventInfo.type] || 'default'}
                  variant="outlined"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    height: 22,
                    textTransform: 'capitalize',
                  }}
                />
              )}

              {(() => {
                const backendStatus = eventInfo.status || 'draft';
                const start = scheduleInfo.start
                  ? new Date(scheduleInfo.start)
                  : null;
                const end = scheduleInfo.end ? new Date(scheduleInfo.end) : null;
                const now = new Date();
                let display = backendStatus;
                if (backendStatus === 'draft') display = 'draft';
                else if (backendStatus === 'published') {
                  if (start && end) {
                    if (now < start) display = 'published';
                    else if (now >= start && now <= end) display = 'in_progress';
                    else if (now > end) display = 'completed';
                  } else display = 'published';
                }
                const label =
                  display === 'published'
                    ? 'Confirmed'
                    : display
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <Chip
                    label={label}
                    size="small"
                    color={statusColors[display] || 'default'}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      height: 22,
                    }}
                  />
                );
              })()}
            </Box>

            {/* Event Schedule Subtitle */}
            {scheduleInfo.start && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mt: 0.5,
                }}
              >
                <AccessTimeIcon
                  sx={{ fontSize: 14, color: 'text.secondary' }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.8rem', fontWeight: 500 }}
                >
                  {new Date(scheduleInfo.start).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {' • '}
                  {new Date(scheduleInfo.start).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {scheduleInfo.end && (
                    <>
                      {' - '}
                      {new Date(scheduleInfo.end).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </>
                  )}
                </Typography>
              </Box>
            )}

            {/* Event Description in Top Tab */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0.75,
                mt: 1,
              }}
            >
              <EventIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25, flexShrink: 0 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.8125rem',
                  lineHeight: 1.45,
                  fontStyle: eventInfo.description ? 'normal' : 'italic',
                }}
              >
                {eventInfo.description || 'No description provided.'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {isLocked && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {EVENT_LOCKED_MESSAGE}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Horizontal Event Actions Toolbar */}
      <Card
            sx={{
              borderRadius: 2.5,
              mb: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent
              sx={{
                p: '10px 14px !important',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  textTransform="uppercase"
                  letterSpacing="0.06em"
                  sx={{ fontSize: '0.7rem', mr: 0.5, display: { xs: 'none', sm: 'inline-block' } }}
                >
                  Actions:
                </Typography>

                {canEdit && (
                  <Tooltip title="Edit Event" arrow>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => navigate(`/events/${id}/edit`)}
                      sx={{
                        borderRadius: 1.75,
                        py: 0.5,
                        px: { xs: 0.85, sm: 1.25 },
                        minWidth: { xs: 32, sm: 'auto' },
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        height: 30,
                      }}
                    >
                      <EditIcon sx={{ fontSize: 16 }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                        Edit Event
                      </Box>
                    </Button>
                  </Tooltip>
                )}

                {isFullAdmin && event.event?.status === 'draft' && (
                  <Tooltip title="Confirm Event" arrow>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={handleConfirmEvent}
                      sx={{
                        borderRadius: 1.75,
                        py: 0.5,
                        px: { xs: 0.85, sm: 1.25 },
                        minWidth: { xs: 32, sm: 'auto' },
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        height: 30,
                      }}
                    >
                      <CheckCircleIcon sx={{ fontSize: 16 }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                        Confirm Event
                      </Box>
                    </Button>
                  </Tooltip>
                )}

                {isFullAdmin && event.event?.status === 'published' && (
                  <>
                    <Tooltip title="Unconfirm Event" arrow>
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={() => setUnconfirmDialogOpen(true)}
                        sx={{
                          borderRadius: 1.75,
                          py: 0.5,
                          px: { xs: 0.85, sm: 1.25 },
                          minWidth: { xs: 32, sm: 'auto' },
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textTransform: 'none',
                          height: 30,
                        }}
                      >
                        <UndoIcon sx={{ fontSize: 16 }} />
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                          Unconfirm Event
                        </Box>
                      </Button>
                    </Tooltip>
                    <Tooltip title="Mark Completed" arrow>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={handleMarkCompleted}
                        sx={{
                          borderRadius: 1.75,
                          py: 0.5,
                          px: { xs: 0.85, sm: 1.25 },
                          minWidth: { xs: 32, sm: 'auto' },
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textTransform: 'none',
                          height: 30,
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 16 }} />
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                          Mark Completed
                        </Box>
                      </Button>
                    </Tooltip>
                  </>
                )}

                {isFullAdmin && event.event?.status === 'completed' && (
                  <Tooltip title="Undo Completed" arrow>
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      onClick={handleUndoCompleted}
                      sx={{
                        borderRadius: 1.75,
                        py: 0.5,
                        px: { xs: 0.85, sm: 1.25 },
                        minWidth: { xs: 32, sm: 'auto' },
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        height: 30,
                      }}
                    >
                      <UndoIcon sx={{ fontSize: 16 }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                        Undo Completed
                      </Box>
                    </Button>
                  </Tooltip>
                )}

                {canOptIn && !userOptInAssignment && (
                  <Tooltip title="Volunteer to Serve" arrow>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => setOptInDialogOpen(true)}
                      sx={{
                        borderRadius: 1.75,
                        py: 0.5,
                        px: { xs: 0.85, sm: 1.25 },
                        minWidth: { xs: 32, sm: 'auto' },
                        fontSize: '0.78rem',
                        textTransform: 'none',
                        fontWeight: 600,
                        height: 30,
                        boxShadow: '0 2px 8px rgba(147, 51, 234, 0.25)',
                      }}
                    >
                      <VolunteerActivismIcon sx={{ fontSize: 16 }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                        Volunteer to Serve
                      </Box>
                    </Button>
                  </Tooltip>
                )}

                {userOptInAssignment && (
                  <Tooltip title="Withdraw Volunteer Offer" arrow>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleWithdrawOptIn}
                      disabled={optInSubmitting}
                      sx={{
                        borderRadius: 1.75,
                        py: 0.5,
                        px: { xs: 0.85, sm: 1.25 },
                        minWidth: { xs: 32, sm: 'auto' },
                        fontSize: '0.78rem',
                        textTransform: 'none',
                        fontWeight: 600,
                        height: 30,
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                        Withdraw Offer
                      </Box>
                    </Button>
                  </Tooltip>
                )}

                <Tooltip title={canEdit ? 'Edit Team' : 'View Team'} arrow>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate(`/events/${id}/team`)}
                    sx={{
                      borderRadius: 1.75,
                      py: 0.5,
                      px: { xs: 0.85, sm: 1.25 },
                      minWidth: { xs: 32, sm: 'auto' },
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      height: 30,
                    }}
                  >
                    <GroupIcon sx={{ fontSize: 16 }} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                      {canEdit ? 'Edit Team' : 'View Team'}
                    </Box>
                  </Button>
                </Tooltip>

                <Tooltip title="Open Chat" arrow>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate(`/events/${id}/chat`)}
                    sx={{
                      borderRadius: 1.75,
                      py: 0.5,
                      px: { xs: 0.85, sm: 1.25 },
                      minWidth: { xs: 32, sm: 'auto' },
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      height: 30,
                    }}
                  >
                    <ChatIcon sx={{ fontSize: 16 }} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                      Open Chat
                    </Box>
                  </Button>
                </Tooltip>

                {canEdit && (
                  <Tooltip title={reminderLoading ? 'Sending Reminder...' : 'Send Reminder'} arrow>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      onClick={async () => {
                        try {
                          setReminderLoading(true);
                          setReminderMessage('');
                          const token = localStorage.getItem('accessToken');
                          const res = await fetch(apiUrl(`/api/events/${id}/send-reminder`), {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setReminderMessage(data.message || 'Reminder sent!');
                            setTimeout(() => setReminderMessage(''), 4000);
                          } else {
                            alert(data.message || 'Failed to send reminder');
                          }
                        } catch (err) {
                          alert(err.message || 'Failed to send reminder');
                        } finally {
                          setReminderLoading(false);
                        }
                      }}
                      disabled={reminderLoading}
                      sx={{
                        borderRadius: 1.75,
                        py: 0.5,
                        px: { xs: 0.85, sm: 1.25 },
                        minWidth: { xs: 32, sm: 'auto' },
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        height: 30,
                      }}
                    >
                      <NotificationsActiveIcon sx={{ fontSize: 16 }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                        {reminderLoading ? 'Sending...' : 'Send Reminder'}
                      </Box>
                    </Button>
                  </Tooltip>
                )}

                {reminderMessage && (
                  <Alert severity="success" sx={{ py: 0, px: 1, fontSize: '0.75rem', height: 30, alignItems: 'center' }}>
                    {reminderMessage}
                  </Alert>
                )}
              </Box>

              {isFullAdmin && (
                <Tooltip title="Delete Event" arrow>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => setDeleteDialogOpen(true)}
                    sx={{
                      borderRadius: 1.75,
                      py: 0.5,
                      px: { xs: 0.85, sm: 1.25 },
                      minWidth: { xs: 32, sm: 'auto' },
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      height: 30,
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.6 }}>
                      Delete Event
                    </Box>
                  </Button>
                </Tooltip>
              )}
            </CardContent>
          </Card>

      {/* Main Content: Songs & Setlist (~70%) on Left, Team Members (~30%) on Right */}
      <Grid container spacing={2.5}>
        {/* Left Column: Songs & Setlist (70%) */}
        <Grid item xs={12} md={8} lg={8.4}>
          {/* Songs / Setlist */}
          <Card ref={setlistCardRef} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                mb={2.5}
                flexWrap="wrap"
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <MusicIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Songs & Setlist
                  </Typography>
                </Box>
                {setlist.length > 0 && (
                  <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<PrintIcon />}
                      onClick={() => setPrintModalOpen(true)}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                      }}
                    >
                      Print Set List
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<TvIcon />}
                      onClick={() => navigate(`/live/operator/${id}`)}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
                      }}
                    >
                      Present Live (TV)
                    </Button>
                  </Box>
                )}
              </Box>

              {saveMessage && (
                <Alert
                  severity={
                    saveMessage.type === 'success' ? 'success' : 'error'
                  }
                  onClose={() => setSaveMessage('')}
                  sx={{ mb: 2 }}
                >
                  {saveMessage.text}
                </Alert>
              )}

              {/* 1. Current Setlist Section (At the Top) */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  Current Setlist ({setlist.length} {setlist.length === 1 ? 'song' : 'songs'})
                </Typography>

                {setlist.length > 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      mb: 2.5,
                    }}
                  >
                    {setlist.map((song, idx) => {
                      const displaySong = mergeSongWithBank(song, songsById);
                      return (
                        <Paper
                          key={`${displaySong._id}-${idx}`}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1.5,
                            '&:hover': {
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          {/* Song Details Row */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(37, 99, 235, 0.1)',
                                color: 'primary.main',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <SongTitleWithTimeSignature
                                title={displaySong.title}
                                timeSignature={displaySong.timeSignature}
                              />
                              {displaySong.artist && (
                                <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.2 }}>
                                  {displaySong.artist}
                                </Typography>
                              )}
                            </Box>

                            {/* Mobile-only remove icon */}
                            {canEdit && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setSetlist(setlist.filter((_, i) => i !== idx))}
                                sx={{ display: { xs: 'inline-flex', sm: 'none' }, ml: 'auto' }}
                                title="Remove song"
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>

                          {/* Actions Toolbar */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                              justifyContent: { xs: 'space-between', sm: 'flex-end' },
                              borderTop: { xs: '1px solid', sm: 'none' },
                              borderColor: 'divider',
                              pt: { xs: 1, sm: 0 },
                            }}
                          >
                            {/* Key select */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {renderKeySelect(displaySong)}
                            </Box>

                            {/* Reorder Arrows */}
                            {canEdit && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  bgcolor: 'action.hover',
                                  borderRadius: 1.5,
                                  p: 0.25,
                                }}
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveSongUp(idx)}
                                  disabled={idx === 0}
                                  title="Move up"
                                  sx={{ p: 0.5 }}
                                >
                                  <ArrowUpwardIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveSongDown(idx)}
                                  disabled={idx === setlist.length - 1}
                                  title="Move down"
                                  sx={{ p: 0.5 }}
                                >
                                  <ArrowDownwardIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}

                            {/* Lyrics & Chords Viewer Buttons */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  navigate(
                                    `/events/${id}/setlist/${displaySong._id}?view=lyrics`
                                  )
                                }
                                sx={{
                                  fontSize: '0.75rem',
                                  py: 0.5,
                                  px: 1.2,
                                  borderRadius: 1.5,
                                  textTransform: 'none',
                                  height: 32,
                                }}
                              >
                                Lyrics
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  navigate(
                                    `/events/${id}/setlist/${displaySong._id}?view=chords`
                                  )
                                }
                                sx={{
                                  fontSize: '0.75rem',
                                  py: 0.5,
                                  px: 1.2,
                                  borderRadius: 1.5,
                                  textTransform: 'none',
                                  height: 32,
                                }}
                              >
                                Chords
                              </Button>
                            </Box>

                            {/* Desktop-only remove icon */}
                            {canEdit && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setSetlist(setlist.filter((_, i) => i !== idx));
                                }}
                                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                                title="Remove song from setlist"
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2.5 }}
                  >
                    No songs in setlist yet. Add songs using quick add or recommendations below.
                  </Typography>
                )}

                {canEdit && (
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={async () => {
                      try {
                        await api.put(`/events/${id}`, {
                          setlist: setlist.map((s) => s._id),
                        });
                        await loadPageData(false);
                        setSaveMessage({
                          type: 'success',
                          text: 'Setlist saved successfully!',
                        });
                        setTimeout(() => setSaveMessage(''), 3000);
                      } catch (err) {
                        console.error('Failed to save setlist:', err);
                        setSaveMessage({
                          type: 'error',
                          text:
                            err?.response?.data?.message ||
                            'Failed to save setlist. Please try again.',
                        });
                      }
                    }}
                    sx={{
                      borderRadius: 2,
                      py: 1.2,
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                    }}
                  >
                    Save Setlist
                  </Button>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* 2. Quick Add Song & Recommended Songs (At the Bottom) */}
              <Box>
                {canEdit && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Quick Add Song
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Autocomplete
                        freeSolo
                        openOnFocus
                        ListboxProps={{
                          sx: {
                            maxHeight: 155,
                            '& .MuiAutocomplete-option': {
                              minHeight: 'auto',
                              py: 0.75,
                            },
                          },
                        }}
                        options={songs}
                        getOptionLabel={(option) => {
                          if (typeof option === 'string') return option;
                          return option.title || '';
                        }}
                        filterOptions={(options, params) => {
                          const q = (params.inputValue || '').trim();
                          if (!q) {
                            return options;
                          }

                          const qLower = q.toLowerCase();

                          // 1. Exact or direct substring/prefix matches
                          const substringMatches = options.filter((opt) => {
                            const t = (opt.title || '').toLowerCase();
                            const a = (opt.artist || '').toLowerCase();
                            return t.includes(qLower) || a.includes(qLower);
                          });

                          if (substringMatches.length > 0) {
                            const hasExactMatch = substringMatches.some(
                              (opt) => (opt.title || '').trim().toLowerCase() === qLower
                            );
                            const results = [...substringMatches];
                            if (!hasExactMatch) {
                              results.push({
                                inputValue: params.inputValue,
                                title: `Create new song: "${params.inputValue}"`,
                                isNew: true,
                              });
                            }
                            return results;
                          }

                          // 2. If no direct match, find fuzzy / typo "Did you mean?" matches (Show ONLY 1 best match)
                          const fuzzyResults = fuzzySearchSongs(options, q, 0.45);

                          if (fuzzyResults.length > 0) {
                            const topMatch = {
                              ...fuzzyResults[0],
                              _isDidYouMean: true,
                            };
                            return [
                              topMatch,
                              {
                                inputValue: params.inputValue,
                                title: `Create new song: "${params.inputValue}"`,
                                isNew: true,
                              },
                            ];
                          }

                          // 3. No match at all -> show create new song
                          return [
                            {
                              inputValue: params.inputValue,
                              title: `Create new song: "${params.inputValue}"`,
                              isNew: true,
                            },
                          ];
                        }}
                        inputValue={newSongTitle}
                        onInputChange={(event, newInputValue) => {
                          setNewSongTitle(newInputValue);
                          const exactMatch = songs.find(
                            (s) =>
                              (s.title || '').trim().toLowerCase() ===
                              newInputValue.trim().toLowerCase()
                          );
                          if (exactMatch && exactMatch.key) {
                            setNewSongKey(exactMatch.key);
                          }
                        }}
                        onChange={(event, newValue) => {
                          if (typeof newValue === 'string') {
                            setNewSongTitle(newValue);
                          } else if (newValue && newValue.isNew) {
                            setNewSongTitle(newValue.inputValue);
                          } else if (newValue) {
                            setNewSongTitle(newValue.title || '');
                            if (newValue.key) {
                              setNewSongKey(newValue.key);
                            }
                          } else {
                            setNewSongTitle('');
                          }
                        }}
                        renderOption={(props, option) => {
                          if (option.isNew) {
                            return (
                              <li {...props} key="new-song-option">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, color: 'primary.main' }}>
                                  <AddIcon sx={{ fontSize: 18 }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {option.title}
                                  </Typography>
                                </Box>
                              </li>
                            );
                          }
                          const alreadyInSetlist = setlist.some(
                            (s) => String(s._id) === String(option._id)
                          );
                          return (
                            <li {...props} key={option._id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', py: 0.5 }}>
                                <Box sx={{ minWidth: 0, mr: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                      {option.title}
                                    </Typography>
                                    {option._isDidYouMean && (
                                      <Chip
                                        size="small"
                                        label="Did you mean?"
                                        color="secondary"
                                        sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700 }}
                                      />
                                    )}
                                  </Box>
                                  {option.artist && (
                                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                                      {option.artist}
                                    </Typography>
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                  {option.key && (
                                    <Chip size="small" label={`Key ${option.key}`} sx={{ height: 20, fontSize: '0.6875rem' }} />
                                  )}
                                  {alreadyInSetlist ? (
                                    <Chip size="small" label="In Setlist" color="default" sx={{ height: 20, fontSize: '0.6875rem' }} />
                                  ) : (
                                    <Chip size="small" label="In Library" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.6875rem' }} />
                                  )}
                                </Box>
                              </Box>
                            </li>
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            inputRef={addSongTitleInputRef}
                            size="small"
                            placeholder="Search library songs (typo-tolerant) or enter new..."
                            label="Quick add song title"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleQuickAddSong();
                              }
                            }}
                          />
                        )}
                        sx={{ flex: 1, minWidth: { xs: 150, sm: 260 } }}
                      />
                      <FormControl size="small" sx={{ minWidth: 105 }}>
                        <InputLabel>Key</InputLabel>
                        <Select
                          value={newSongKey}
                          label="Key"
                          onChange={(e) => setNewSongKey(e.target.value)}
                        >
                          <MenuItem value="AUTO">
                            <em>Auto (Original)</em>
                          </MenuItem>
                          {keyOptions.map((k) => (
                            <MenuItem key={k} value={k}>
                              Key: {k}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleQuickAddSong}
                        disabled={addSongLoading}
                        sx={{ borderRadius: 2, textTransform: 'none', height: 40, whiteSpace: 'nowrap' }}
                      >
                        {addSongLoading ? 'Adding...' : 'Add'}
                      </Button>
                    </Box>
                  </Box>
                )}

                {addSongError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {addSongError}
                  </Alert>
                )}

                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Recommended Songs
                  </Typography>
                </Box>

                {/* Recommended Songs List */}
                {songs.length > 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    {recommendedSongs.map((song) => {
                      const displaySong = mergeSongWithBank(song, songsById);
                      const isKeyRec = song._recType === 'key';
                      return (
                        <Paper
                          key={displaySong._id}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1.5,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1.5,
                                bgcolor: isKeyRec
                                  ? 'rgba(245, 158, 11, 0.1)'
                                  : 'rgba(59, 130, 246, 0.1)',
                                color: isKeyRec ? '#f59e0b' : '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <MusicIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <SongTitleWithTimeSignature
                                  title={displaySong.title}
                                  timeSignature={displaySong.timeSignature}
                                />
                                {song._recReason && (
                                  <Chip
                                    size="small"
                                    label={song._recReason}
                                    variant="outlined"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      borderColor: isKeyRec
                                        ? 'rgba(245, 158, 11, 0.4)'
                                        : 'rgba(59, 130, 246, 0.4)',
                                      color: isKeyRec
                                        ? 'warning.dark'
                                        : 'primary.main',
                                      bgcolor: isKeyRec
                                        ? 'rgba(245, 158, 11, 0.06)'
                                        : 'rgba(59, 130, 246, 0.06)',
                                    }}
                                  />
                                )}
                              </Box>
                              {displaySong.artist && (
                                <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.2 }}>
                                  {displaySong.artist}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              justifyContent: { xs: 'space-between', sm: 'flex-end' },
                              borderTop: { xs: '1px solid', sm: 'none' },
                              borderColor: 'divider',
                              pt: { xs: 1, sm: 0 },
                            }}
                          >
                            {renderKeySelect(displaySong)}
                            {canEdit && (
                              <Button
                                size="small"
                                variant={setlist.some((s) => s._id === displaySong._id) ? 'outlined' : 'contained'}
                                startIcon={setlist.some((s) => s._id === displaySong._id) ? null : <AddIcon />}
                                onClick={() => {
                                  if (!setlist.find((s) => s._id === displaySong._id)) {
                                    setSetlist([
                                      ...setlist,
                                      mergeSongWithBank(displaySong, songsById),
                                    ]);
                                  }
                                }}
                                disabled={setlist.some((s) => s._id === displaySong._id)}
                                sx={{ borderRadius: 1.5, textTransform: 'none', height: 32, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                              >
                                {setlist.some((s) => s._id === displaySong._id) ? 'Added' : 'Add to Setlist'}
                              </Button>
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    No songs available.
                  </Typography>
                )}
                {songs.length > 0 && recommendedSongs.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {songQuery
                      ? 'No recommendations match your search. Clear or change search query.'
                      : 'All available songs are already in the setlist.'}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Team Members & Roster (30%) */}
        <Grid item xs={12} md={4} lg={3.6}>
          {optInMessage && (
            <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setOptInMessage('')}>
              {optInMessage}
            </Alert>
          )}

          {/* Volunteer's Personal Opt-In Status Card */}
          {userOptInAssignment && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2.5,
                borderRadius: 2.5,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(147, 51, 234, 0.12)'
                    : 'rgba(147, 51, 234, 0.05)',
                borderColor: 'secondary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                  <VolunteerActivismIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    You offered to serve as {userOptInAssignment.role || 'Volunteer'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Status: Pending leader / organizer confirmation.
                    {userOptInAssignment.notes && ` (Note: "${userOptInAssignment.notes}")`}
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleWithdrawOptIn}
                disabled={optInSubmitting}
                sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 600 }}
              >
                Withdraw Offer
              </Button>
            </Paper>
          )}

          {/* Available Volunteers (Opted-In) Review Section for Admins, Sub-Admins, and Worship Leaders only */}
          {canReviewVolunteers && !isLocked && optedInVolunteers.length > 0 && (
            <Card
              sx={{
                borderRadius: 3,
                mb: 3,
                border: '1px solid rgba(245, 158, 11, 0.4)',
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(245, 158, 11, 0.05)'
                    : 'rgba(245, 158, 11, 0.02)',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={2}
                  flexWrap="wrap"
                  gap={1}
                >
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <VolunteerActivismIcon sx={{ color: '#d97706' }} />
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: '#d97706', fontSize: '1.05rem' }}
                    >
                      Available Volunteers ({optedInVolunteers.length})
                    </Typography>
                    <Chip
                      label="Opted-In Members"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(245, 158, 11, 0.15)',
                        color: '#d97706',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, fontSize: '0.85rem' }}
                >
                  The following church members have offered to serve in this event. Confirm them into the active team roster or dismiss.
                </Typography>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead
                      sx={{
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.05)'
                            : '#fffbeb',
                      }}
                    >
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', py: 1.25 }}>
                          Volunteer
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', py: 1.25 }}>
                          Offered Role
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', py: 1.25 }}>
                          Notes
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            py: 1.25,
                            textAlign: 'right',
                          }}
                        >
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {optedInVolunteers.map((vol, idx) => {
                        const vUserId = vol.userId?._id
                          ? String(vol.userId._id)
                          : String(vol.userId || vol._id || '');
                        const isReviewing = reviewingVolunteerId === vUserId;
                        return (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ py: 1.25 }}>
                              <Box display="flex" alignItems="center" gap={1.25}>
                                <Avatar
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    bgcolor: '#d97706',
                                  }}
                                >
                                  {(vol.userId?.name || vol.name || 'V')
                                    .charAt(0)
                                    .toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>
                                    {vol.userId?.name || vol.name || 'Volunteer'}
                                  </Typography>
                                  {vol.userId?.email && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      display="block"
                                      sx={{ fontSize: '0.72rem' }}
                                    >
                                      {vol.userId.email}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1.25 }}>
                              <Chip
                                label={vol.role || 'Volunteer'}
                                size="small"
                                color="secondary"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.75rem', height: 24 }}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1.25 }}>
                              <Typography variant="caption" color="text.secondary">
                                {vol.notes || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.25, textAlign: 'right' }}>
                              <Box
                                display="inline-flex"
                                alignItems="center"
                                gap={1}
                                justifyContent="flex-end"
                              >
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={
                                    isReviewing ? (
                                      <CircularProgress size={12} color="inherit" />
                                    ) : (
                                      <CheckIcon sx={{ fontSize: 13 }} />
                                    )
                                  }
                                  onClick={() =>
                                    handleReviewVolunteer(vUserId, 'confirm', vol.role)
                                  }
                                  disabled={isReviewing}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    py: 0.4,
                                    px: 1.2,
                                    borderRadius: 1.5,
                                  }}
                                >
                                  Confirm to Team
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() =>
                                    handleReviewVolunteer(vUserId, 'decline')
                                  }
                                  disabled={isReviewing}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    py: 0.4,
                                    px: 1,
                                    borderRadius: 1.5,
                                  }}
                                >
                                  Dismiss
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Team Members */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2.5} flexWrap="wrap">
                <GroupIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  Know Your Team!
                </Typography>
                <Chip
                  label={activeTeamMembers.length}
                  size="small"
                  color="primary"
                  sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, minWidth: 28 }}
                />
                {canEdit && (
                  <Tooltip title="Manage Roster" arrow>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/events/${id}/team`)}
                      sx={{
                        width: 28,
                        height: 28,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                      }}
                    >
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Event Chat" arrow>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/events/${id}/chat`)}
                    sx={{
                      width: 28,
                      height: 28,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      color: '#ff4d28',
                    }}
                  >
                    <ChatIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {activeTeamMembers.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
                  {activeTeamMembers.map((member, idx) => {
                    const rawStatus = member.status ? String(member.status).toLowerCase() : 'pending';
                    const isApproved = rawStatus === 'accepted' || rawStatus === 'confirmed' || rawStatus === 'approved';
                    const memberName = member.userId?.name || member.name || 'Unknown';
                    const memberUserId = member.userId?._id ? String(member.userId._id) : String(member.userId || member._id || '');
                    const profilePhoto = member.userId?.profilePhotoUrl;
                    const isRevealed = revealedMemberIds.has(memberUserId);
                    const currentUid = user?.id || user?._id;
                    const isSelf = Boolean(currentUid && memberUserId && String(memberUserId) === String(currentUid));

                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.5,
                          minWidth: 64,
                          maxWidth: 80,
                          py: 0.75,
                          px: 0.5,
                          borderRadius: 2,
                          transition: 'background-color 0.2s ease',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        {/* Avatar with instrument badge */}
                        <Tooltip title={isRevealed ? '' : 'Click to reveal name'} arrow>
                          <Box
                            sx={{ position: 'relative', cursor: 'pointer' }}
                            onClick={() => toggleMemberReveal(memberUserId)}
                          >
                            <Avatar
                              src={profilePhoto || undefined}
                              sx={{
                                width: 42,
                                height: 42,
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                bgcolor: isApproved ? '#10b981' : 'primary.main',
                                border: isApproved ? '2.5px solid #10b981' : '2px solid',
                                borderColor: isApproved
                                  ? '#10b981'
                                  : isSelf
                                  ? 'rgba(99, 102, 241, 0.5)'
                                  : 'rgba(99, 102, 241, 0.25)',
                                boxShadow: isApproved ? '0 0 0 2px rgba(16, 185, 129, 0.25)' : 'none',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                '&:hover': {
                                  transform: 'scale(1.1)',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                                },
                              }}
                            >
                              {memberName.charAt(0).toUpperCase()}
                            </Avatar>
                            {/* Instrument badge */}
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -4,
                                bgcolor: 'background.paper',
                                borderRadius: '50%',
                                width: 19,
                                height: 19,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                                border: '1.5px solid',
                                borderColor: 'divider',
                              }}
                            >
                              {getInstrumentIcon(member.role)}
                            </Box>
                          </Box>
                        </Tooltip>

                        {/* Name - smooth reveal on click */}
                        <Box
                          sx={{
                            overflow: 'hidden',
                            maxHeight: isRevealed ? 44 : 0,
                            opacity: isRevealed ? 1 : 0,
                            transition: 'max-height 0.3s ease, opacity 0.25s ease',
                            mt: isRevealed ? 0.25 : 0,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.68rem',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              display: 'block',
                              maxWidth: 92,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {(memberName.split(' ')[0])}{isSelf ? ' (You)' : ` (${member.role || 'Member'})`}
                          </Typography>
                        </Box>

                        {/* Admin: tick & cross / Non-admin: status chip */}
                        {isFullAdmin ? (
                          <Box display="flex" gap={0.25} mt={0.25}>
                            <Tooltip title="Approve" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleAdminApprove(member)}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  bgcolor: isApproved ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                  color: '#10b981',
                                  border: isApproved ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                  '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.22)' },
                                }}
                              >
                                <CheckIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove from team" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleAdminRemove(member)}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  color: '#ef4444',
                                  '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.12)' },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Chip
                            label={isApproved ? 'Approved' : 'Pending'}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              mt: 0.25,
                              ...(isApproved
                                ? {
                                    bgcolor: 'rgba(16, 185, 129, 0.12)',
                                    color: '#15803d',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                  }
                                : {
                                    bgcolor: 'action.hover',
                                    color: 'text.secondary',
                                  }),
                            }}
                          />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <GroupIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No team members yet. Click "Manage Roster" to add people.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Interactive Live Event Chat Box directly under Know Your Team */}
          <EventChatBox eventId={id} isLocked={isLocked} />
        </Grid>
      </Grid>

      {/* Volunteer Opt-In Dialog */}
      <Dialog
        open={optInDialogOpen}
        onClose={() => !optInSubmitting && setOptInDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
            <VolunteerActivismIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Volunteer to Serve
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Offer to participate in this service
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {optInError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {optInError}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Let church leadership know you are available and willing to serve in{' '}
            <strong>{getEventDisplayTitle(event)}</strong>.
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Preferred Role / Position"
              value={optInRole}
              onChange={(e) => setOptInRole(e.target.value)}
              placeholder="e.g. Lead Vocals, Acoustic Guitar, Audio Engineer, Usher"
              fullWidth
              required
              size="small"
              helperText="Specify the role you'd like to serve in"
            />
            <TextField
              label="Optional Notes / Availability"
              value={optInNotes}
              onChange={(e) => setOptInNotes(e.target.value)}
              placeholder="e.g. Available for rehearsal from 8:30 AM"
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOptInDialogOpen(false)} disabled={optInSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleOptInSubmit}
            disabled={optInSubmitting || !optInRole.trim()}
            startIcon={
              optInSubmitting ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <VolunteerActivismIcon />
              )
            }
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {optInSubmitting ? 'Submitting...' : 'Offer to Serve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Event Role Dialog */}
      <Dialog
        open={roleDialogOpen}
        onClose={handleCloseEditRoleDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Change Role in Event
        </DialogTitle>
        <DialogContent dividers>
          {selectedMemberForRole && (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {roleUpdateError && (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  {roleUpdateError}
                </Alert>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Team Member
                </Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedMemberForRole.userId?.name || selectedMemberForRole.name || 'Member'}
                </Typography>
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel id="change-event-role-label">Assigned Role</InputLabel>
                <Select
                  labelId="change-event-role-label"
                  label="Assigned Role"
                  value={newAssignmentRole}
                  onChange={(e) => setNewAssignmentRole(e.target.value)}
                >
                  {EVENT_ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Assignment Notes (optional)"
                size="small"
                multiline
                rows={2}
                value={newAssignmentNotes}
                onChange={(e) => setNewAssignmentNotes(e.target.value)}
                placeholder="e.g. Lead vocals, Acoustic guitar, Audio mixing"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseEditRoleDialog} disabled={isUpdatingRole}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEventRole}
            disabled={isUpdatingRole || !newAssignmentRole.trim()}
          >
            {isUpdatingRole ? 'Saving…' : 'Save Role'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Event?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{eventInfo.title}"? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unconfirm Event Confirmation Dialog */}
      <Dialog
        open={unconfirmDialogOpen}
        onClose={() => setUnconfirmDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, maxWidth: 420 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <UndoIcon color="warning" sx={{ fontSize: 22 }} />
          Unconfirm Event?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to unconfirm{' '}
            <strong>{getEventDisplayTitle(event)}</strong>? This will return the event to draft
            status and notify members that it is no longer confirmed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setUnconfirmDialogOpen(false)}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setUnconfirmDialogOpen(false);
              await handleUnconfirmEvent();
            }}
            color="warning"
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
          >
            Unconfirm Event
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Set List Modal */}
      <PrintSetlistModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        event={eventInfo}
        setlist={setlist}
        bankSongs={songs}
      />
    </Box>
  );
}

export default EventDetails;
