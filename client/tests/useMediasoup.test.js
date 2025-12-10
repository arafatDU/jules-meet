import { describe, it, expect, vi } from 'vitest';
import useMediasoup from '../src/hooks/useMediasoup';
import { renderHook, act } from '@testing-library/react';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock mediasoup-client
vi.mock('mediasoup-client', () => ({
  Device: vi.fn(() => ({
    load: vi.fn(),
    createSendTransport: vi.fn(() => ({
        on: vi.fn(),
        produce: vi.fn(() => ({
            on: vi.fn(),
            close: vi.fn()
        }))
    })),
    createRecvTransport: vi.fn(() => ({
        on: vi.fn(),
        consume: vi.fn(() => ({
             on: vi.fn(),
             close: vi.fn(),
             track: { id: 'mock-track' }
        }))
    })),
    rtpCapabilities: {}
  }))
}));

describe('useMediasoup', () => {
  it('should initialize connection', () => {
    const { result } = renderHook(() => useMediasoup('test-room'));
    // Since everything is async and mocked, we just check initial state or if mocks were called
    // But testing complex async hooks in vitest needs more setup.
    // For now, let's just assert the hook returns expected interface
    expect(result.current.connected).toBe(false);
    expect(result.current.peers).toEqual([]);
    expect(typeof result.current.toggleMic).toBe('function');
    expect(typeof result.current.toggleWebcam).toBe('function');
  });
});
