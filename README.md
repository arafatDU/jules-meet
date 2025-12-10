# Multi-Person Meeting App

A real-time video conferencing application built with Node.js, Next.js, and Mediasoup (SFU).

## Prerequisites

- Node.js (v18 or higher recommended)
- Python 3 (required for building Mediasoup)
- Make, GCC/G++ (required for building Mediasoup)

## Project Structure

- `client/`: Next.js frontend application.
- `server/`: Node.js Express + Mediasoup backend application.

## Installation

### 1. Server

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

### 2. Client

Navigate to the client directory and install dependencies:

```bash
cd client
npm install
```

## Configuration (Environment Variables)

### Server (`server/.env` or environment)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the server listens on | `3001` |
| `MEDIASOUP_ANNOUNCED_IP` | The public IP address of your server. Crucial for remote connections. | `127.0.0.1` |

Example:
```bash
export PORT=3001
export MEDIASOUP_ANNOUNCED_IP=192.168.1.50
```

### Client (`client/.env.local` or environment)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SOCKET_URL` | The URL of the backend server (Socket.io) | `http://localhost:3001` |

Example:
```bash
NEXT_PUBLIC_SOCKET_URL=http://192.168.1.50:3001
```

## Running the Application

### 1. Start the Server

```bash
cd server
npm start
# Or for development
node server.js
```

The server will start on port 3001 (or configured PORT).

### 2. Start the Client

```bash
cd client
npm run dev
```

The client will start on `http://localhost:3000`.

## Usage

1. Open `http://localhost:3000` in your browser.
2. Click "Create New Meeting" to generate a Room ID, or enter an existing Room ID.
3. Once joined, click "Enable Video" and "Enable Audio" to start streaming.
4. Share the Room ID with others. When they join and enable their streams, you will see them in the grid.

## Troubleshooting

- **No Video/Audio on remote devices:** Ensure `MEDIASOUP_ANNOUNCED_IP` is set to the machine's LAN/Public IP, not `127.0.0.1`. Also ensure `NEXT_PUBLIC_SOCKET_URL` on the client points to that IP.
- **Mediasoup build errors:** Ensure you have python and build tools (C++ compiler) installed.
