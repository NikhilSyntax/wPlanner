const mongoose = require('mongoose');

async function migrateData() {
  console.log('--- Migrating from worshipwise-auth to wplanner ---');
  const srcConn = await mongoose.createConnection('mongodb://localhost:27017/worshipwise-auth').asPromise();
  const destConn = await mongoose.createConnection('mongodb://localhost:27017/wplanner').asPromise();

  try {
    // 1. Churches
    const srcChurches = await srcConn.db.collection('churches').find().toArray();
    console.log(`Found ${srcChurches.length} churches in source.`);
    const churchMap = new Map();

    for (let i = 0; i < srcChurches.length; i++) {
      const c = srcChurches[i];
      const code = String(c.churchId || `GMC00${i + 1}`).toUpperCase().replace(/[^A-Z0-9]/g, 'X').padEnd(6, '0').substring(0, 6);
      const churchDoc = {
        _id: c._id,
        name: c.name || 'GMC Church',
        churchCode: code,
        createdAt: c.createdAt || new Date(),
      };
      await destConn.db.collection('churches').updateOne(
        { _id: c._id },
        { $set: churchDoc },
        { upsert: true }
      );
      churchMap.set(c.churchId, c._id);
      churchMap.set(c._id.toString(), c._id);
    }

    // Default fallback church
    let defaultChurchId = srcChurches[0]?._id;
    if (!defaultChurchId) {
      defaultChurchId = new mongoose.Types.ObjectId();
      await destConn.db.collection('churches').insertOne({
        _id: defaultChurchId,
        name: 'Grace Ministry Church (GMC)',
        code: 'GMC001',
        settings: { requireApproval: false, allowSelfRegistration: true },
        createdAt: new Date(),
      });
    }

    // 2. Users
    const srcUsers = await srcConn.db.collection('users').find().toArray();
    console.log(`Found ${srcUsers.length} users in source.`);

    const roleMap = {
      admin: 'Admin',
      'sub-admin': 'Sub-Admin',
      guitarist: 'Guitarist',
      pianist: 'Keyboardist',
      singer: 'Singer',
      drummer: 'Drummer',
      bassist: 'Bassist',
      production: 'Production',
      member: 'Member',
      pending: 'Member',
    };

    const seenEmails = new Set();
    for (const u of srcUsers) {
      let username = (u.username || u.name || 'user_' + u._id.toString().substring(18)).toLowerCase().trim();
      let email = u.email || `${username}@wplanner.app`;
      if (seenEmails.has(email)) {
        email = `${username}_${u._id.toString().substring(18)}@wplanner.app`;
      }
      seenEmails.add(email);

      const rawRole = (u.teamRole || u.role || 'member').toLowerCase().trim();
      const mappedRole = roleMap[rawRole] || (rawRole === 'admin' ? 'Admin' : 'Member');
      const isAdmin = mappedRole === 'Admin' || u.role === 'admin';

      let userChurchId = defaultChurchId;
      if (u.church && mongoose.Types.ObjectId.isValid(u.church)) {
        userChurchId = new mongoose.Types.ObjectId(u.church);
      } else if (u.churchId && churchMap.has(u.churchId)) {
        userChurchId = churchMap.get(u.churchId);
      }

      const userDoc = {
        _id: u._id,
        name: u.name || u.username || 'Worship Member',
        email: email,
        password: u.password,
        role: mappedRole,
        isAdmin: isAdmin,
        isSubAdmin: mappedRole === 'Sub-Admin',
        churchId: userChurchId,
        approvalStatus: 'approved',
        manualAvailable: true,
        createdAt: u.createdAt || new Date(),
      };

      await destConn.db.collection('users').updateOne(
        { _id: u._id },
        { $set: userDoc },
        { upsert: true }
      );
      console.log(`Migrated user: ${username} -> email: ${email} (Role: ${mappedRole})`);
    }

    // 3. Songs / Songbanks
    const srcSongs = await srcConn.db.collection('songbanks').find().toArray();
    console.log(`Found ${srcSongs.length} songs in source.`);
    for (const s of srcSongs) {
      let songChurchId = defaultChurchId;
      if (s.churchId && churchMap.has(s.churchId)) {
        songChurchId = churchMap.get(s.churchId);
      }

      const songDoc = {
        _id: s._id,
        title: s.title || 'Untitled Song',
        artist: s.artist || 'Traditional',
        key: s.key || 'C',
        chords: s.chords || '',
        lyrics: s.lyrics || '',
        churchId: songChurchId,
        createdAt: s.createdAt || new Date(),
      };

      await destConn.db.collection('songs').updateOne(
        { _id: s._id },
        { $set: songDoc },
        { upsert: true }
      );
      console.log(`Migrated song: "${s.title}"`);
    }

    // 4. Events
    const srcEvents = await srcConn.db.collection('events').find().toArray();
    console.log(`Found ${srcEvents.length} events in source.`);
    for (const ev of srcEvents) {
      let evChurchId = defaultChurchId;
      if (ev.churchId && churchMap.has(ev.churchId)) {
        evChurchId = churchMap.get(ev.churchId);
      }

      const eventDate = ev.date ? new Date(ev.date) : new Date();
      const startDate = isNaN(eventDate.getTime()) ? new Date() : eventDate;
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      const assignments = (ev.team || []).map((t) => ({
        userId: t.userId,
        role: roleMap[(t.role || '').toLowerCase()] || t.role || 'Team Member',
        status: 'accepted',
      }));

      const setlistSongIds = [];
      if (Array.isArray(ev.setList)) {
        for (const item of ev.setList) {
          if (item._id) setlistSongIds.push(item._id);
        }
      }

      const eventDoc = {
        _id: ev._id,
        churchId: evChurchId,
        event: {
          title: ev.title || 'Sunday Worship Service',
          type: 'service',
          status: ev.completed ? 'completed' : 'published',
        },
        schedule: {
          start: startDate,
          end: endDate,
          timezone: 'UTC',
        },
        assignments: assignments,
        setlist: setlistSongIds,
        createdAt: ev.createdAt || new Date(),
      };

      await destConn.db.collection('events').updateOne(
        { _id: ev._id },
        { $set: eventDoc },
        { upsert: true }
      );
      console.log(`Migrated event: "${ev.title || 'Event'}" with ${assignments.length} assignments.`);
    }

    console.log('\n--- Migration Completed Successfully! ---');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await srcConn.close();
    await destConn.close();
  }
}

migrateData();
