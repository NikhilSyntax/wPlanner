import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ProductionPlanning() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [stage, setStage] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [newEquipment, setNewEquipment] = useState('');
  const [room, setRoom] = useState('');
  const [backupStaff, setBackupStaff] = useState([]);
  const [newBackup, setNewBackup] = useState('');

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ev = res.data;
      setEvent(ev);
      setStage(ev.location?.setup?.stage || '');
      setEquipment(ev.location?.setup?.equipment || []);
      setRoom(ev.location?.room || '');
      setBackupStaff(ev.backupStaff || []);
    } catch (err) {
      console.error(err);
    }
  };

  const addEquipment = () => {
    if (!newEquipment.trim()) return;
    setEquipment([...equipment, newEquipment.trim()]);
    setNewEquipment('');
  };

  const removeEquipment = (index) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  const addBackupStaff = () => {
    if (!newBackup.trim()) return;
    setBackupStaff([...backupStaff, newBackup.trim()]);
    setNewBackup('');
  };

  const removeBackupStaff = (index) => {
    setBackupStaff(backupStaff.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      await axios.put(`/api/events/${eventId}`, {
        location: {
          ...event?.location,
          room,
          setup: { stage, equipment }
        },
        backupStaff
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Production plan updated!');
      fetchEvent();
    } catch (err) {
      console.error(err);
      alert('Error updating production plan');
    }
  };

  if (!event) return <div>Loading...</div>;

  return (
    <div className="production-planning">
      <Link to={`/events/${eventId}`}>← Back to Event</Link>
      <h2>Production Planning: {event.event?.title}</h2>

      <form onSubmit={handleSubmit}>
        <h3>Stage Setup</h3>
        <label>Stage Configuration</label>
        <input
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          placeholder="e.g., Main stage, Simple setup"
        />

        <h3>Equipment Checklist</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            value={newEquipment}
            onChange={(e) => setNewEquipment(e.target.value)}
            placeholder="Add equipment item"
            style={{ flex: 1 }}
          />
          <button type="button" onClick={addEquipment}>Add</button>
        </div>
        <ul>
          {equipment.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>
              {item}
              <button
                type="button"
                onClick={() => removeEquipment(idx)}
                style={{ marginLeft: '0.5rem', color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <h3>Room Assignment</h3>
        <label>Room/Location</label>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g., Sanctuary, Fellowship Hall"
        />

        <h3>Backup Staff</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            value={newBackup}
            onChange={(e) => setNewBackup(e.target.value)}
            placeholder="Add backup staff member"
            style={{ flex: 1 }}
          />
          <button type="button" onClick={addBackupStaff}>Add</button>
        </div>
        <ul>
          {backupStaff.map((staff, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>
              {staff}
              <button
                type="button"
                onClick={() => removeBackupStaff(idx)}
                style={{ marginLeft: '0.5rem', color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <button type="submit">Save Production Plan</button>
      </form>
    </div>
  );
}

export default ProductionPlanning;
