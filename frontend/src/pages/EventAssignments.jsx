import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function EventAssignments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ userId: '', role: '', notes: '' });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const token = localStorage.getItem('accessToken');
    try {
      const [assignRes, usersRes] = await Promise.all([
        axios.get(`/api/events/${id}/assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/users', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAssignments(assignRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    try {
      await axios.post(`/api/events/${id}/assignments`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForm({ userId: '', role: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error adding assignment');
    }
  };

  const handleRemove = async (assignmentId) => {
    if (!window.confirm('Remove this assignment?')) return;
    const token = localStorage.getItem('accessToken');
    try {
      await axios.delete(`/api/events/${id}/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="event-assignments">
      <button onClick={() => navigate(`/events/${id}`)}>← Back to Event</button>
      <h2>Manage Assignments</h2>
      <form onSubmit={handleSubmit}>
        <label>User</label>
        <select name="userId" value={form.userId} onChange={handleChange} required>
          <option value="">Select user</option>
          {users.map(u => (
            <option key={u._id} value={u._id}>{u.profile.name}</option>
          ))}
        </select>
        <label>Role</label>
        <input name="role" value={form.role} onChange={handleChange} placeholder="e.g., lead_singer" required />
        <label>Notes</label>
        <input name="notes" value={form.notes} onChange={handleChange} />
        <button type="submit">Add Assignment</button>
      </form>
      <h3>Current Assignments</h3>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map(a => (
            <tr key={a._id}>
              <td>{a.userId?.profile?.name || 'Unknown'}</td>
              <td>{a.role}</td>
              <td>{a.status}</td>
              <td>{a.notes}</td>
              <td><button onClick={() => handleRemove(a._id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EventAssignments;
