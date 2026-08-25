import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function EventsList() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState({ status: '', teamId: '' });

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.teamId) params.teamId = filter.teamId;
      const res = await axios.get('/api/events', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="events-list">
      <div className="filters">
        <select value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Start</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <tr key={event._id}>
              <td>{event.event.title}</td>
              <td>{event.event.type}</td>
              <td>{new Date(event.schedule.start).toLocaleString()}</td>
              <td>{event.event.status}</td>
              <td>
                <Link to={`/events/${event._id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link to="/events/new">Create New Event</Link>
    </div>
  );
}

export default EventsList;
