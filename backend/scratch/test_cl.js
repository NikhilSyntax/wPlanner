const axios = require('axios');

async function test() {
  try {
    const home = await axios.get('https://christianlyricz.com/');
    const jsMatches = home.data.match(/src="(\/assets\/[^"]+\.js)"/g);
    console.log('JS files:', jsMatches);
    
    // Check sitemap size and structure
    const sitemap = await axios.get('https://christianlyricz.com/sitemap.xml');
    const songUrls = [];
    const locRegex = /<loc>(https:\/\/christianlyricz\.com\/song\/([^<]+)\/)<\/loc>/g;
    let m;
    while ((m = locRegex.exec(sitemap.data)) !== null) {
      songUrls.push({ url: m[1], slug: m[2] });
    }
    console.log('Total songs in sitemap:', songUrls.length);
    console.log('Sample songs:', songUrls.slice(0, 10));

    // Also check if there is a Supabase client config in the JS files
    for (const tag of jsMatches || []) {
      const src = tag.match(/src="([^"]+)"/)[1];
      const js = await axios.get('https://christianlyricz.com' + src);
      if (js.data.includes('supabase.co')) {
        console.log('Found supabase in:', src);
        const urlMatch = js.data.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
        const anonKeyMatch = js.data.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-\.]+/);
        console.log('Supabase URL:', urlMatch ? urlMatch[0] : null);
        console.log('Supabase Anon Key found:', !!anonKeyMatch);
        if (anonKeyMatch) {
          console.log('Anon key snippet:', anonKeyMatch[0].substring(0, 30) + '...');
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
