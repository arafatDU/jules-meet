import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

const useMediasoup = (roomId, displayName) => {
  // Peers structure: { socketId: string, displayName: string, audioStream: MediaStream, videoStream: MediaStream, isLocal: boolean }
  const [peers, setPeers] = useState([]);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const consumerTransportsRef = useRef([]);

  const [connected, setConnected] = useState(false);

  // Local Media State
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);

  // References to local producers to pause/close
  const audioProducerRef = useRef(null);
  const videoProducerRef = useRef(null);

  const transportCreationPromiseRef = useRef(null);

  useEffect(() => {
    if (!roomId || !displayName) return;

    // 1. Connect to Socket.io
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl);

    socketRef.current.on('connection-success', ({ socketId }) => {
      console.log('Connected to server with ID:', socketId);
      // Initialize local peer
      setPeers([{
          socketId: socketId,
          displayName: displayName + ' (You)',
          isLocal: true,
          audioStream: null,
          videoStream: null
      }]);
      joinRoom();
    });

    socketRef.current.on('new-peer', ({ socketId, displayName }) => {
        setPeers(prev => {
            if (prev.find(p => p.socketId === socketId)) return prev;
            return [...prev, {
                socketId,
                displayName,
                isLocal: false,
                audioStream: null,
                videoStream: null
            }];
        });
    });

    socketRef.current.on('peer-left', ({ socketId }) => {
        setPeers(prev => prev.filter(p => p.socketId !== socketId));
    });

    socketRef.current.on('new-producer', ({ producerId, socketId, appData }) => {
      console.log('New producer joined:', producerId);
      consumeWrapper(producerId, socketId, appData);
    });

    socketRef.current.on('producer-closed', ({ remoteProducerId }) => {
        // We need to find which peer had this producer and remove the track
        // But tracking which producer belongs to which peer and track type is tricky without storing producerId
        // Simpler: reload or re-fetch?
        // Better: We track producerIds in the peer object or just let the tracks stop?
        // Ideally we should update state.
        // For simplicity, we might leave the stream there (it will stop playing),
        // OR we can iterate peers and remove the stream that has a track with ended state?
        // Let's rely on the fact that if a track ends, the video element stops.
        // But to update UI state (e.g. show avatar instead of video), we need to update state.

        // Actually, we can store producerIds in the peer object too.
        setPeers(prev => prev.map(p => {
            if (p.audioProducerId === remoteProducerId) {
                 return { ...p, audioStream: null, audioProducerId: null };
            }
            if (p.videoProducerId === remoteProducerId) {
                 return { ...p, videoStream: null, videoProducerId: null };
            }
            return p;
        }));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomId, displayName]);

  const joinRoom = () => {
    socketRef.current.emit('joinRoom', { roomName: roomId, displayName }, (data) => {
        loadDevice(data.rtpCapabilities);
    });
  };

  const loadDevice = async (routerRtpCapabilities) => {
      try {
          deviceRef.current = new mediasoupClient.Device();
          await deviceRef.current.load({ routerRtpCapabilities });
          console.log('Device loaded');
          initTransports();
      } catch (error) {
          console.error('Failed to load device', error);
      }
  };

  const initTransports = async () => {
      // Create Producer Transport
      socketRef.current.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
          if (params.error) {
              console.error(params.error);
              return;
          }

          producerTransportRef.current = deviceRef.current.createSendTransport(params);

          producerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
              try {
                  socketRef.current.emit('transport-connect', { dtlsParameters });
                  callback();
              } catch (error) {
                  errback(error);
              }
          });

          producerTransportRef.current.on('produce', async (parameters, callback, errback) => {
              try {
                  socketRef.current.emit('transport-produce', {
                      kind: parameters.kind,
                      rtpParameters: parameters.rtpParameters,
                      appData: parameters.appData,
                  }, ({ id, producersExist }) => {
                      callback({ id });
                  });
              } catch (error) {
                  errback(error);
              }
          });

          setConnected(true);
      });
  };

  const publishTrack = async (track, type) => {
      if (!deviceRef.current || !producerTransportRef.current) return null;
      try {
          const producer = await producerTransportRef.current.produce({
              track,
              appData: { displayName, kind: type }
          });

          return producer;
      } catch (err) {
          console.error('Publish error:', err);
          return null;
      }
  };

  const toggleMic = async () => {
      if (isAudioOn) {
          // Turn off
          if (audioProducerRef.current) {
              audioProducerRef.current.close();
              setPeers(prev => prev.map(p => {
                  if (p.isLocal) return { ...p, audioStream: null };
                  return p;
              }));
              audioProducerRef.current = null;
          }
          setIsAudioOn(false);
      } else {
          // Turn on
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const track = stream.getAudioTracks()[0];
              const producer = await publishTrack(track, 'audio');
              if (producer) {
                  audioProducerRef.current = producer;
                  setPeers(prev => prev.map(p => {
                      if (p.isLocal) return { ...p, audioStream: new MediaStream([track]) };
                      return p;
                  }));
                  setIsAudioOn(true);
              }
          } catch (err) {
              console.error('Failed to enable audio', err);
          }
      }
  };

  const toggleWebcam = async () => {
      if (isVideoOn) {
          // Turn off
          if (videoProducerRef.current) {
              videoProducerRef.current.close();
              setPeers(prev => prev.map(p => {
                  if (p.isLocal) return { ...p, videoStream: null };
                  return p;
              }));
              videoProducerRef.current = null;
          }
          setIsVideoOn(false);
      } else {
          // Turn on
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              const track = stream.getVideoTracks()[0];
              const producer = await publishTrack(track, 'video');
              if (producer) {
                  videoProducerRef.current = producer;
                  setPeers(prev => prev.map(p => {
                      if (p.isLocal) return { ...p, videoStream: new MediaStream([track]) };
                      return p;
                  }));
                  setIsVideoOn(true);
              }
          } catch (err) {
              console.error('Failed to enable video', err);
          }
      }
  };

  const getRecvTransport = async () => {
     if (consumerTransportsRef.current.length > 0) {
         return consumerTransportsRef.current[0];
     }

     if (transportCreationPromiseRef.current) {
         return transportCreationPromiseRef.current;
     }

     transportCreationPromiseRef.current = new Promise((resolve, reject) => {
         socketRef.current.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {
             if (params.error) {
                 console.error(params.error);
                 transportCreationPromiseRef.current = null;
                 return reject(params.error);
             }

             const transport = deviceRef.current.createRecvTransport(params);

             transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                 socketRef.current.emit('transport-recv-connect', {
                     dtlsParameters,
                     serverConsumerTransportId: transport.id,
                 });
                 callback();
             });

             consumerTransportsRef.current.push(transport);
             resolve(transport);
         });
     });

     return transportCreationPromiseRef.current;
  }

  const consumeActual = async (remoteProducerId, socketId, appData) => {
      if (!deviceRef.current || !deviceRef.current.loaded) return;

      const transport = await getRecvTransport();
      const rtpCapabilities = deviceRef.current.rtpCapabilities;

      socketRef.current.emit('consume', {
          rtpCapabilities,
          remoteProducerId,
          serverConsumerTransportId: transport.id,
      }, async ({ params }) => {
          if (params.error) {
              console.error('Consume error', params.error);
              return;
          }

          const consumer = await transport.consume({
              id: params.id,
              producerId: params.producerId,
              kind: params.kind,
              rtpParameters: params.rtpParameters,
          });

          const { track } = consumer;
          const newStream = new MediaStream([track]);

          // Update peers list
          setPeers(prev => {
              // Check if peer already exists
              const existingPeer = prev.find(p => p.socketId === socketId);
              if (existingPeer) {
                  return prev.map(p => {
                      if (p.socketId === socketId) {
                          if (params.kind === 'video') {
                              return { ...p, videoStream: newStream, videoProducerId: remoteProducerId };
                          } else {
                              return { ...p, audioStream: newStream, audioProducerId: remoteProducerId };
                          }
                      }
                      return p;
                  });
              } else {
                  // Fallback if peer doesn't exist yet (race condition?), usually shouldn't happen with getPeers
                  return [...prev, {
                      socketId,
                      displayName: appData?.displayName || 'Participant',
                      isLocal: false,
                      videoStream: params.kind === 'video' ? newStream : null,
                      audioStream: params.kind === 'audio' ? newStream : null,
                      videoProducerId: params.kind === 'video' ? remoteProducerId : null,
                      audioProducerId: params.kind === 'audio' ? remoteProducerId : null
                  }];
              }
          });

          socketRef.current.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });
      });
  };

  const consumeWrapper = (remoteProducerId, socketId, appData) => {
      consumeActual(remoteProducerId, socketId, appData);
  }

  const getProducers = () => {
      socketRef.current.emit('getProducers', (producers) => {
          producers.forEach(p => consumeWrapper(p.producerId, p.socketId, p.appData));
      });
  }

  // Correction: getProducers logic needs socketId.
  // I will have to fix this in the next tool call, but first let's finish useMediasoup and then fix that via diff.

  // Let's implement fetchPeers
  const fetchPeers = () => {
      socketRef.current.emit('getPeers', (peerList) => {
         setPeers(prev => {
             // Merge with existing (don't overwrite local)
             const newPeers = [...prev];
             peerList.forEach(remotePeer => {
                 if (!newPeers.find(p => p.socketId === remotePeer.socketId)) {
                     newPeers.push({
                         socketId: remotePeer.socketId,
                         displayName: remotePeer.displayName,
                         isLocal: false,
                         audioStream: null,
                         videoStream: null
                     });
                 }
             });
             return newPeers;
         });
      });
  }

  useEffect(() => {
    if(connected) {
        fetchPeers();
        // Delay getProducers slightly or call it after peers are fetched?
        // Actually, getProducers returns producers. We need to match them to peers.
        // We need socketId in getProducers response.
        getProducers();
    }
  }, [connected]);

  return {
      connected,
      peers,
      toggleMic,
      toggleWebcam,
      isAudioOn,
      isVideoOn
  };
};

export default useMediasoup;
