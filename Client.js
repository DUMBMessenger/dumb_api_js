
import { EventEmitter } from 'events';
import {
    User,
    Channel,
    Message,
    FileAttachment,
    VoiceAttachment,
    Bot,
    WebRTCOffer,
    WebRTCAnswer,
    ICECandidate,
    TwoFASession,
    BanInfo,
    Warning,
    APIResponse,
    EventTypes,
    Utils
} from './Models.js';

let fetch, WebSocket, FormData;

if (typeof window !== 'undefined') {
    fetch = window.fetch.bind(window);
    WebSocket = window.WebSocket;
    FormData = window.FormData;
} else {
    fetch = (await import('node-fetch')).default;
    WebSocket = (await import('ws')).default;
    FormData = (await import('form-data')).default;
}

export class ChatAPI extends EventEmitter {
    constructor(baseURL = 'http://localhost:3000', options = {}) {
        super();
        this.baseURL = baseURL.replace(/\/$/, '');
        this.token = options.token || null;
        this.user = options.user || null;
        this.ws = null;
        this.sse = null;
        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 1000;
        this.messageQueue = [];
        this.isConnected = false;
        this.pendingRequests = new Map();
        this.requestTimeout = options.requestTimeout || 30000;

        this._handleWebSocketMessage = this._handleWebSocketMessage.bind(this);
        this._handleWebSocketClose = this._handleWebSocketClose.bind(this);
        this._handleWebSocketError = this._handleWebSocketError.bind(this);
        this._handleSSEMessage = this._handleSSEMessage.bind(this);
        this._handleSSEError = this._handleSSEError.bind(this);
    }

    async register(username, password) {
        const response = await this._request('/api/register', 'POST', {
            username,
            password
        });
        
        if (response.success) {
            this.emit(EventTypes.REGISTERED, { username });
        }
        
        return APIResponse.fromJSON(response);
    }

    async login(username, password, twoFactorToken = null) {
        const response = await this._request('/api/login', 'POST', {
            username,
            password,
            twoFactorToken
        });

        if (response.success) {
            this.token = response.token;
            this.user = username;
            this.emit(EventTypes.LOGIN, { 
                username, 
                twoFactorEnabled: response.twoFactorEnabled 
            });
            
            if (this.autoReconnect) {
                this.connectRealTime();
            }
        } else if (response.requires2FA) {
            this.emit(EventTypes.TWO_FA_REQUIRED, { 
                username, 
                sessionId: response.sessionId 
            });
        }

        return APIResponse.fromJSON(response);
    }

    async verify2FALogin(username, sessionId, twoFactorToken) {
        const response = await this._request('/api/2fa/verify-login', 'POST', {
            username,
            sessionId,
            twoFactorToken
        });

        if (response.success) {
            this.token = response.token;
            this.user = username;
            this.emit(EventTypes.LOGIN, { username, twoFactorEnabled: true });
            this.connectRealTime();
        }

        return APIResponse.fromJSON(response);
    }

    logout() {
        this.token = null;
        this.user = null;
        this.disconnect();
        this.emit(EventTypes.LOGOUT);
    }

    async setup2FA() {
        const response = await this._request('/api/2fa/setup', 'POST');
        return APIResponse.fromJSON(response);
    }

    async enable2FA(token) {
        const response = await this._request('/api/2fa/enable', 'POST', { token });
        return APIResponse.fromJSON(response);
    }

    async disable2FA(password) {
        const response = await this._request('/api/2fa/disable', 'POST', { password });
        return APIResponse.fromJSON(response);
    }

    async get2FAStatus() {
        const response = await this._request('/api/2fa/status', 'GET');
        return APIResponse.fromJSON(response);
    }

    async createChannel(name, customId = null) {
        const response = await this._request('/api/channels/create', 'POST', {
            name,
            customId
        });
        return APIResponse.fromJSON(response);
    }

    async getChannels() {
        const response = await this._request('/api/channels', 'GET');
        if (response.success && Array.isArray(response.channels)) {
            response.channels = response.channels.map(channel => Channel.fromJSON(channel));
        }
        return APIResponse.fromJSON(response);
    }

    async searchChannels(query) {
        const response = await this._request('/api/channels/search', 'POST', { query });
        if (response.success && Array.isArray(response.channels)) {
            response.channels = response.channels.map(channel => Channel.fromJSON(channel));
        }
        return APIResponse.fromJSON(response);
    }

    async joinChannel(channel) {
        const response = await this._request('/api/channels/join', 'POST', { channel });
        if (response.success) {
            this.emit(EventTypes.CHANNEL_JOINED, { channel });
        }
        return APIResponse.fromJSON(response);
    }

