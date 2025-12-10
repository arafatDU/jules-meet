'use client';
import { useEffect, useState, useRef } from 'react';
import useMediasoup from '../hooks/useMediasoup';

const VideoCard = ({ peer }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div style={{ margin: '10px', border: '1px solid #ccc', padding: '5px' }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={peer.isLocal} // Mute local video to avoid feedback
                style={{ width: '300px', height: 'auto', backgroundColor: 'black' }}
            />
            <div>{peer.isLocal ? 'Me' : 'Peer'} ({peer.kind})</div>
        </div>
    );
};

export default function Room() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const { connected, peers, produce } = useMediasoup(joined ? roomId : null);

  const handleJoin = () => {
      if (roomId) {
          setJoined(true);
      }
  };

  const createMeeting = () => {
      const newRoomId = Math.random().toString(36).substring(7);
      setRoomId(newRoomId);
      setJoined(true);
  }

  return (
    <div style={{ padding: '20px' }}>
      {!joined ? (
          <div>
            <h1>Create or Join Meeting</h1>
            <div style={{ marginBottom: '20px' }}>
                <button onClick={createMeeting} style={{ marginRight: '10px' }}>Create New Meeting</button>
            </div>
            <div>
                <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    style={{ marginRight: '10px' }}
                />
                <button onClick={handleJoin} disabled={!roomId}>Join with Room ID</button>
            </div>
          </div>
      ) : (
          <div>
              <h1>Meeting Room: {roomId}</h1>
              <div>Status: {connected ? 'Connected to SFU' : 'Connecting...'}</div>

              <div style={{ marginBottom: '20px' }}>
                  <button onClick={() => produce('video')} disabled={!connected}>Enable Video</button>
                  <button onClick={() => produce('audio')} style={{ marginLeft: '10px' }} disabled={!connected}>Enable Audio</button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {peers.map((peer, idx) => (
                      <VideoCard key={idx} peer={peer} />
                  ))}
              </div>
          </div>
      )}
    </div>
  );
}
