import api from './api';

export const teamService = {
  getAll: async () => {
    const response = await api.get('/teams');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/teams/${id}`);
    return response.data;
  },

  create: async (teamData) => {
    const response = await api.post('/teams', teamData);
    return response.data;
  },

  update: async (id, teamData) => {
    const response = await api.put(`/teams/${id}`, teamData);
    return response.data;
  },

  delete: async (id) => {
    await api.delete(`/teams/${id}`);
  },
};