    async joinChannelById(channelId) {
        const response = await this._request('/api/channels/join-by-id', 'POST', { channel: channelId });
        if (response.success) {
            this.emit(EventTypes.CHANNEL_JOINED, { channel: channelId });
        }
        return APIResponse.fromJSON(response);
    }

    async leaveChannel(channel) {
        const response = await this._request('/api/channels/leave', 'POST', { channel });
        if (response.success) {
            this.emit(EventTypes.CHANNEL_LEFT, { channel });
        }
        return APIResponse.fromJSON(response);
    }

    async getChannelMembers(channel) {
        const response = await this._request('/api/channels/members', 'GET', { channel });
        if (response.success && Array.isArray(response.members)) {
            response.members = response.members.map(user => User.fromJSON(user));
        }
        return APIResponse.fromJSON(response);
    }

    async updateChannel(name, newName) {
        const response = await this._request('/api/channels', 'PATCH', { name, newName });
        if (response.success) {
            this.emit(EventTypes.CHANNEL_UPDATED, { oldName: name, newName });
        }
        return APIResponse.fromJSON(response);
    }

    async getMessages(channel, limit = 50, before = null) {
        const params = { channel, limit };
        if (before) params.before = before;
        
        const response = await this._request('/api/messages', 'GET', params);
        if (response.success && Array.isArray(response.messages)) {
            response.messages = response.messages.map(msg => Message.fromJSON(msg));
        }
        return APIResponse.fromJSON(response);
    }

    async getMessage(messageId) {
        const response = await this._request(`/api/message/${messageId}`, 'GET');
        if (response.success && response.message) {
            response.message = Message.fromJSON(response.message);
        }
        return APIResponse.fromJSON(response);
    }

    async sendMessage(channel, text, options = {}) {
        const message = {
            channel,
            text,
            ...options
        };

        if (!this.isConnected && this.autoReconnect) {
            this.messageQueue.push(message);
            this.emit(EventTypes.MESSAGE_QUEUED, message);
            return APIResponse.success({ queued: true }, 'Message queued for sending');
        }

        const response = await this._request('/api/message', 'POST', message);
        if (response.success && response.message) {
            response.message = Message.fromJSON(response.message);
            this.emit(EventTypes.MESSAGE_SENT, response.message);
        }
        return APIResponse.fromJSON(response);
    }

    async sendVoiceOnly(channel, voiceMessage) {
        const response = await this._request('/api/message/voice-only', 'POST', {
            channel,
            voiceMessage
        });
        if (response.success && response.message) {
            response.message = Message.fromJSON(response.message);
            this.emit(EventTypes.MESSAGE_SENT, response.message);
        }
        return APIResponse.fromJSON(response);
    }

    async getUsers() {
        const response = await this._request('/api/users', 'GET');
        if (response.success && Array.isArray(response.users)) {
            response.users = response.users.map(user => User.fromJSON(user));
        }
        return APIResponse.fromJSON(response);
    }

    async uploadAvatar(file) {
        const response = await this._uploadFile('/api/upload/avatar', file, 'avatar');
        return APIResponse.fromJSON(response);
    }

    async uploadFile(file) {
        const response = await this._uploadFile('/api/upload/file', file, 'file');
        if (response.success && response.file) {
            response.file = FileAttachment.fromJSON(response.file);
        }
        return APIResponse.fromJSON(response);
    }

