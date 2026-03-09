export class ChatClient {
  constructor(config) {
    this.config = {
      serverUrl: config.serverUrl.replace(/\/$/, ''),
      token: config.token || '',
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10
    };
    
    this.token = config.token || null;
    this.ws = null;
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.listeners = {};
  }

  // U2FsdGVkX18vpVzM7pg/r0s5zfEI0tRJEKsGNPeGbC2JnkUS5plFCzgpPhz67ve5
  on(event, listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
    return this;
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
    return this;
  }

  off(event, listener) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index > -1) this.listeners[event].splice(index, 1);
    }
    return this;
  }

  // Authentication
  async register(username, password) {
    return this.request('/api/register', {
      method: 'POST',
      body: { username, password }
    });
  }

  async login(username, password, twoFactorToken) {
    const response = await this.request('/api/login', {
      method: 'POST',
      body: { username, password, twoFactorToken }
    });
    
    if (response.success && response.token) {
      this.token = response.token;
      if (this.config.autoReconnect) {
        this.connectWebSocket();
        this.connectSSE();
      }
    }
    
    return response;
  }

  async verify2FALogin(username, sessionId, twoFactorToken) {
    const response = await this.request('/api/2fa/verify-login', {
      method: 'POST',
      body: { username, sessionId, twoFactorToken }
    });
    
    if (response.success && response.token) {
      this.token = response.token;
      if (this.config.autoReconnect) {
        this.connectWebSocket();
        this.connectSSE();
      }
    }
    
    return response;
  }

  setToken(token) {
    this.token = token;
    if (this.config.autoReconnect) {
      this.connectWebSocket();
      this.connectSSE();
    }
  }

  getToken() {
    return this.token;
  }

  // 2FA
  async setup2FA() {
    return this.request('/api/2fa/setup', { method: 'POST' });
  }

  async enable2FA(token) {
    return this.request('/api/2fa/enable', {
      method: 'POST',
      body: { token }
    });
  }

  async disable2FA(password) {
    return this.request('/api/2fa/disable', {
      method: 'POST',
      body: { password }
    });
  }

  async get2FAStatus() {
    return this.request('/api/2fa/status');
  }

  // Channels
  async createChannel(name, customId) {
    return this.request('/api/channels/create', {
      method: 'POST',
      body: { name, customId }
    });
  }

  async getChannels() {
    return this.request('/api/channels');
  }

  async searchChannels(query) {
    return this.request('/api/channels/search', {
      method: 'POST',
      body: { query }
    });
  }

  async joinChannel(channel) {
    return this.request('/api/channels/join', {
      method: 'POST',
      body: { channel }
    });
  }

  async leaveChannel(channel) {
    return this.request('/api/channels/leave', {
      method: 'POST',
      body: { channel }
    });
  }

  async getChannelMembers(channel) {
    return this.request('/api/channels/members', {
      params: { channel }
    });
  }

  async updateChannel(name, newName) {
    return this.request('/api/channels', {
      method: 'PATCH',
      body: { name, newName }
    });
  }

  // Messages
  async sendMessage(channel, text, options = {}) {
    return this.request('/api/message', {
      method: 'POST',
      body: { channel, text, ...options }
    });
  }

  async sendVoiceMessage(channel, voiceMessage) {
    return this.request('/api/message/voice-only', {
      method: 'POST',
      body: { channel, voiceMessage }
    });
  }

  async getMessages(channel, limit = 50, before) {
    const params = { channel, limit };
    if (before) params.before = before;
    
    return this.request('/api/messages', { params });
  }

  async getMessage(messageId) {
    return this.request(`/api/message/${messageId}`);
  }

  // Users
  async getUsers() {
    return this.request('/api/users');
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    
    return this.request('/api/upload/avatar', {
      method: 'POST',
      body: formData
    });
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/api/upload/file', {
      method: 'POST',
      body: formData
    });
  }

  // WebRTC
  async sendWebRTCOffer(toUser, offer, channel) {
    return this.request('/api/webrtc/offer', {
      method: 'POST',
      body: { toUser, offer, channel }
    });
  }

  async sendWebRTCAnswer(toUser, answer) {
    return this.request('/api/webrtc/answer', {
      method: 'POST',
      body: { toUser, answer }
    });
  }

  async sendICECandidate(toUser, candidate) {
    return this.request('/api/webrtc/ice-candidate', {
      method: 'POST',
      body: { toUser, candidate }
    });
  }

  async getWebRTCOffer(fromUser) {
    return this.request('/api/webrtc/offer', {
      params: { fromUser }
    });
  }

  async getWebRTCAnswer(fromUser) {
    return this.request('/api/webrtc/answer', {
      params: { fromUser }
    });
  }

  async getICECandidates(fromUser) {
    return this.request('/api/webrtc/ice-candidates', {
      params: { fromUser }
    });
  }

  async endCall(targetUser) {
    return this.request('/api/webrtc/end-call', {
      method: 'POST',
      body: { targetUser }
    });
  }

  // Voice messages
  async uploadVoiceMessage(channel, duration) {
    return this.request('/api/voice/upload', {
      method: 'POST',
      body: { channel, duration }
    });
  }

  async uploadVoiceFile(voiceId, audioBlob) {
    return this.request(`/api/upload/voice/${voiceId}`, {
      method: 'POST',
      body: audioBlob,
      headers: { 'Content-Type': 'audio/ogg' }
    });
  }

  // Email
  async sendVerificationEmail(email) {
    return this.request('/api/email/send-verification', {
      method: 'POST',
      body: { email }
    });
  }

  async verifyEmail(email, code) {
    return this.request('/api/email/verify', {
      method: 'POST',
      body: { email, code }
    });
  }

  // Password reset
  async requestPasswordReset(email) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: { email }
    });
  }

  async resetPassword(token, newPassword) {
    return this.request('/api/auth/reset-password/confirm', {
      method: 'POST',
      body: { token, newPassword }
    });
  }

  // Bots
  async createBot(username, webhookUrl) {
    return this.request('/api/bots/create', {
      method: 'POST',
      body: { username, webhookUrl }
    });
  }

  async getBot(username) {
    return this.request(`/api/bots/${username}`);
  }

  async deleteBot(username) {
    return this.request(`/api/bots/${username}`, {
      method: 'DELETE'
    });
  }

  // Admin
  async banUser(username, durationMs, reason) {
    return this.request('/api/admin/ban', {
      method: 'POST',
      body: { username, durationMs, reason }
    });
  }

  async unbanUser(username) {
    return this.request('/api/admin/unban', {
      method: 'POST',
      body: { username }
    });
  }

  async warnUser(username, reason) {
    return this.request('/api/admin/warn', {
      method: 'POST',
      body: { username, reason }
    });
  }

  // Utility
  async checkUpdates() {
    return this.request('/api/updates/check');
  }

  async ping() {
    return this.request('/api/ping');
  }

  // Connection management
  connectWebSocket() {
    if (!this.token) throw new Error('No authentication token available');

    if (this.ws) this.ws.close();

    const wsUrl = `${this.config.serverUrl.replace('http', 'ws')}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        this.emit('error', error);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected');
      
      if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connectWebSocket();
        }, this.config.reconnectInterval);
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', new Error(`WebSocket error: ${error}`));
    };
  }

  connectSSE() {
    if (!this.token) throw new Error('No authentication token available');

    if (this.eventSource) this.eventSource.close();

    const sseUrl = `${this.config.serverUrl}/api/events?token=${this.token}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = () => {
      this.emit('connected');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSSEMessage(data);
      } catch (error) {
        this.emit('error', error);
      }
    };

    this.eventSource.onerror = (error) => {
      this.emit('error', new Error(`SSE error: ${error}`));
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isConnected = false;
  }

  isConnectedToServer() {
    return this.isConnected;
  }

  // Private methods
  async request(endpoint, options = {}) {
    const url = new URL(`${this.config.serverUrl}${endpoint}`);
    
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    const headers = { ...options.headers };
    let body = options.body;

    if (body instanceof FormData) {
      // Let browser set Content-Type with boundary
    } else if (body && typeof body === 'object' && !(body instanceof Blob)) {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers,
      body
    });

    const responseData = await response.json();
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Request failed');
    }

    return responseData;
  }

  handleWebSocketMessage(data) {
    if (data.type && data.action) {
      this.emit(data.type, data);
    } else {
      this.emit('message', data);
    }
  }

  handleSSEMessage(data) {
    if (data.type) {
      this.emit(data.type, data);
    }
  }
}

export default ChatClient;
