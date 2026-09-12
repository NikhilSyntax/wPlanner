const axios = require('axios');

const SUPABASE_URL = 'https://zeabwyivgsfexgvsnipf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWJ3eWl2Z3NmZXhndnNuaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDc2MzMsImV4cCI6MjA4NzQ4MzYzM30.mN7Pd_5fM6mBT7VkOg39vq5FTCWpo6jkaNZZw91GMb0';

async function testSupabase() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  const tables = ['songs', 'song', 'lyrics', 'worship_songs', 'tracks'];
  for (const t of tables) {
    try {
      const res = await axios.get(`${SUPABASE_URL}/rest/v1/${t}?limit=2`, { headers });
      console.log(`Table '${t}' exists! Count/Sample:`, res.data);
    } catch (err) {
      console.log(`Table '${t}' status:`, err?.response?.status || err.message);
    }
  }

  // Also test querying songs table with a query filter
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/songs?select=*&limit=5`, { headers });
    console.log('Songs table structure keys:', Object.keys(res.data[0] || {}));
    console.log('Sample song row:', res.data[0]);
  } catch (err) {
    console.log('Error querying songs:', err?.response?.data || err.message);
  }
}

testSupabase();