    async uploadVoiceMessage(channel, file, duration = 0) {
        const response = await this._request('/api/voice/upload', 'POST', {
            channel,
            duration
        });

        if (!response.success) return APIResponse.fromJSON(response);

        const formData = new FormData();
        formData.append('voice', file);

        try {
            const uploadResponse = await fetch(`${this.baseURL}/api/upload/voice/${response.voiceId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const result = await uploadResponse.json();
            return APIResponse.fromJSON(result);
        } catch (error) {
            return APIResponse.error('UPLOAD_FAILED', error.message);
        }
    }

    async sendWebRTCOffer(toUser, offer, channel = null) {
        const response = await this._request('/api/webrtc/offer', 'POST', {
            toUser,
            offer,
            channel
        });
        return APIResponse.fromJSON(response);
    }

    async sendWebRTCAnswer(toUser, answer) {
        const response = await this._request('/api/webrtc/answer', 'POST', {
            toUser,
            answer
        });
        return APIResponse.fromJSON(response);
    }

    async sendICECandidate(toUser, candidate) {
        const response = await this._request('/api/webrtc/ice-candidate', 'POST', {
            toUser,
            candidate
        });
        return APIResponse.fromJSON(response);
    }

    async getWebRTCOffer(fromUser) {
        const response = await this._request('/api/webrtc/offer', 'GET', { fromUser });
        if (response.success && response.offer) {
            response.offer = WebRTCOffer.fromJSON(response.offer);
        }
        return APIResponse.fromJSON(response);
    }

    async getWebRTCAnswer(fromUser) {
        const response = await this._request('/api/webrtc/answer', 'GET', { fromUser });
        if (response.success && response.answer) {
            response.answer = WebRTCAnswer.fromJSON(response.answer);
        }
        return APIResponse.fromJSON(response);
    }

    async getICECandidates(fromUser) {
        const response = await this._request('/api/webrtc/ice-candidates', 'GET', { fromUser });
        if (response.success && Array.isArray(response.candidates)) {
            response.candidates = response.candidates.map(candidate => ICECandidate.fromJSON(candidate));
        }
        return APIResponse.fromJSON(response);
    }

    async endWebRTCCall(targetUser) {
        const response = await this._request('/api/webrtc/end-call', 'POST', { targetUser });
        return APIResponse.fromJSON(response);
    }

    async sendVerificationEmail(email) {
        const response = await this._request('/api/email/send-verification', 'POST', { email });
        return APIResponse.fromJSON(response);
    }

    async verifyEmail(email, code) {
        const response = await this._request('/api/email/verify', 'POST', { email, code });
        return APIResponse.fromJSON(response);
    }

    async requestPasswordReset(email) {
        const response = await this._request('/api/auth/reset-password', 'POST', { email });
        return APIResponse.fromJSON(response);
    }

    async resetPassword(token, newPassword) {
        const response = await this._request('/api/auth/reset-password/confirm', 'POST', {
            token,
            newPassword
        });
        return APIResponse.fromJSON(response);
    }

    async banUser(username, durationMs, reason) {
        const response = await this._request('/api/admin/ban', 'POST', {
            username,
            durationMs,
            reason
        });
        if (response.success && response.result) {
            response.result = BanInfo.fromJSON(response.result);
        }
        return APIResponse.fromJSON(response);
    }

    async unbanUser(username) {
        const response = await this._request('/api/admin/unban', 'POST', { username });
        return APIResponse.fromJSON(response);
    }

    async warnUser(username, reason) {
        const response = await this._request('/api/admin/warn', 'POST', { username, reason });
        if (response.success && response.result) {
            response.result = Warning.fromJSON(response.result);
        }
        return APIResponse.fromJSON(response);
    }

    async createBot(username, webhookUrl = null) {
        const response = await this._request('/api/bots/create', 'POST', {
            username,
            webhookUrl
        });
        if (response.success && response.bot) {
            response.bot = Bot.fromJSON(response.bot);
        }
        return APIResponse.fromJSON(response);
    }

    async getBot(username) {
        const response = await this._request(`/api/bots/${username}`, 'GET');
        if (response.success && response.bot) {
            response.bot = Bot.fromJSON(response.bot);
        }
        return APIResponse.fromJSON(response);
    }

    async deleteBot(username) {
        const response = await this._request(`/api/bots/${username}`, 'DELETE');
        return APIResponse.fromJSON(response);
    }

    async checkUpdates() {
        const response = await this._request('/api/updates/check', 'GET');
        return APIResponse.fromJSON(response);
    }

    async getRedisStats() {
        const response = await this._request('/api/admin/redis-stats', 'GET');
        return APIResponse.fromJSON(response);
    }

    async ping() {
        const response = await this._request('/api/ping', 'GET');
        return APIResponse.fromJSON(response);
    }

    connectRealTime() {
        this.connectWebSocket();
        this.connectSSE();
    }

    connectWebSocket() {
        if (!this.token) {
            console.warn('Cannot connect WebSocket: No authentication token');
            return;
        }

        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            const wsUrl = this.baseURL.replace(/^http/, 'ws') + `?token=${this.token}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit(EventTypes.CONNECTED);
                this._processMessageQueue();
            };

            this.ws.onmessage = this._handleWebSocketMessage;
            this.ws.onclose = this._handleWebSocketClose;
            this.ws.onerror = this._handleWebSocketError;

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.emit(EventTypes.ERROR, error);
        }
    }

