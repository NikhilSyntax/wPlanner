import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function SongDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [targetKey, setTargetKey] = useState('');
  const [transposed, setTransposed] = useState(null);

  useEffect(() => { fetchSong(); }, [id]);

  const fetchSong = async () => {
    try {
      const res = await api.get(`/songs/${id}`);
      setSong(res.data);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this song?')) return;
    try {
      await api.delete(`/songs/${id}`);
      navigate('/songs');
    } catch (err) { console.error(err); alert('Error deleting song'); }
  };

  const handleTranspose = async () => {
    if (!targetKey) return;
    try {
      const res = await api.post(`/songs/${id}/transpose`, { targetKey });
      setTransposed(res.data);
    } catch (err) { console.error(err); }
  };

  if (!song) return <div>Loading...</div>;

  return (
    <div className="song-details">
      <Link to="/songs">← Back to Song Bank</Link>
      <h2>{song.title}</h2>
      <p><strong>Artist:</strong> {song.artist || 'Unknown'}</p>
      <p><strong>Album:</strong> {song.album || 'N/A'}</p>
      <p><strong>Original Key:</strong> {song.key}</p>
      <p><strong>BPM:</strong> {song.bpm || 'N/A'}</p>
      <p><strong>Time Signature:</strong> {song.timeSignature}</p>
      <p><strong>Genre:</strong> {(song.genre || []).join(', ') || 'N/A'}</p>

      <h3>Lyrics</h3>
      <pre>{song.content?.lyrics || 'No lyrics'}</pre>

      <h3>Chords</h3>
      <pre>{song.content?.chords || 'No chords'}</pre>

      <div className="transpose-section">
        <h3>Transpose</h3>
        <select value={targetKey} onChange={e => setTargetKey(e.target.value)}>
          <option value="">Select target key</option>
          {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <button onClick={handleTranspose}>Transpose</button>
        {transposed && (
          <div>
            <p>Transposed from {transposed.originalKey} to {transposed.targetKey}</p>
          </div>
        )}
      </div>

      <Link to={`/songs/${id}/edit`}>Edit Song</Link>
      <button onClick={handleDelete}>Delete Song</button>
    </div>
  );
}

export default SongDetails;
