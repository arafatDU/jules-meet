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
                {peer.displayName || 'Participant'}
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

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [startMeetingName, setStartMeetingName] = useState('');
  const [joinMeetingName, setJoinMeetingName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');

  const handleStartMeeting = () => {
      if (!startMeetingName) {
          alert('Please enter your name');
          return;
      }
      setDisplayName(startMeetingName);
      const newRoomId = Math.random().toString(36).substring(7);
      setRoomId(newRoomId);
      setJoined(true);
  };

  const handleJoinMeeting = () => {
      if (!joinMeetingName || !joinRoomId) {
          alert('Please enter your name and meeting code');
          return;
      }
      setDisplayName(joinMeetingName);
      setRoomId(joinRoomId);
      setJoined(true);
  };

  if (!joined) {
      return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f0f2f5',
            fontFamily: 'Arial, sans-serif'
        }}>
            {/* Navbar */}
            <nav style={{
                backgroundColor: 'white',
                padding: '18px 40px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                {/* Logo/Brand */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" style={{ display: 'block' }}>
                        <rect x="4" y="10" width="24" height="16" rx="2" fill="none" stroke="#5B6AF5" strokeWidth="2"/>
                        <circle cx="16" cy="18" r="3" fill="#5B6AF5"/>
                        <path d="M 28 14 L 30 12 L 30 22 L 28 20" fill="#5B6AF5"/>
                    </svg>
                    <span style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#2d3748',
                        letterSpacing: '-0.5px'
                    }}>
                        STL-Meet
                    </span>
                </div>

                {/* Profile Section */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#f7fafc',
                            border: '2px solid #e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            padding: 0
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e0';
                            e.currentTarget.style.backgroundColor = '#edf2f7';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.backgroundColor = '#f7fafc';
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="7" r="3" stroke="#4a5568" strokeWidth="1.5"/>
                            <path d="M 4 17 Q 4 13 10 13 Q 16 13 16 17" stroke="#4a5568" strokeWidth="1.5" fill="none"/>
                        </svg>
                    </button>
                    {showProfileMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '50px',
                            right: '0',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            padding: '12px 20px',
                            minWidth: '120px',
                            zIndex: 1000
                        }}>
                            <div style={{
                                color: '#333',
                                fontSize: '16px',
                                fontWeight: '500'
                            }}>
                                Guest
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Main Content */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '80px 20px 60px',
                gap: '30px'
            }}>
                {/* Two Boxes Container */}
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    width: '100%',
                    maxWidth: '920px'
                }}>
                    {/* Start Meeting Box */}
                    <div style={{
                        flex: '1',
                        minWidth: '300px',
                        maxWidth: '440px',
                        padding: '32px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '4px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#5B6AF5" strokeWidth="2"/>
                                <line x1="16" y1="10" x2="16" y2="22" stroke="#5B6AF5" strokeWidth="2" strokeLinecap="round"/>
                                <line x1="10" y1="16" x2="22" y2="16" stroke="#5B6AF5" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: '600',
                                color: '#2d3748',
                                margin: 0
                            }}>
                                Start a Meeting
                            </h2>
                        </div>
                        <p style={{
                            color: '#718096',
                            fontSize: '14px',
                            margin: '0 0 8px 0',
                            lineHeight: '1.5'
                        }}>
                            Create a new meeting and share the code with others.
                        </p>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={startMeetingName}
                            onChange={(e) => setStartMeetingName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #e2e8f0',
                                fontSize: '15px',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#5B6AF5'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <button
                            onClick={handleStartMeeting}
                            disabled={!startMeetingName}
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: startMeetingName ? '#5B6AF5' : '#cbd5e0',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: startMeetingName ? 'pointer' : 'not-allowed',
                                fontSize: '15px',
                                fontWeight: '600',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit'
                            }}
                            onMouseEnter={(e) => {
                                if (startMeetingName) {
                                    e.currentTarget.style.backgroundColor = '#4C5DE4';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (startMeetingName) {
                                    e.currentTarget.style.backgroundColor = '#5B6AF5';
                                }
                            }}
                        >
                            Start Meeting
                        </button>
                    </div>

                    {/* Join Meeting Box */}
                    <div style={{
                        flex: '1',
                        minWidth: '300px',
                        maxWidth: '440px',
                        padding: '32px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '4px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#48BB78" strokeWidth="2"/>
                                <path d="M 12 16 L 16 20 L 22 12" fill="none" stroke="#48BB78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: '600',
                                color: '#2d3748',
                                margin: 0
                            }}>
                                Join a Meeting
                            </h2>
                        </div>
                        <p style={{
                            color: '#718096',
                            fontSize: '14px',
                            margin: '0 0 8px 0',
                            lineHeight: '1.5'
                        }}>
                            Enter your details and meeting code to join.
                        </p>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={joinMeetingName}
                            onChange={(e) => setJoinMeetingName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #e2e8f0',
                                fontSize: '15px',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#48BB78'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <input
                            type="text"
                            placeholder="Enter meeting code"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #e2e8f0',
                                fontSize: '15px',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#48BB78'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <button
                            onClick={handleJoinMeeting}
                            disabled={!joinMeetingName || !joinRoomId}
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: (joinMeetingName && joinRoomId) ? '#48BB78' : '#cbd5e0',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: (joinMeetingName && joinRoomId) ? 'pointer' : 'not-allowed',
                                fontSize: '15px',
                                fontWeight: '600',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit'
                            }}
                            onMouseEnter={(e) => {
                                if (joinMeetingName && joinRoomId) {
                                    e.currentTarget.style.backgroundColor = '#38A169';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (joinMeetingName && joinRoomId) {
                                    e.currentTarget.style.backgroundColor = '#48BB78';
                                }
                            }}
                        >
                            Join Meeting
                        </button>
                    </div>
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
