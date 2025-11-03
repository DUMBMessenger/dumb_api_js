export class User {
    constructor(data = {}) {
        this.username = data.username || '';
        this.avatar = data.avatar || null;
        this.email = data.email || null;
        this.isOnline = data.isOnline || false;
        this.lastSeen = data.lastSeen || null;
        this.isBot = data.isBot || false;
        this.createdAt = data.createdAt || null;
    }

    static fromJSON(json) {
        return new User(json);
    }

    toJSON() {
        return {
            username: this.username,
            avatar: this.avatar,
            email: this.email,
            isOnline: this.isOnline,
            lastSeen: this.lastSeen,
            isBot: this.isBot,
            createdAt: this.createdAt
        };
    }
}

export class Channel {
    constructor(data = {}) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.description = data.description || '';
        this.owner = data.owner || '';
        this.createdAt = data.createdAt || null;
        this.memberCount = data.memberCount || 0;
        this.isPrivate = data.isPrivate || false;
        this.customId = data.customId || null;
        this.lastMessage = data.lastMessage ? new Message(data.lastMessage) : null;
    }

    static fromJSON(json) {
        return new Channel(json);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            owner: this.owner,
            createdAt: this.createdAt,
            memberCount: this.memberCount,
            isPrivate: this.isPrivate,
            customId: this.customId,
            lastMessage: this.lastMessage ? this.lastMessage.toJSON() : null
        };
    }
}

export class Message {
    constructor(data = {}) {
        this.id = data.id || '';
        this.from = data.from || '';
        this.channel = data.channel || '';
        this.text = data.text || '';
        this.ts = data.ts || Date.now();
        this.replyTo = data.replyTo || null;
        this.replyToMessage = data.replyToMessage ? new Message(data.replyToMessage) : null;
        this.file = data.file ? new FileAttachment(data.file) : null;
        this.voice = data.voice ? new VoiceAttachment(data.voice) : null;
        this.encrypted = data.encrypted || false;
        this.edited = data.edited || false;
        this.deleted = data.deleted || false;
        this.reactions = data.reactions || {};
        this.bot = data.bot || false;
    }

    static fromJSON(json) {
        return new Message(json);
    }

    toJSON() {
        return {
            id: this.id,
            from: this.from,
            channel: this.channel,
            text: this.text,
            ts: this.ts,
            replyTo: this.replyTo,
            replyToMessage: this.replyToMessage ? this.replyToMessage.toJSON() : null,
            file: this.file ? this.file.toJSON() : null,
            voice: this.voice ? this.voice.toJSON() : null,
            encrypted: this.encrypted,
            edited: this.edited,
            deleted: this.deleted,
            reactions: this.reactions,
            bot: this.bot
        };
    }

    isFromUser(username) {
        return this.from === username;
    }

    hasAttachment() {
        return !!(this.file || this.voice);
    }

    isReply() {
        return !!this.replyTo;
    }
}

export class FileAttachment {
    constructor(data = {}) {
        this.filename = data.filename || '';
        this.originalName = data.originalName || '';
        this.mimetype = data.mimetype || '';
        this.size = data.size || 0;
        this.downloadUrl = data.downloadUrl || '';
        this.uploadedAt = data.uploadedAt || null;
        this.uploadedBy = data.uploadedBy || '';
    }

    static fromJSON(json) {
        return new FileAttachment(json);
    }

    toJSON() {
        return {
            filename: this.filename,
            originalName: this.originalName,
            mimetype: this.mimetype,
            size: this.size,
            downloadUrl: this.downloadUrl,
            uploadedAt: this.uploadedAt,
            uploadedBy: this.uploadedBy
        };
    }

    isImage() {
        return this.mimetype.startsWith('image/');
    }

    isAudio() {
        return this.mimetype.startsWith('audio/');
    }

    isVideo() {
        return this.mimetype.startsWith('video/');
    }

    isDocument() {
        return !this.isImage() && !this.isAudio() && !this.isVideo();
    }
}

export class VoiceAttachment {
    constructor(data = {}) {
        this.filename = data.filename || '';
        this.duration = data.duration || 0;
        this.downloadUrl = data.downloadUrl || '';
        this.recordedAt = data.recordedAt || null;
    }

    static fromJSON(json) {
        return new VoiceAttachment(json);
    }

    toJSON() {
        return {
            filename: this.filename,
            duration: this.duration,
            downloadUrl: this.downloadUrl,
            recordedAt: this.recordedAt
        };
    }
}

export class Bot {
    constructor(data = {}) {
        this.username = data.username || '';
        this.owner = data.owner || '';
        this.webhookUrl = data.webhookUrl || null;
        this.token = data.token || '';
        this.createdAt = data.createdAt || null;
        this.active = data.active || true;
        this.permissions = data.permissions || ['read_messages', 'send_messages'];
        this.lastActivity = data.lastActivity || null;
    }

    static fromJSON(json) {
        return new Bot(json);
    }

    toJSON() {
        return {
            username: this.username,
            owner: this.owner,
            webhookUrl: this.webhookUrl,
            token: this.token,
            createdAt: this.createdAt,
            active: this.active,
            permissions: this.permissions,
            lastActivity: this.lastActivity
        };
    }

    hasPermission(permission) {
        return this.permissions.includes(permission);
    }
}

export class WebRTCOffer {
    constructor(data = {}) {
        this.from = data.from || '';
        this.to = data.to || '';
        this.offer = data.offer || null;
        this.channel = data.channel || null;
        this.createdAt = data.createdAt || Date.now();
        this.expiresAt = data.expiresAt || Date.now() + 30000; // 30 seconds
    }

    static fromJSON(json) {
        return new WebRTCOffer(json);
    }

