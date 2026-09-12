const axios = require('axios');

const SUPABASE_URL = 'https://zeabwyivgsfexgvsnipf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWJ3eWl2Z3NmZXhndnNuaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDc2MzMsImV4cCI6MjA4NzQ4MzYzM30.mN7Pd_5fM6mBT7VkOg39vq5FTCWpo6jkaNZZw91GMb0';

async function searchSongs(q, lang = 'telugu') {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  console.log(`\n=== Searching for: "${q}" (language: ${lang}) ===`);
  
  // Clean query for search
  const cleanQ = q.trim();
  const orFilter = `title.ilike.*${cleanQ}*,title_transliterated.ilike.*${cleanQ}*,slug.ilike.*${cleanQ}*,search_blob.ilike.*${cleanQ}*`;
  const url = `${SUPABASE_URL}/rest/v1/songs?select=id,title,title_transliterated,author_english,author_telugu,language,slug,lyrics_original,lyrics_transliterated,chords,wp_link&or=(${encodeURIComponent(orFilter)})&language=eq.${encodeURIComponent(lang)}&limit=5`;
  
  const res = await axios.get(url, { headers });
  console.log(`Found ${res.data.length} matches:`);
  for (const s of res.data) {
    console.log(`- [${s.language}] ${s.title} (${s.title_transliterated}) by ${s.author_english || s.author_telugu || 'Unknown'} | slug: ${s.slug}`);
    if (s.lyrics_original) {
      console.log('  Telugu Lyrics:', s.lyrics_original.split('\n').slice(0, 3).join(' / '));
    }
  }
}

async function run() {
  await searchSongs('Anni Kaalambula');
  await searchSongs('అన్ని కాలంబుల');
  await searchSongs('Nede Priyaraagam');
  await searchSongs('Kalvari Premanu');
  await searchSongs('Naa Praanamaina Yesu');
}

run();
