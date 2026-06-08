import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const headerRef = useRef(null);
  const firstItemRef = useRef(null);
  const [itemHeight, setItemHeight] = useState(72);
  const [headerHeight, setHeaderHeight] = useState(48);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 10 },
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.put(
        `/api/notifications/${id}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.put(
        '/api/notifications/read-all',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString();
  };

  // Measure header and item heights to compute maxHeight dynamically
  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
    if (firstItemRef.current) {
      setItemHeight(firstItemRef.current.offsetHeight);
    }
  }, [notifications, open]);

  return (
    <div
      className="notification-bell"
      ref={dropdownRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.2rem',
          cursor: 'pointer',
          color: 'white',
          position: 'relative',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: 'red',
              color: 'white',
              borderRadius: '50%',
              fontSize: '0.7rem',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            width: '320px',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <div
            ref={headerRef}
            style={{
              padding: '0.5rem 1rem',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3498db',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div
            style={{
              maxHeight:
                notifications.length >= 4
                  ? `${headerHeight + itemHeight * 3}px`
                  : undefined,
              overflowY: notifications.length >= 4 ? 'auto' : 'hidden',
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{ padding: '1rem', textAlign: 'center', color: '#666' }}
              >
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif, idx) => (
                <div
                  key={notif._id}
                  ref={idx === 0 ? firstItemRef : null}
                  onClick={() => {
                    if (!notif.read) markAsRead(notif._id);
                    if (notif.link) {
                      window.location.href = notif.link;
                    }
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f0f0f0',
                    background: notif.read ? 'white' : '#f0f7ff',
                    cursor: notif.link ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontWeight: notif.read ? 'normal' : 'bold' }}>
                    {notif.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#555',
                      marginTop: '0.25rem',
                    }}
                  >
                    {notif.message}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#999',
                      marginTop: '0.25rem',
                    }}
                  >
                    {formatTime(notif.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
