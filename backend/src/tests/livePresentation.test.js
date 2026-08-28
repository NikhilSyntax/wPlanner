const assert = require('assert');
const mongoose = require('mongoose');
const { parseSongToLiveSections, transposeChord, getSemitoneShift } = require('../utils/songParser');
const LiveSession = require('../models/LiveSession');
const LiveDisplay = require('../models/LiveDisplay');
const Event = require('../models/Event');
const Song = require('../models/Song');
const User = require('../models/User');
const Church = require('../models/Church');
const { processLiveCommand, invalidateSessionCache } = require('../controllers/liveController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wplanner_test_live';

async function runLiveTests() {
  console.log('--- Starting wPlanner Version 5 Live Presentation Tests ---');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to test DB.');

  // Clean test DB
  await Church.deleteMany({});
  await User.deleteMany({});
  await Event.deleteMany({});
  await Song.deleteMany({});
  await LiveSession.deleteMany({});
  await LiveDisplay.deleteMany({});

  try {
    // ------------------------------------------------------------------
    // Test 1: Song Parser & Character-Anchored Chord Positions
    // ------------------------------------------------------------------
    console.log('Test 1: Parsing Song Text into Structured Sections and 2-Line Chunks...');

    const sampleRawContent = `
[Verse 1]
G              Em
Amazing grace how sweet the sound
C              G
That saved a wretch like me
G              Em
I once was lost, but now am found
C              G
Was blind, but now I see

[Chorus]
G      C          G
Praise God, praise God
Em     D
Praise God
`;

    const sections = parseSongToLiveSections(sampleRawContent, 'G', 'G');
    assert.strictEqual(sections.length, 2, 'Should have 2 sections (Verse 1 and Chorus)');
    assert.strictEqual(sections[0].name, 'Verse 1');
    assert.strictEqual(sections[0].lines.length, 4, 'Verse 1 should have 4 lines');
    assert.strictEqual(sections[0].chunks.length, 2, 'Verse 1 should have 2 two-line chunks');

    // Check line 0 anchored chord positions
    const line0 = sections[0].lines[0];
    assert.strictEqual(line0.text, 'Amazing grace how sweet the sound');
    assert.strictEqual(line0.chords.length, 2, 'Line 0 should have 2 chords');
    assert.strictEqual(line0.chords[0].chord, 'G');
    assert.strictEqual(line0.chords[0].position, 0); // "G" above "A"
    assert.strictEqual(line0.chords[1].chord, 'Em');
    assert.strictEqual(line0.chords[1].position, 15); // "Em" above "how"

    // Check chunk 0 contains exactly 2 lines
    const chunk0 = sections[0].chunks[0];
    assert.strictEqual(chunk0.lines.length, 2, 'Chunk 0 must have exactly 2 lines');
    console.log('✅ Test 1 Passed: Song parsing, anchored positions, and 2-line chunks verified.');

    // ------------------------------------------------------------------
    // Test 2: Dynamic Chord Transposition
    // ------------------------------------------------------------------
    console.log('Test 2: Transposition from G to A (+2 semitones)...');
    const transposedSections = parseSongToLiveSections(sampleRawContent, 'G', 'A');
    const transLine0 = transposedSections[0].lines[0];
    assert.strictEqual(transLine0.chords[0].chord, 'A', 'G transposed +2 should be A');
    assert.strictEqual(transLine0.chords[1].chord, 'F#m', 'Em transposed +2 should be F#m');
    console.log('✅ Test 2 Passed: Transposition verified.');

    // ------------------------------------------------------------------
    // Test 3: Session Lifecycle and Live Commands (Authoritative State)
    // ------------------------------------------------------------------
    console.log('Test 3: Live Session Commands & State Flow...');

    const church = new Church({ name: 'Grace Church', churchCode: 'GRC123' });
    await church.save();

    const user = new User({
      name: 'Leader John',
      email: 'john@grace.org',
      password: 'hash',
      role: 'Worship Leader',
      churchId: church._id,
    });
    await user.save();

    const song1 = new Song({
      churchId: church._id,
      title: 'Amazing Grace',
      key: 'G',
      content: { chords: sampleRawContent },
    });
    await song1.save();

    const song2 = new Song({
      churchId: church._id,
      title: 'How Great Thou Art',
      key: 'C',
      content: {
        chords: `[Verse 1]
C              F
O Lord my God when I in awesome wonder
G              C
Consider all the worlds Thy hands have made`,
      },
    });
    await song2.save();

    const event = new Event({
      event: { title: 'Sunday Worship', status: 'published' },
      schedule: { start: new Date(), end: new Date(Date.now() + 7200000) },
      churchId: church._id,
      createdBy: user._id,
      setlist: [song1._id, song2._id],
    });
    await event.save();

    const session = new LiveSession({
      eventId: event._id,
      churchId: church._id,
      pairingCode: '4815',
      status: 'LIVE',
      displayMode: 'LYRICS_CHORDS',
      currentSongId: song1._id,
      currentSongTitle: song1.title,
      currentSongKey: 'G',
      currentSectionId: 'sec_1_verse_1',
      currentSectionName: 'Verse 1',
      currentChunkIndex: 0,
      createdBy: user._id,
    });
    await session.save();

    // Command: NEXT -> moves to Chunk 1 of Verse 1 (lines 3 & 4)
    const nextState1 = await processLiveCommand(event._id, { type: 'NEXT' });
    assert.strictEqual(nextState1.currentChunkIndex, 1, 'Should advance to chunk 1');
    assert.strictEqual(nextState1.currentChunk.length, 2, 'Current display chunk should have 2 lines');

    // Command: NEXT -> moves to Chorus
    const nextState2 = await processLiveCommand(event._id, { type: 'NEXT' });
    assert.strictEqual(nextState2.currentSectionName, 'Chorus', 'Should advance to Chorus');
    assert.strictEqual(nextState2.currentChunkIndex, 0, 'Should start at chunk 0 of Chorus');

    // Command: BLACK_SCREEN -> toggles black mode
    const blackState = await processLiveCommand(event._id, { type: 'BLACK_SCREEN' });
    assert.strictEqual(blackState.displayMode, 'BLACK', 'Should be in BLACK display mode');

    // Command: NEXT -> un-blacks and moves to Song 2
    const nextSongState = await processLiveCommand(event._id, { type: 'NEXT' });
    assert.strictEqual(nextSongState.displayMode, 'LYRICS_CHORDS', 'Advancing should resume presentation from black screen');
    assert.strictEqual(nextSongState.currentSongTitle, 'How Great Thou Art', 'Should move to next song in setlist');

    // Command: PREV -> moves back to Song 1 Chorus
    const prevState = await processLiveCommand(event._id, { type: 'PREV' });
    assert.strictEqual(prevState.currentSongTitle, 'Amazing Grace');
    assert.strictEqual(prevState.currentSectionName, 'Chorus');

    console.log('✅ Test 3 Passed: Live presentation commands, step sequences, and blackouts verified.');

    // ------------------------------------------------------------------
    // Test 4: Display Pairing Model
    // ------------------------------------------------------------------
    console.log('Test 4: Display Pairing...');
    const display = new LiveDisplay({
      token: 'tok_screen_12345',
      name: 'Sanctuary Main Projector',
      churchId: church._id,
      eventId: event._id,
    });
    await display.save();

    const fetchedDisplay = await LiveDisplay.findOne({ token: 'tok_screen_12345' });
    assert.strictEqual(fetchedDisplay.name, 'Sanctuary Main Projector');
    console.log('✅ Test 4 Passed: Display pairing token verified.');

    // ------------------------------------------------------------------
    // Test 5: Hide & Delete Slide Logic (Skip Hidden Slides on NEXT/PREV)
    // ------------------------------------------------------------------
    console.log('Test 5: Hiding, Deleting, and Skipping Slides during Live Presentation...');

    // Reset to Song 1 Verse 1 Chunk 0
    await processLiveCommand(event._id, { type: 'SET_SONG', payload: { songId: song1._id } });

    // Hide Chunk 1 of Verse 1 (lines 3 & 4)
    const hiddenState = await processLiveCommand(event._id, {
      type: 'HIDE_SLIDE',
      payload: { songId: song1._id, sectionId: 'sec_1_verse_1', chunkIndex: 1 },
    });
    assert.strictEqual(
      hiddenState.hiddenSlides[`${song1._id}_sec_1_verse_1_1`],
      true,
      'Slide should be marked as hidden in live session'
    );

    // Command: NEXT -> since chunk 1 is hidden, it should directly skip to Chorus chunk 0!
    const skipState = await processLiveCommand(event._id, { type: 'NEXT' });
    assert.strictEqual(
      skipState.currentSectionName,
      'Chorus',
      'Should have skipped hidden Chunk 1 and directly advanced to Chorus'
    );

    // Unhide all slides in Song 1
    const unhiddenState = await processLiveCommand(event._id, {
      type: 'UNHIDE_ALL_SLIDES',
      payload: { songId: song1._id },
    });
    assert.strictEqual(
      Object.keys(unhiddenState.hiddenSlides).length,
      0,
      'All hidden slides should be restored'
    );

    console.log('✅ Test 5 Passed: Hide slide, auto-skipping, and restore slide verified.');

    // ------------------------------------------------------------------
    // Test 6: Regional Language Lyrics & Live Switching
    // ------------------------------------------------------------------
    console.log('Test 6: Regional Language Lyrics and Live Language Switching...');

    song1.regionalLyrics = [
      {
        language: 'Spanish',
        name: 'Spanish',
        content: {
          lyrics: `[Verse 1]\nSublime gracia del Señor\nQue a un infeliz salvó\n\n[Chorus]\nAleluya al Rey de reyes`,
          chords: `[Verse 1]\n[G]Sublime gracia [C]del Señor\n[G]Que a un infeliz salvó\n\n[Chorus]\n[G]Aleluya al [C]Rey de reyes`,
        },
      },
    ];
    await song1.save();
    invalidateSessionCache(event._id);

    // Reset to Verse 1 Chunk 0
    await processLiveCommand(event._id, { type: 'SET_SONG', payload: { songId: song1._id } });

    // Switch to Spanish language
    const spanishState = await processLiveCommand(event._id, {
      type: 'SET_LANGUAGE',
      payload: { language: 'Spanish' },
    });
    assert.strictEqual(spanishState.activeLanguage, 'Spanish', 'Should be switched to Spanish');
    assert.ok(
      spanishState.currentChunk[0]?.text?.includes('Sublime gracia'),
      'Should display Spanish lyrics on the active 2-line slide'
    );

    // Switch back to original English
    const originalState = await processLiveCommand(event._id, {
      type: 'SET_LANGUAGE',
      payload: { language: 'original' },
    });
    assert.strictEqual(originalState.activeLanguage, 'original', 'Should be switched back to original');
    assert.ok(
      originalState.currentChunk[0]?.text?.includes('Amazing grace'),
      'Should display original English lyrics'
    );

    console.log('✅ Test 6 Passed: Regional language lyrics and live TV switching verified.');

    // ------------------------------------------------------------------
    // Test 7: Split View Live Presentation (English on Left, Regional on Right)
    // ------------------------------------------------------------------
    console.log('Test 7: Split View Live Presentation (English on Left, Regional on Right)...');

    const splitState = await processLiveCommand(event._id, {
      type: 'SET_SPLIT_VIEW',
      payload: { isSplitView: true, splitLanguage: 'Spanish' },
    });
    assert.strictEqual(splitState.isSplitView, true, 'isSplitView should be true');
    assert.strictEqual(splitState.splitLanguage, 'Spanish', 'splitLanguage should be Spanish');
    assert.ok(
      splitState.leftChunk[0]?.text?.includes('Amazing grace'),
      'Left column must contain English lyrics'
    );
    assert.ok(
      splitState.rightChunk[0]?.text?.includes('Sublime gracia'),
      'Right column must contain Regional/Spanish lyrics'
    );

    console.log('✅ Test 7 Passed: Split View (English on left, Regional on right) verified.');

    console.log('\nAll Version 5 Live Presentation Tests Passed Successfully! 🎉');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runLiveTests();
