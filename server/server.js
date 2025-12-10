require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const config = require('./config');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

let workers = [];
let nextWorkerIdx = 0;
let rooms = new Map(); // Map<roomName, { router, peers: Set<socketId>, worker } >
let producers = [];
let consumers = [];
let transports = [];
let peers = {};

// Mediasoup Utils
async function createWorkers() {
    const { numWorkers } = config.mediasoup;
    console.log(`Creating ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: config.mediasoup.worker.logLevel,
            logTags: config.mediasoup.worker.logTags,
            rtcMinPort: config.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
        });

        worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });

        workers.push(worker);
    }
}

function getWorker() {
    const worker = workers[nextWorkerIdx];
    if (++nextWorkerIdx === workers.length) nextWorkerIdx = 0;
    return worker;
}

async function getOrCreateRoom(roomName) {
  let room = rooms.get(roomName);
  if (!room) {
      const worker = getWorker();
      const mediaCodecs = config.mediasoup.router.mediaCodecs;
      const router = await worker.createRouter({ mediaCodecs });
      room = { router, peers: new Set(), worker };
      rooms.set(roomName, room);
      console.log(`Created new router for room: ${roomName} on worker pid: ${worker.pid}`);
  }
  return room;
}

// Start the server
(async () => {
  await createWorkers();

  server.listen(config.listenPort, () => {
    console.log(`Server listening on port ${config.listenPort}`);
  });
})();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('connection-success', {
    socketId: socket.id,
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // clean up consumers
    consumers.forEach(c => {
        if (c.socketId === socket.id) {
            c.consumer.close();
        }
    });
    consumers = consumers.filter(c => c.socketId !== socket.id);

    // clean up producers
    producers.forEach(p => {
        if (p.socketId === socket.id) {
            p.producer.close();
        }
    });
    producers = producers.filter(p => p.socketId !== socket.id);

    // clean up transports
    transports.forEach(t => {
        if (t.socketId === socket.id) {
            t.transport.close();
        }
    });
    transports = transports.filter(t => t.socketId !== socket.id);

    if (peers[socket.id]) {
        const roomName = peers[socket.id].roomName;

        const room = rooms.get(roomName);
        if (room) {
            room.peers.delete(socket.id);
            if (room.peers.size === 0) {
                console.log(`Closing router for room: ${roomName}`);
                room.router.close();
                rooms.delete(roomName);
            }
        }

        socket.to(roomName).emit('peer-left', { socketId: socket.id });
        delete peers[socket.id];
    }
  });

  socket.on('joinRoom', async ({ roomName, displayName }, callback) => {
    socket.join(roomName);
    peers[socket.id] = { roomName, displayName };

    const room = await getOrCreateRoom(roomName);
    room.peers.add(socket.id);

    socket.to(roomName).emit('new-peer', {
        socketId: socket.id,
        displayName,
    });

    const rtpCapabilities = room.router.rtpCapabilities;
    callback({ rtpCapabilities });
  });

  socket.on('producer-close', ({ producerId }) => {
    const producerData = producers.find(p => p.producer.id === producerId);
    if (producerData && producerData.socketId === socket.id) {
        producerData.producer.close();
        producers = producers.filter(p => p.producer.id !== producerId);

        // Notify others
        const roomName = peers[socket.id]?.roomName;
        if (roomName) {
            socket.to(roomName).emit('producer-closed', { remoteProducerId: producerId });
        }
    }
  });

  socket.on('getPeers', (callback) => {
      const roomName = peers[socket.id]?.roomName;
      let peerList = [];
      Object.keys(peers).forEach(socketId => {
          if (socketId !== socket.id && peers[socketId].roomName === roomName) {
              peerList.push({
                  socketId,
                  displayName: peers[socketId].displayName
              });
          }
      });
      callback(peerList);
  });

  socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
    // consumer is boolean, if true creating consumer transport
    try {
      const roomName = peers[socket.id]?.roomName;
      const room = rooms.get(roomName);
      if (!room) throw new Error('Room not found');

      const webRtcTransport_options = {
        listenIps: config.mediasoup.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      };

      const transport = await room.router.createWebRtcTransport(webRtcTransport_options);

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      transport.on('close', () => {
        console.log('transport closed');
      });

      // Add to transports array
      transports.push({
        socketId: socket.id,
        transport,
        consumer
      });

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });
    } catch (error) {
      console.error(error);
      callback({
        params: {
          error: error
        }
      });
    }
  });

  socket.on('transport-connect', async ({ dtlsParameters }) => {
    const transportData = transports.find(t => t.socketId === socket.id && !t.consumer);
    if(transportData) {
        await transportData.transport.connect({ dtlsParameters });
    }
  });

  socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
    const transportData = transports.find(t => t.socketId === socket.id && !t.consumer);
    if(transportData) {
        const producer = await transportData.transport.produce({
            kind,
            rtpParameters,
        });

        const roomName = peers[socket.id]?.roomName;

        producers.push({
            socketId: socket.id,
            producer,
            roomName: roomName
        });

        producer.on('transportclose', () => {
            console.log('producer transport close');
            producer.close();
        });

        console.log('Producer created:', producer.id, kind);

        // Notify other clients in the room about the new producer
        socket.to(roomName).emit('new-producer', {
            producerId: producer.id,
            socketId: socket.id,
            appData: producer.appData
        });

        callback({
            id: producer.id,
            producersExist: producers.length > 1 ? true : false
        });
    }
  });

  socket.on('transport-recv-connect', async ({ dtlsParameters, serverConsumerTransportId }) => {
    const transportData = transports.find(t => t.transport.id === serverConsumerTransportId && t.consumer);
    if(transportData) {
        await transportData.transport.connect({ dtlsParameters });
    }
  });

  socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
    try {
        const roomName = peers[socket.id]?.roomName;
        const room = rooms.get(roomName);
        if (!room) throw new Error('Room not found');

        const transportData = transports.find(t => t.transport.id === serverConsumerTransportId && t.consumer);
        const transport = transportData.transport;

        // check if router can consume
        if (room.router.canConsume({
            producerId: remoteProducerId,
            rtpCapabilities
        })) {
            const consumer = await transport.consume({
                producerId: remoteProducerId,
                rtpCapabilities,
                paused: true,
            });

            consumer.on('transportclose', () => {
                console.log('consumer transport close');
            });

            consumer.on('producerclose', () => {
                console.log('consumer producer close');
                socket.emit('producer-closed', { remoteProducerId });
                transportData.consumerObj = null;
                consumer.close();
                consumers = consumers.filter(c => c.consumer.id !== consumer.id);
            });

            consumers.push({
                socketId: socket.id,
                consumer,
                roomName: 'default'
            });

            callback({
                params: {
                    id: consumer.id,
                    producerId: remoteProducerId,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                    serverConsumerId: consumer.id,
                }
            });
        } else {
             callback({
                params: {
                    error: 'Router cannot consume'
                }
            });
        }
    } catch (error) {
        console.error('consume error', error);
        callback({
            params: {
                error: error
            }
        });
    }
  });

  socket.on('consumer-resume', async ({ serverConsumerId }) => {
      const consumerData = consumers.find(c => c.consumer.id === serverConsumerId);
      if (consumerData) {
          await consumerData.consumer.resume();
      }
  });

  socket.on('getProducers', callback => {
      // return all producers in the same room except the one from this socket
      const roomName = peers[socket.id]?.roomName;
      let returnProducers = [];
      producers.forEach(p => {
         if (p.socketId !== socket.id && p.roomName === roomName) {
             returnProducers.push({
                 producerId: p.producer.id,
                 socketId: p.socketId,
                 appData: p.producer.appData
             });
         }
      });
      callback(returnProducers);
  });
});
