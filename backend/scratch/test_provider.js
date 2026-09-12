const { ChristianLyriczProvider } = require('../src/services/songImport/ChristianLyriczProvider');

async function testProvider() {
  const provider = new ChristianLyriczProvider();

  console.log('Testing canHandle:');
  console.log('  https://christianlyricz.com/song/anni-kaalambula/ ->', provider.canHandle('https://christianlyricz.com/song/anni-kaalambula/'));
  console.log('  https://tabs.ultimate-guitar.com/tab/foo ->', provider.canHandle('https://tabs.ultimate-guitar.com/tab/foo'));

  console.log('\nTesting search:');
  const results = await provider.search('Anni Kaalambula');
  console.log('  Found search count:', results.length);
  if (results.length > 0) {
    console.log('  First match:', results[0]);
  }

  console.log('\nTesting fetchSong & parseSong:');
  const songData = await provider.fetchSong('https://christianlyricz.com/song/anni-kaalambula/');
  const parsed = provider.parseSong(songData, 'https://christianlyricz.com/song/anni-kaalambula/');
  console.log('  Parsed title:', parsed.title);
  console.log('  Parsed artist:', parsed.artist);
  console.log('  Parsed regionalLyrics length:', parsed.regionalLyrics?.length);
  console.log('  First 3 lines of Telugu lyrics:\n' + parsed.content.lyrics.split('\n').slice(0, 3).join('\n'));

  console.log('\nTesting findBestTeluguMatch for "Hosanna":');
  const match = await provider.findBestTeluguMatch('Hosanna');
  console.log('  Match found:', match?.found, 'Telugu Title:', match?.teluguTitle, 'Similarity:', match?.similarity);

  console.log('\nTesting findBestTeluguMatch for "Nede Priyaraagam":');
  const nedeMatch = await provider.findBestTeluguMatch('Nede Priyaraagam');
  console.log('  Match found:', nedeMatch?.found, 'Telugu Title:', nedeMatch?.teluguTitle, 'Similarity:', nedeMatch?.similarity);
}

testProvider();
