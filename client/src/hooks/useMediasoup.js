import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

const useMediasoup = (roomId, displayName) => {
  const [peers, setPeers] = useState([]); // List of audio/video streams to render
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
    if (!roomId) return;

    // 1. Connect to Socket.io
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl);

    socketRef.current.on('connection-success', ({ socketId }) => {
      console.log('Connected to server with ID:', socketId);
      joinRoom();
    });

    socketRef.current.on('new-producer', ({ producerId, appData }) => {
      console.log('New producer joined:', producerId);
      consumeWrapper(producerId, appData);
    });

    socketRef.current.on('producer-closed', ({ remoteProducerId }) => {
        setPeers((prev) => prev.filter(p => p.producerId !== remoteProducerId));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomId]);

  const joinRoom = () => {
    socketRef.current.emit('joinRoom', { roomName: roomId }, (data) => {
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
                      // We don't call getProducers here anymore, we do it when connected
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

          producer.on('trackended', () => {
              console.log('track ended');
              // Optionally handle
          });

          producer.on('close', () => {
              console.log('producer closed');
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
              // Remove from peers
              setPeers(prev => prev.filter(p => p.id !== 'local-audio'));
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
                  setPeers(prev => [...prev, {
                      id: 'local-audio',
                      stream: new MediaStream([track]),
                      isLocal: true,
                      kind: 'audio',
                      displayName: displayName + ' (You)'
                  }]);
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
              setPeers(prev => prev.filter(p => p.id !== 'local-video'));
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
                  setPeers(prev => [...prev, {
                      id: 'local-video',
                      stream: new MediaStream([track]),
                      isLocal: true,
                      kind: 'video',
                      displayName: displayName + ' (You)'
                  }]);
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

  const consumeActual = async (remoteProducerId, appData) => {
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

          setPeers(prev => [...prev, {
              producerId: remoteProducerId,
              stream: newStream,
              kind: params.kind,
              isLocal: false,
              displayName: appData?.displayName || 'Participant'
          }]);

          socketRef.current.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });
      });
  };

  const consumeWrapper = (remoteProducerId, appData) => {
      consumeActual(remoteProducerId, appData);
  }

  const getProducers = () => {
      socketRef.current.emit('getProducers', (producers) => {
          // producers is now an array of { producerId, appData }
          producers.forEach(p => consumeWrapper(p.producerId, p.appData));
      });
  }

  useEffect(() => {
    if(connected) {
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
