const axios = require('axios');

const SUPABASE_URL = 'https://zeabwyivgsfexgvsnipf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWJ3eWl2Z3NmZXhndnNuaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDc2MzMsImV4cCI6MjA4NzQ4MzYzM30.mN7Pd_5fM6mBT7VkOg39vq5FTCWpo6jkaNZZw91GMb0';

async function checkColumns() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  const res = await axios.get(`${SUPABASE_URL}/rest/v1/songs?select=*&limit=1`, { headers });
  console.log('Columns:', Object.keys(res.data[0] || {}));
}

checkColumns();
