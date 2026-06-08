import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

function EventForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'service',
    start: '',
    end: '',
    timezone: 'UTC',
    teamId: ''
  });
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    // Fetch teams for dropdown
    axios.get('/api/teams', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setTeams(res.data))
      .catch(err => console.error(err));
    if (isEdit) {
      axios.get(`/api/events/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const event = res.data;
          setForm({
            title: event.event.title,
            description: event.event.description,
            type: event.event.type,
            start: event.schedule.start.slice(0, 16),
            end: event.schedule.end.slice(0, 16),
            timezone: event.schedule.timezone,
            teamId: event.team._id || event.team
          });
        })
        .catch(err => console.error(err));
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    try {
      const payload = {
        title: form.title,
        description: form.description,
        type: form.type,
        start: form.start,
        end: form.end,
        timezone: form.timezone,
        teamId: form.teamId
      };
      if (isEdit) {
        await axios.put(`/api/events/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/events', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      navigate('/events');
    } catch (err) {
      console.error(err);
      alert('Error saving event');
    }
  };

  return (
    <div className="event-form">
      <h2>{isEdit ? 'Edit Event' : 'Create New Event'}</h2>
      <form onSubmit={handleSubmit}>
        <label>Title</label>
        <input name="title" value={form.title} onChange={handleChange} required />
        <label>Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} />
        <label>Type</label>
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="service">Service</option>
          <option value="rehearsal">Rehearsal</option>
          <option value="seminar">Seminar</option>
          <option value="other">Other</option>
        </select>
        <label>Start</label>
        <input type="datetime-local" name="start" value={form.start} onChange={handleChange} required />
        <label>End</label>
        <input type="datetime-local" name="end" value={form.end} onChange={handleChange} required />
        <label>Timezone</label>
        <input name="timezone" value={form.timezone} onChange={handleChange} />
        <label>Team (optional)</label>
        <select name="teamId" value={form.teamId} onChange={handleChange}>
          <option value="">Select team</option>
          {teams.map(team => (
            <option key={team._id} value={team._id}>{team.team.name}</option>
          ))}
        </select>
        <button type="submit">{isEdit ? 'Update' : 'Create'}</button>
        <button type="button" onClick={() => navigate('/events')}>Cancel</button>
      </form>
    </div>
  );
}

export default EventForm;
