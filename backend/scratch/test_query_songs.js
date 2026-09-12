const axios = require('axios');

const SUPABASE_URL = 'https://zeabwyivgsfexgvsnipf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWJ3eWl2Z3NmZXhndnNuaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDc2MzMsImV4cCI6MjA4NzQ4MzYzM30.mN7Pd_5fM6mBT7VkOg39vq5FTCWpo6jkaNZZw91GMb0';

async function searchSongs(q, lang = 'Telugu') {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  // Test PostgREST search queries on search_blob, title, or transliteration
  console.log(`\n=== Searching for: "${q}" (language: ${lang}) ===`);
  
  // 1. ILIKE on search_blob
  try {
    const url = `${SUPABASE_URL}/rest/v1/songs?select=id,title,transliteration,author,language,slug,lyrics,lyrics_raw,transliteration_lyrics,chords,key,tempo&search_blob=ilike.*${encodeURIComponent(q)}*&language=eq.${encodeURIComponent(lang)}&limit=5`;
    const res = await axios.get(url, { headers });
    console.log(`Found ${res.data.length} matches via search_blob:`);
    for (const s of res.data) {
      console.log(`- [${s.language}] ${s.title} (${s.transliteration}) by ${s.author} | slug: ${s.slug}`);
      if (s.lyrics) {
        console.log('  Preview lyrics (first 2 lines):', s.lyrics.split('\n').slice(0, 2).join(' / '));
      }
    }
  } catch (e) {
    console.error('search_blob query failed:', e?.response?.data || e.message);
  }

  // 2. Also test title or transliteration or slug ilike query
  try {
    const orFilter = `title.ilike.*${q}*,transliteration.ilike.*${q}*,slug.ilike.*${q}*`;
    const url = `${SUPABASE_URL}/rest/v1/songs?select=id,title,transliteration,author,language,slug,lyrics,lyrics_raw,transliteration_lyrics,chords,key,tempo&or=(${encodeURIComponent(orFilter)})&language=eq.${encodeURIComponent(lang)}&limit=5`;
    const res = await axios.get(url, { headers });
    console.log(`Found ${res.data.length} matches via OR filter:`);
    for (const s of res.data) {
      console.log(`- [${s.language}] ${s.title} (${s.transliteration}) by ${s.author}`);
    }
  } catch (e) {
    console.error('OR query failed:', e?.response?.data || e.message);
  }
}

async function run() {
  await searchSongs('Anni Kaalambula');
  await searchSongs('అన్ని కాలంబుల');
  await searchSongs('Hosanna');
  await searchSongs('Nede Priyaraagam');
}

run();
