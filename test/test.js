import { ChatClient } from '../index.js';

// Mock для тестирования
global.WebSocket = class MockWebSocket {
  constructor() { setTimeout(() => this.onopen?.(), 10); }
  close() { this.onclose?.(); }
  send() {}
};

global.EventSource = class MockEventSource {
  constructor() { setTimeout(() => this.onopen?.(), 10); }
  close() {}
};

global.fetch = async () => ({
  ok: true,
  json: async () => ({ success: true, token: 'test-token' })
});

async function test() {
  console.log('Testing...');
  
  const client = new ChatClient({
    serverUrl: 'http://localhost:3001'
  });

  // Test events
  client.on('connected', () => console.log('Connected'));
  client.on('message', (msg) => console.log('Message:', msg));

  // Test methods
  try {
    const login = await client.login('test', 'pass');
    console.log('Login:', login.success);
    
    const channels = await client.getChannels();
    console.log('Get channels:', channels.success);
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
