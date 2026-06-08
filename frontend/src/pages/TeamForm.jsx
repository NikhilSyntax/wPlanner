import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function TeamForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'other',
  });

  useEffect(() => {
    if (isEdit) {
      fetchTeam();
    }
  }, [id]);

  const fetchTeam = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`/api/teams/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const team = res.data;
      setForm({
        name: team.team?.name || '',
        description: team.team?.description || '',
        type: team.team?.type || 'other',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
      };
      if (isEdit) {
        await axios.put(`/api/teams/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post('/api/teams', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      navigate('/teams');
    } catch (err) {
      console.error(err);
      alert('Error saving team');
    }
  };

  return (
    <div className="team-form">
      <h2>{isEdit ? 'Edit Team' : 'Create New Team'}</h2>
      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />
        <label>Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
        />
        <label>Type</label>
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="worship_band">Worship Band</option>
          <option value="production">Production</option>
          <option value="choir">Choir</option>
          <option value="youth">Youth</option>
          <option value="children">Children</option>
          <option value="media">Media</option>
          <option value="technical">Technical</option>
          <option value="other">Other</option>
        </select>
        <button type="submit">{isEdit ? 'Update' : 'Create'}</button>
        <button type="button" onClick={() => navigate('/teams')}>
          Cancel
        </button>
      </form>
    </div>
  );
}

export default TeamForm;