    toJSON() {
        return {
            from: this.from,
            to: this.to,
            offer: this.offer,
            channel: this.channel,
            createdAt: this.createdAt,
            expiresAt: this.expiresAt
        };
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }
}

export class WebRTCAnswer {
    constructor(data = {}) {
        this.from = data.from || '';
        this.to = data.to || '';
        this.answer = data.answer || null;
        this.createdAt = data.createdAt || Date.now();
    }

    static fromJSON(json) {
        return new WebRTCAnswer(json);
    }

    toJSON() {
        return {
            from: this.from,
            to: this.to,
            answer: this.answer,
            createdAt: this.createdAt
        };
    }
}

export class ICECandidate {
    constructor(data = {}) {
        this.from = data.from || '';
        this.to = data.to || '';
        this.candidate = data.candidate || null;
        this.createdAt = data.createdAt || Date.now();
    }

    static fromJSON(json) {
        return new ICECandidate(json);
    }

    toJSON() {
        return {
            from: this.from,
            to: this.to,
            candidate: this.candidate,
            createdAt: this.createdAt
        };
    }
}

export class TwoFASession {
    constructor(data = {}) {
        this.sessionId = data.sessionId || '';
        this.username = data.username || '';
        this.twoFactorVerified = data.twoFactorVerified || false;
        this.createdAt = data.createdAt || Date.now();
        this.expiresAt = data.expiresAt || Date.now() + 300000; // 5 minutes
    }

    static fromJSON(json) {
        return new TwoFASession(json);
    }

    toJSON() {
        return {
            sessionId: this.sessionId,
            username: this.username,
            twoFactorVerified: this.twoFactorVerified,
            createdAt: this.createdAt,
            expiresAt: this.expiresAt
        };
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }
}

export class BanInfo {
    constructor(data = {}) {
        this.username = data.username || '';
        this.reason = data.reason || '';
        this.moderator = data.moderator || '';
        this.bannedAt = data.bannedAt || Date.now();
        this.expires = data.expires || null;
        this.active = data.active || true;
    }

    static fromJSON(json) {
        return new BanInfo(json);
    }

    toJSON() {
        return {
            username: this.username,
            reason: this.reason,
            moderator: this.moderator,
            bannedAt: this.bannedAt,
            expires: this.expires,
            active: this.active
        };
    }

    isExpired() {
        return this.expires && Date.now() > this.expires;
    }

    isActive() {
        return this.active && !this.isExpired();
    }
}

export class Warning {
    constructor(data = {}) {
        this.username = data.username || '';
        this.reason = data.reason || '';
        this.moderator = data.moderator || '';
        this.timestamp = data.timestamp || Date.now();
        this.acknowledged = data.acknowledged || false;
    }

    static fromJSON(json) {
        return new Warning(json);
    }

    toJSON() {
        return {
            username: this.username,
            reason: this.reason,
            moderator: this.moderator,
            timestamp: this.timestamp,
            acknowledged: this.acknowledged
        };
    }
}

export class APIResponse {
    constructor(data = {}) {
        this.success = data.success || false;
        this.error = data.error || null;
        this.message = data.message || null;
        this.data = data.data || null;
        this.timestamp = data.timestamp || Date.now();
    }

    static fromJSON(json) {
        return new APIResponse(json);
    }

    toJSON() {
        return {
            success: this.success,
            error: this.error,
            message: this.message,
            data: this.data,
            timestamp: this.timestamp
        };
    }

    static success(data = null, message = null) {
        return new APIResponse({
            success: true,
            data: data,
            message: message
        });
    }

    static error(error, message = null) {
        return new APIResponse({
            success: false,
            error: error,
            message: message
        });
    }
}

export const EventTypes = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting',
    ERROR: 'error',
    
    MESSAGE: 'message',
    MESSAGE_SENT: 'messageSent',
    MESSAGE_RECEIVED: 'messageReceived',
    MESSAGE_UPDATED: 'messageUpdated',
    MESSAGE_DELETED: 'messageDeleted',
    
    CHANNEL_CREATED: 'channelCreated',
    CHANNEL_UPDATED: 'channelUpdated',
    CHANNEL_DELETED: 'channelDeleted',
    CHANNEL_JOINED: 'channelJoined',
    CHANNEL_LEFT: 'channelLeft',
    
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft',
    USER_UPDATED: 'userUpdated',
    USER_ONLINE: 'userOnline',
    USER_OFFLINE: 'userOffline',
    
    WEBRTC_OFFER: 'webrtc-offer',
    WEBRTC_ANSWER: 'webrtc-answer',
    WEBRTC_ICE_CANDIDATE: 'webrtc-ice-candidate',
    WEBRTC_END_CALL: 'webrtc-end-call',
    
    LOGIN: 'login',
    LOGOUT: 'logout',
    REGISTERED: 'registered',
    TWO_FA_REQUIRED: '2faRequired',
    
    TYPING_START: 'typingStart',
    TYPING_STOP: 'typingStop',
    MESSAGE_QUEUED: 'messageQueued',
    PROCESSING_QUEUE: 'processingQueue'
};

export const Utils = {
    generateId(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    formatTimestamp(timestamp, format = 'relative') {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (format === 'relative') {
            if (diff < 60000) return 'just now';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return date.toLocaleDateString();
        }

        return date.toLocaleString();
    },

    validateUsername(username) {
        if (!username || username.length < 2 || username.length > 20) return false;
        return /^[a-zA-Z0-9_-]+$/.test(username);
    },

    validateChannelName(name) {
        if (!name || name.length < 2 || name.length > 50) return false;
        return /^[a-zA-Z0-9_-\s]+$/.test(name);
    },

    isBase64(str) {
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
};

export default {
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
