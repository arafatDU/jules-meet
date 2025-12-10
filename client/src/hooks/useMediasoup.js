import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

const useMediasoup = (roomId) => {
  const [peers, setPeers] = useState([]); // List of audio/video streams to render
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const consumerTransportsRef = useRef([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    // 1. Connect to Socket.io
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl);

    socketRef.current.on('connection-success', ({ socketId }) => {
      console.log('Connected to server with ID:', socketId);
      joinRoom();
    });

    socketRef.current.on('new-producer', ({ producerId }) => {
      console.log('New producer joined:', producerId);
      consumeWrapper(producerId);
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
                      if (producersExist) getProducers();
                  });
              } catch (error) {
                  errback(error);
              }
          });

          setConnected(true);
      });

      // Create Consumer Transport (Usually we might need one per consumer or reuse one for all consumers?
      // Mediasoup client usually recommends separate transports or consuming on a separate recv transport.
      // We will create ONE recv transport for all consumers to reuse if possible, or create as needed.
      // Typically, one RecvTransport is enough for all consumers.

      // But wait, the server logic I wrote expects `createWebRtcTransport` to be called.
      // I should create a recv transport now and keep it ready.

      // Actually, creating it when we need to consume is also fine, but establishing it early is better.
  };

  const produce = async (type) => {
    if (!deviceRef.current || !producerTransportRef.current) return;

    try {
        let stream;
        let track;
        if (type === 'video') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            track = stream.getVideoTracks()[0];
        } else {
             stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             track = stream.getAudioTracks()[0];
        }

        const producer = await producerTransportRef.current.produce({ track });

        producer.on('trackended', () => {
            console.log('track ended');
            // close producer
        });

        producer.on('close', () => {
            console.log('producer closed');
        });

        // Add local video to peers list or handle separately?
        // Usually local video is shown separately. But let's add it to peers for grid simplification with a flag isLocal.
        setPeers(prev => [...prev, {
            id: 'local-' + type,
            stream: new MediaStream([track]),
            isLocal: true,
            kind: type
        }]);

    } catch (err) {
        console.error('Publish error:', err);
    }
  };

  // Placeholder for consume logic, actual implementation is in consumeActual/consumeWrapper
  // Removing the empty function to avoid confusion, but keeping it as a comment for reference of where it was replaced.

  // Re-implementing consume to correctly handle the RecvTransport creation
  const transportCreationPromiseRef = useRef(null);

  const getRecvTransport = async () => {
     if (consumerTransportsRef.current.length > 0) {
         return consumerTransportsRef.current[0]; // Reuse the first one for simplicity
     }

     if (transportCreationPromiseRef.current) {
         return transportCreationPromiseRef.current;
     }

     // Create new
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

  const consumeActual = async (remoteProducerId) => {
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
              isLocal: false
          }]);

          socketRef.current.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });
      });
  };

  // Update consume function
  const consumeWrapper = (remoteProducerId) => {
      consumeActual(remoteProducerId);
  }

  const getProducers = () => {
      socketRef.current.emit('getProducers', (producerIds) => {
          producerIds.forEach(id => consumeWrapper(id));
      });
  }

  // Fetch existing producers when connected
  useEffect(() => {
    if(connected) {
        getProducers();
    }
  }, [connected]);

  return {
      connected,
      peers,
      produce,
      consume: consumeWrapper
  };
};

export default useMediasoup;