    connectSSE() {
        if (!this.token) {
            console.warn('Cannot connect SSE: No authentication token');
            return;
        }

        if (this.sse) {
            this.sse.close();
        }

        try {
            this.sse = new EventSource(`${this.baseURL}/api/events?token=${this.token}`);

            this.sse.onopen = () => {
                this.emit('sseConnected');
            };

            this.sse.onmessage = this._handleSSEMessage;
            this.sse.onerror = this._handleSSEError;

        } catch (error) {
            console.error('SSE connection error:', error);
            this.emit(EventTypes.ERROR, error);
        }
    }

    disconnect() {
        this.isConnected = false;
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.sse) {
            this.sse.close();
            this.sse = null;
        }
        
        this.messageQueue = [];
        this.emit(EventTypes.DISCONNECTED);
    }

    setToken(token) {
        this.token = token;
    }

    setUser(user) {
        this.user = user;
    }

    setAutoReconnect(enabled) {
        this.autoReconnect = enabled;
    }

    getDownloadURL(filename) {
        return `${this.baseURL}/api/download/${filename}`;
    }

    getUserAvatarURL(username) {
        return `${this.baseURL}/api/user/${username}/avatar`;
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    async _request(endpoint, method = 'GET', data = null) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        const options = {
            method,
            headers: {}
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (method === 'GET' && data) {
            Object.keys(data).forEach(key => 
                url.searchParams.append(key, data[key])
            );
        } else if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
            options.signal = controller.signal;

            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            const result = await response.json();
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Request timeout',
                    details: 'The request took too long to complete'
                };
            }
            return {
                success: false,
                error: 'Network error',
                details: error.message
            };
        }
    }

    async _uploadFile(endpoint, file, fieldName) {
        if (!this.token) {
            return { success: false, error: 'Not authenticated' };
        }

        const formData = new FormData();
        formData.append(fieldName, file);

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            return await response.json();
        } catch (error) {
            return {
                success: false,
                error: 'Upload failed',
                details: error.message
            };
        }
    }

    _handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            let processedData = data;
            if (data.type === 'message') {
                processedData = { ...data, message: Message.fromJSON(data) };
            } else if (data.type === EventTypes.WEBRTC_OFFER) {
                processedData = { ...data, offer: WebRTCOffer.fromJSON(data) };
            } else if (data.type === EventTypes.WEBRTC_ANSWER) {
                processedData = { ...data, answer: WebRTCAnswer.fromJSON(data) };
            } else if (data.type === EventTypes.WEBRTC_ICE_CANDIDATE) {
                processedData = { ...data, candidate: ICECandidate.fromJSON(data) };
            }

            this.emit(EventTypes.MESSAGE, processedData);
            
            if (data.type) {
                this.emit(data.type, processedData);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.emit(EventTypes.ERROR, error);
        }
    }

    _handleWebSocketClose(event) {
        this.isConnected = false;
        this.emit(EventTypes.DISCONNECTED, { code: event.code, reason: event.reason });
        
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
            this.emit(EventTypes.RECONNECTING, { attempt: this.reconnectAttempts + 1, delay });
            
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connectWebSocket();
            }, delay);
        }
    }

    _handleWebSocketError(error) {
        this.emit(EventTypes.ERROR, error);
    }

    _handleSSEMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.emit('sseMessage', data);
            
            if (data.type) {
                this.emit(data.type, data);
            }
        } catch (error) {
            console.error('Error parsing SSE message:', error);
            this.emit(EventTypes.ERROR, error);
        }
    }

    _handleSSEError(error) {
        this.emit('sseError', error);
    }

    async _processMessageQueue() {
        if (this.messageQueue.length === 0) return;

        this.emit(EventTypes.PROCESSING_QUEUE, { count: this.messageQueue.length });

        const successful = [];
        const failed = [];

        for (const message of this.messageQueue) {
            try {
                const response = await this.sendMessage(message.channel, message.text, message);
                if (response.success) {
                    successful.push(message);
                } else {
                    failed.push({ message, error: response.error });
                }
            } catch (error) {
                failed.push({ message, error: error.message });
            }
        }

        this.messageQueue = failed.map(f => f.message);
        
        if (successful.length > 0) {
            this.emit('queueProcessed', { successful, failed: failed.length });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChatAPI, ...Models };
} else if (typeof window !== 'undefined') {
    window.ChatAPI = ChatAPI;
    window.ChatModels = {
        User,
        Channel,
        Message,
        FileAttachment,
        VoiceAttachment,
        Bot,
        WebRTCOffer,
        WebRTCAnswer,
        ICECandidate,
        TwoFASession,
        BanInfo,
        Warning,
        APIResponse,
        EventTypes,
        Utils
    };
}

export default ChatAPI;
