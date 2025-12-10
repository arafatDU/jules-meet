'use client';
import { useEffect, useState, useRef } from 'react';
import useMediasoup from '../hooks/useMediasoup';

const VideoCard = ({ peer }) => {
    const videoRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && peer.videoStream) {
            videoRef.current.srcObject = peer.videoStream;
        } else if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, [peer.videoStream]);

    useEffect(() => {
        if (audioRef.current && peer.audioStream) {
            audioRef.current.srcObject = peer.audioStream;
        }
    }, [peer.audioStream]);

    return (
        <div style={{
            position: 'relative',
            width: '300px',
            height: '225px',
            backgroundColor: '#202124',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: peer.isLocal ? '2px solid #007bff' : 'none' // Highlight local user
        }}>
            {peer.videoStream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={true} // Mute video element always, use audio element for sound (or mute if local)
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: peer.isLocal ? 'scaleX(-1)' : 'none' }}
                />
            ) : (
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: '#3c4043',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '32px',
                    fontWeight: 'bold'
                }}>
                    {peer.displayName ? peer.displayName.charAt(0).toUpperCase() : '?'}
                </div>
            )}

            {/* Audio element for remote peers */}
            {!peer.isLocal && (
                <audio ref={audioRef} autoPlay playsInline />
            )}

            <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                color: 'white',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                maxWidth: '90%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            }}>
                {peer.displayName || 'Participant'} {peer.isLocal ? '(You)' : ''}
            </div>
        </div>
    );
};

export default function Room() {
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joined, setJoined] = useState(false);

  const { connected, peers, toggleMic, toggleWebcam, isAudioOn, isVideoOn } = useMediasoup(joined ? roomId : null, displayName);

  const handleJoin = () => {
      if (roomId && displayName) {
          setJoined(true);
      }
  };

  const createMeeting = () => {
      if (!displayName) {
          alert('Please enter your name');
          return;
      }
      const newRoomId = Math.random().toString(36).substring(7);
      setRoomId(newRoomId);
      setJoined(true);
  }

  if (!joined) {
      return (
        <div style={{
            display: 'flex',
            height: '100vh',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{
                padding: '40px',
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                textAlign: 'center',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h1 style={{ marginBottom: '30px', color: '#333' }}>Join Meeting</h1>

                <input
                    type="text"
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '15px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        fontSize: '16px',
                        boxSizing: 'border-box'
                    }}
                />

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                     <input
                        type="text"
                        placeholder="Room ID"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            fontSize: '16px',
                            boxSizing: 'border-box'
                        }}
                    />
                    <button
                        onClick={handleJoin}
                        disabled={!roomId || !displayName}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            opacity: (!roomId || !displayName) ? 0.6 : 1
                        }}
                    >
                        Join
                    </button>
                </div>

                <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
                    <button
                        onClick={createMeeting}
                        disabled={!displayName}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            opacity: !displayName ? 0.6 : 1
                        }}
                    >
                        Create New Meeting
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#202124',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Meeting Room: {roomId}</div>
          <div style={{ fontSize: '14px', color: '#aaa' }}>{connected ? 'Connected' : 'Connecting...'}</div>
      </div>

      {/* Video Grid */}
      <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignContent: 'center',
          gap: '15px',
          overflowY: 'auto'
      }}>
          {peers.length === 0 && connected && (
              <div style={{ color: '#aaa', fontSize: '18px' }}>Waiting for others to join...</div>
          )}
          {peers.map((peer) => (
              <VideoCard key={peer.socketId} peer={peer} />
          ))}
      </div>

      {/* Bottom Bar */}
      <div style={{
          height: '80px',
          backgroundColor: '#1c1e21',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px'
      }}>
          {/* Audio Toggle */}
          <button
            onClick={toggleMic}
            disabled={!connected}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                color: isAudioOn ? 'white' : '#ea4335',
                cursor: 'pointer',
                minWidth: '80px'
            }}
          >
              <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: isAudioOn ? '#3c4043' : '#ea4335',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '5px'
              }}>
                  {isAudioOn ? '🎤' : '🔇'}
              </div>
              <span style={{ fontSize: '12px' }}>{isAudioOn ? 'Mute' : 'Unmute'}</span>
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleWebcam}
            disabled={!connected}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                color: isVideoOn ? 'white' : '#ea4335',
                cursor: 'pointer',
                minWidth: '80px'
            }}
          >
              <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: isVideoOn ? '#3c4043' : '#ea4335',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '5px'
              }}>
                  {isVideoOn ? '📹' : '🚫'}
              </div>
              <span style={{ fontSize: '12px' }}>{isVideoOn ? 'Stop Video' : 'Start Video'}</span>
          </button>

           {/* Leave Button */}
           <button
            onClick={() => window.location.reload()}
            style={{
                padding: '10px 20px',
                backgroundColor: '#ea4335',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                marginLeft: '20px'
            }}
          >
              Leave
          </button>
      </div>
    </div>
  );
}
