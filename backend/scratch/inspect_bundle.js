const axios = require('axios');

async function inspectBundle() {
  const home = await axios.get('https://christianlyricz.com/');
  const matches = home.data.match(/href="(\/assets\/[^"]+\.js)"/g) || [];
  const srcMatches = home.data.match(/src="(\/assets\/[^"]+\.js)"/g) || [];
  const allFiles = [...matches, ...srcMatches].map(m => m.match(/["'](\/assets\/[^"']+)["']/)[1]);
  
  for (const f of allFiles) {
    const res = await axios.get('https://christianlyricz.com' + f);
    console.log('File:', f, 'size:', res.data.length);
    const supa = res.data.match(/https:\/\/[a-z0-9]+\.supabase\.co[^\s"']*/g);
    if (supa) console.log('Supa URLs:', supa);
    const keys = res.data.match(/eyJ[a-zA-Z0-9_\-\.]+/g);
    if (keys) console.log('JWT/Keys:', keys.map(k => k.substring(0, 30) + '...'));
  }
}

inspectBundle();
