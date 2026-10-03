/**
 * LiveSync Engine for DJ Pub & Grill Bingo
 * 
 * Provides zero-cost, serverless, real-time multi-device communication
 * using public MQTT over secure WebSockets (EMQX & HiveMQ) with automatic
 * failover, plus BroadcastChannel fallback for zero-latency local HDMI screens.
 * 
 * No backend server, no VM dependency, 100% static GitHub Pages compatible.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['Paho'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(root.Paho || (typeof require !== 'undefined' ? require('./paho-mqtt.min.js') : null));
    } else {
        root.LiveSync = factory(root.Paho);
    }
}(typeof self !== 'undefined' ? self : this, function(Paho) {
    'use strict';

    // Public MQTT WebSocket Broker Pool (Free, Global, Zero-Cost)
    const BROKERS = [
        { host: 'broker.emqx.io', port: 8084, path: '/mqtt', ssl: true, name: 'EMQX Global' },
        { host: 'broker.hivemq.com', port: 8884, path: '/mqtt', ssl: true, name: 'HiveMQ Public' },
        { host: 'test.mosquitto.org', port: 8081, path: '/mqtt', ssl: true, name: 'Mosquitto Community' }
    ];

    class LiveSyncEngine {
        constructor() {
            this.role = 'player'; // 'dj', 'tv', 'player'
            this.roomCode = 'PUB1';
            this.clientId = 'bingo_' + Math.random().toString(16).substring(2, 8);
            this.client = null;
            this.currentBrokerIdx = 0;
            this.isConnected = false;
            this.isConnecting = false;
            this.broadcastChannel = null;
            this.reconnectTimer = null;
            this.presenceTimer = null;
            this.activePlayers = new Map(); // id -> { name, lastSeen }

            // Event callbacks
            this.callbacks = {
                onCall: () => {},
                onReveal: () => {},
                onRoundChange: () => {},
                onWinner: () => {},
                onClaim: () => {},
                onReset: () => {},
                onStateSync: () => {},
                onStateRequest: () => {},
                onPresenceUpdate: () => {},
                onStatusChange: () => {}
            };

            this.initLocalBroadcast();
        }

        initLocalBroadcast() {
            if (typeof BroadcastChannel !== 'undefined') {
                try {
                    this.broadcastChannel = new BroadcastChannel('bingo_channel');
                    this.broadcastChannel.onmessage = (event) => {
                        this.handleInboundPayload(event.data, 'local');
                    };
                } catch (e) {
                    console.warn('[LiveSync] BroadcastChannel not available:', e);
                }
            }
        }

        init(options = {}) {
            this.role = options.role || this.role;
            this.roomCode = (options.roomCode || this.roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
            if (!this.roomCode) this.roomCode = 'PUB1';

            if (options.onCall) this.callbacks.onCall = options.onCall;
            if (options.onReveal) this.callbacks.onReveal = options.onReveal;
            if (options.onRoundChange) this.callbacks.onRoundChange = options.onRoundChange;
            if (options.onWinner) this.callbacks.onWinner = options.onWinner;
            if (options.onClaim) this.callbacks.onClaim = options.onClaim;
            if (options.onReset) this.callbacks.onReset = options.onReset;
            if (options.onStateSync) this.callbacks.onStateSync = options.onStateSync;
            if (options.onStateRequest) this.callbacks.onStateRequest = options.onStateRequest;
            if (options.onPresenceUpdate) this.callbacks.onPresenceUpdate = options.onPresenceUpdate;
            if (options.onStatusChange) this.callbacks.onStatusChange = options.onStatusChange;

            this.connect();
        }

        setRoomCode(newCode) {
            const cleanCode = (newCode || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
            if (!cleanCode || cleanCode === this.roomCode) return;
            this.roomCode = cleanCode;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('bingo_room_code', this.roomCode);
            }
            if (this.isConnected && this.client) {
                try { this.client.disconnect(); } catch (e) {}
            }
            this.connect();
        }

        getTopicBase() {
            return `jaxpubbingo/v1/${this.roomCode}`;
        }

        connect() {
            if (this.isConnecting) return;
            this.isConnecting = true;

            const broker = BROKERS[this.currentBrokerIdx];
            this.callbacks.onStatusChange({
                status: 'connecting',
                broker: broker.name,
                room: this.roomCode,
                role: this.role
            });

            if (!Paho || !Paho.Client) {
                console.warn('[LiveSync] Paho MQTT client not found. Falling back to local broadcast only.');
                this.isConnecting = false;
                this.callbacks.onStatusChange({
                    status: 'local_only',
                    broker: 'Local Browser BroadcastChannel',
                    room: this.roomCode,
                    role: this.role
                });
                return;
            }

            try {
                this.client = new Paho.Client(broker.host, broker.port, broker.path, this.clientId);

                this.client.onConnectionLost = (responseObject) => {
                    this.isConnected = false;
                    this.isConnecting = false;
                    console.warn('[LiveSync] Connection lost:', responseObject.errorMessage);
                    this.callbacks.onStatusChange({
                        status: 'disconnected',
                        broker: broker.name,
                        room: this.roomCode,
                        error: responseObject.errorMessage
                    });
                    this.scheduleReconnect(true);
                };

                this.client.onMessageArrived = (message) => {
                    try {
                        const payload = JSON.parse(message.payloadString);
                        this.handleInboundPayload(payload, 'mqtt');
                    } catch (err) {
                        console.error('[LiveSync] Failed to parse message payload:', err);
                    }
                };

                this.client.connect({
                    useSSL: broker.ssl,
                    timeout: 6,
                    keepAliveInterval: 30,
                    cleanSession: true,
                    onSuccess: () => {
                        this.isConnected = true;
                        this.isConnecting = false;
                        console.log(`[LiveSync] Connected to ${broker.name} for Room [${this.roomCode}]`);
                        this.subscribeToTopics();
                        this.startPresenceLoop();

                        this.callbacks.onStatusChange({
                            status: 'connected',
                            broker: broker.name,
                            room: this.roomCode,
                            role: this.role
                        });

                        // If player or TV just joined, request current state from DJ
                        if (this.role !== 'dj') {
                            this.sendPayload('STATE_REQUEST', { requesterId: this.clientId });
                        }
                    },
                    onFailure: (err) => {
                        this.isConnected = false;
                        this.isConnecting = false;
                        console.warn(`[LiveSync] Failed connecting to ${broker.name}:`, err);
                        // Rotate to next broker
                        this.currentBrokerIdx = (this.currentBrokerIdx + 1) % BROKERS.length;
                        this.scheduleReconnect(false);
                    }
                });

            } catch (err) {
                this.isConnected = false;
                this.isConnecting = false;
                console.error('[LiveSync] Error creating client:', err);
                this.currentBrokerIdx = (this.currentBrokerIdx + 1) % BROKERS.length;
                this.scheduleReconnect(false);
            }
        }

        subscribeToTopics() {
            if (!this.isConnected || !this.client) return;
            const base = this.getTopicBase();

            const wildcardTopic = `${base}/#`;
            this.client.subscribe(wildcardTopic, {
                qos: 0,
                onSuccess: () => {
                    console.log(`[LiveSync] Subscribed to ${wildcardTopic}`);
                },
                onFailure: (err) => {
                    console.warn(`[LiveSync] Failed subscribe to ${wildcardTopic}:`, err);
                }
            });
        }

        scheduleReconnect(immediateFailover) {
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            const delay = immediateFailover ? 1500 : 4000;
            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, delay);
        }

        startPresenceLoop() {
            if (this.presenceTimer) clearInterval(this.presenceTimer);

            this.sendPresencePing();

            this.presenceTimer = setInterval(() => {
                if (this.isConnected) {
                    this.sendPresencePing();
                }
                this.pruneStalePlayers();
            }, 20000);
        }

        sendPresencePing() {
            const playerName = (typeof localStorage !== 'undefined' && localStorage.getItem('bingo_player_name')) || 'Player';
            this.sendPayload('PRESENCE_PING', {
                senderId: this.clientId,
                name: playerName,
                role: this.role,
                timestamp: Date.now()
            });
        }

        pruneStalePlayers() {
            const now = Date.now();
            let changed = false;
            for (const [id, info] of this.activePlayers.entries()) {
                if (now - info.lastSeen > 45000) {
                    this.activePlayers.delete(id);
                    changed = true;
                }
            }
            if (changed) {
                this.callbacks.onPresenceUpdate(this.activePlayers.size, Array.from(this.activePlayers.values()));
            }
        }

        sendPayload(type, data = {}) {
            const payload = Object.assign({
                type: type,
                room: this.roomCode,
                senderId: this.clientId,
                role: this.role,
                timestamp: Date.now()
            }, data);

            // 1. Post to local BroadcastChannel (for same-machine HDMI second screen)
            if (this.broadcastChannel) {
                try {
                    this.broadcastChannel.postMessage(payload);
                } catch (e) {}
            }

            // 2. Publish to Cloud MQTT broker
            if (this.isConnected && this.client) {
                try {
                    const subTopic = (type === 'BINGO_CLAIM') ? 'claims' :
                                    (type === 'PRESENCE_PING') ? 'presence' : 'broadcast';
                    const targetTopic = `${this.getTopicBase()}/${subTopic}`;
                    const message = new Paho.Message(JSON.stringify(payload));
                    message.destinationName = targetTopic;
                    message.qos = 0;
                    this.client.send(message);
                } catch (err) {
                    console.error('[LiveSync] Send error:', err);
                }
            }
        }

        handleInboundPayload(payload, source) {
            if (!payload || !payload.type) return;
            if (payload.senderId === this.clientId) return;
            if (payload.room && payload.room !== this.roomCode) return;

            switch (payload.type) {
                case 'CALL':
                case 'DRAW_BALL':
                    this.callbacks.onCall(payload);
                    break;
                case 'REVEAL':
                case 'REVEAL_TRACK':
                    this.callbacks.onReveal(payload);
                    break;
                case 'ROUND_CHANGE':
                case 'CHANGE_PATTERN':
                    this.callbacks.onRoundChange(payload);
                    break;
                case 'WINNER':
                case 'BROADCAST_WINNER':
                    this.callbacks.onWinner(payload);
                    break;
                case 'RESET':
                case 'RESET_GAME':
                    this.callbacks.onReset(payload);
                    break;
                case 'BINGO_CLAIM':
                    this.callbacks.onClaim(payload);
                    break;
                case 'PRESENCE_PING':
                    this.handlePresencePing(payload);
                    break;
                case 'STATE_REQUEST':
                    if (this.role === 'dj') {
                        this.callbacks.onStateRequest(payload);
                    }
                    break;
                case 'STATE_SYNC':
                    if (this.role !== 'dj') {
                        this.callbacks.onStateSync(payload);
                    }
                    break;
                default:
                    break;
            }
        }

        handlePresencePing(payload) {
            if (!payload.senderId) return;
            this.activePlayers.set(payload.senderId, {
                id: payload.senderId,
                name: payload.name || 'Player',
                role: payload.role || 'player',
                lastSeen: Date.now()
            });
            this.callbacks.onPresenceUpdate(this.activePlayers.size, Array.from(this.activePlayers.values()));
        }

        broadcastCall(data) {
            this.sendPayload('CALL', data);
        }

        broadcastReveal(data) {
            this.sendPayload('REVEAL', data);
        }

        broadcastRound(data) {
            this.sendPayload('ROUND_CHANGE', data);
        }

        broadcastWinner(data) {
            this.sendPayload('WINNER', data);
        }

        broadcastReset(data) {
            this.sendPayload('RESET', data);
        }

        broadcastStateSync(fullState) {
            this.sendPayload('STATE_SYNC', fullState);
        }

        sendBingoClaim(cardId, playerName, tier) {
            this.sendPayload('BINGO_CLAIM', {
                cardId: cardId,
                playerName: playerName || 'Player',
                tier: tier || 'Line'
            });
        }
    }

    const defaultInstance = new LiveSyncEngine();
    defaultInstance.LiveSyncEngine = LiveSyncEngine;
    return defaultInstance;
}));
