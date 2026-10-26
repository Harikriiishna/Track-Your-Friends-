import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import type { ChatMessage, Room, RoomMember, UserRole, UserProfile, SavedPlace } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { VoiceRecorder, sound, triggerHaptic } from '../../utils/audio.ts';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';
import { LiveMap } from '../Map/LiveMap.tsx';
import {
  Hash,
  Volume2,
  Radio,
  Megaphone,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Headphones,
  Settings,
  Smile,
  Plus,
  Search,
  X,
  Check,
  Trash2,
  Edit2,
  Reply,
  MapPin,
  Map as MapIcon,
  Compass,
  Users,
  PhoneCall,
  PhoneOff,
  Globe,
  Lock,
  Copy,
  ExternalLink,
  FileAudio,
  Image,
  Sparkles,
  Phone,
  ChevronDown,
  Navigation,
  UserX,
} from 'lucide-react';

interface ChatViewProps {
  userRooms?: Room[];
  selectedRoomId?: string | null;
  onSelectRoom?: (roomId: string) => void;
  selectedChatUser?: { id: string; name: string; avatar: string } | null;
  onSelectChatUser?: (user: { id: string; name: string; avatar: string } | null) => void;
  onFocusMapLocation?: (lat: number, lng: number) => void;
  onNavigateTab?: (tab: string) => void;
  savedPlaces?: SavedPlace[];
  onRefreshSavedPlaces?: () => void;
  onAddPlaceAtCoords?: (lat: number, lng: number) => void;
  onSetReminderAtCoords?: (lat: number, lng: number, title?: string) => void;

  // Fallback props if passed in isolation
  roomId?: string;
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  roomName?: string;
}

const TEXT_CHANNELS = [
  { id: 'general', name: 'general', icon: Hash, desc: 'Global community chatter & announcements' },
  { id: 'live-locations', name: 'live-locations', icon: MapPin, desc: 'Real-time GPS coordinate drops & map beacons' },
  { id: 'announcements', name: 'announcements', icon: Megaphone, desc: 'Beacon mesh updates & safety alerts' },
  { id: 'lounge', name: 'lounge', icon: MessageSquare, desc: 'Casual hangout, voice chatter & coordination' },
];

const VOICE_CHANNELS = [
  { id: 'voice-general', name: 'General Voice', icon: Volume2 },
  { id: 'voice-radio', name: 'Field Ops Radio', icon: Radio },
];

const QUICK_EMOJIS = ['👍', '❤️', '📍', '🔥', '🚀', '😂', '👀', '🤝', '⚡', '🎉'];

export interface DisplayChatMessage {
  id: string;
  senderId?: string;
  sender?: string;
  senderName: string;
  senderAvatar?: string;
  role?: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
  channelId?: string;
  roomId?: string;
  attachments?: any[];
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  reactions?: Record<string, string[]>;
  createdAt?: string;
  isEdited?: boolean;
}

const INITIAL_CHANNEL_MESSAGES: Record<string, DisplayChatMessage[]> = {};

export const ChatView: React.FC<ChatViewProps> = ({
  userRooms = [],
  selectedRoomId: controlledRoomId,
  onSelectRoom,
  selectedChatUser,
  onSelectChatUser,
  onFocusMapLocation,
  onNavigateTab,
  savedPlaces = [],
  onRefreshSavedPlaces,
  onAddPlaceAtCoords,
  onSetReminderAtCoords,
  roomId: fallbackRoomId,
  recipientId: fallbackRecipientId,
  recipientName: fallbackRecipientName,
  recipientAvatar: fallbackRecipientAvatar,
  roomName: fallbackRoomName,
}) => {
  const { user } = useAuth();
  const {
    myLocation,
    userLocations,
    onlineUserIds,
    chatMessages,
    sendMessage,
    setConversationMessages,
    sendTyping,
    sendReaction,
    deleteMessage,
    clearChat,
    editMessage,
    typingUsers,
    activeVoiceRoomId,
    isVoiceConnected,
    isMicMuted,
    isSpeaking,
    voiceParticipants,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMicMute,
    requestLocationUpdate,
  } = useRealtime();

  const toast = useToast();
  const { themeConfig, currentTheme } = useTheme();

  // Active room and channel resolution
  const [activeRoomId, setActiveRoomId] = useState<string>(
    controlledRoomId || fallbackRoomId || (userRooms.length > 0 ? userRooms[0].id : 'room-universal')
  );
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [activeDirectUser, setActiveDirectUser] = useState<{ id: string; name: string; avatar: string } | null>(
    selectedChatUser || (fallbackRecipientId ? { id: fallbackRecipientId, name: fallbackRecipientName || 'User', avatar: fallbackRecipientAvatar || '' } : null)
  );

  // Sync with controlled props if passed
  useEffect(() => {
    if (controlledRoomId) {
      setActiveRoomId(controlledRoomId);
      setActiveDirectUser(null);
    }
  }, [controlledRoomId]);

  useEffect(() => {
    if (selectedChatUser) {
      setActiveDirectUser(selectedChatUser);
    }
  }, [selectedChatUser]);

  // UI state
  const [roomDetails, setRoomDetails] = useState<Room | null>(null);
  const [showRoomMap, setShowRoomMap] = useState(false);
  const [roomMapFocusCoords, setRoomMapFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [channelMessages, setChannelMessages] = useState<Record<string, DisplayChatMessage[]>>(INITIAL_CHANNEL_MESSAGES);
  const [inputVal, setInputVal] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessage | DisplayChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{ dataUrl: string; duration: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const [isDeafened, setIsDeafened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Effective conversation key
  const effectiveRoomId = activeDirectUser ? undefined : activeRoomId;
  const effectiveRecipientId = activeDirectUser ? activeDirectUser.id : undefined;
  const conversationKey = effectiveRoomId || effectiveRecipientId || 'room-universal';

  // Load room details & message history
  useEffect(() => {
    if (!effectiveRoomId) return;
    async function fetchDetails() {
      try {
        const res = await api.get<{ room: Room }>(`/api/rooms/${effectiveRoomId}`);
        setRoomDetails(res.room);
      } catch (err) {
        console.error('Failed to load room details:', err);
      }
    }
    fetchDetails();
  }, [effectiveRoomId]);

  // Load conversation messages from REST
  useEffect(() => {
    async function loadHistory() {
      try {
        if (effectiveRoomId) {
          const res = await api.get<{ messages: ChatMessage[] }>(`/api/rooms/${effectiveRoomId}/messages`);
          setConversationMessages(effectiveRoomId, res.messages);
        } else if (effectiveRecipientId) {
          const res = await api.get<{ messages: ChatMessage[] }>(`/api/direct-messages/${effectiveRecipientId}`);
          setConversationMessages(effectiveRecipientId, res.messages);
        }
      } catch (err) {
        console.error('Failed to load message history:', err);
      }
    }
    loadHistory();
  }, [effectiveRoomId, effectiveRecipientId, setConversationMessages]);

  // Merge local channel state with incoming real-time socket messages without duplicate rendering
  // Strictly isolates messages to their respective room/conversation
  const activeChannelMessages: DisplayChatMessage[] = useMemo(() => {
    const storageKey = `${conversationKey}:${activeChannelId}`;
    const currentList = channelMessages[storageKey] || [];
    const remoteList = (chatMessages[conversationKey] || []).filter((m) => {
      const msgChannel = m.channelId || 'general';
      if (msgChannel !== activeChannelId) return false;
      // Strict room isolation: If inside a room, only show messages belonging to this room
      if (effectiveRoomId && m.roomId && m.roomId !== effectiveRoomId) return false;
      return true;
    });

    const confirmedClientIds = new Set(
      remoteList.map((m: any) => m.clientMsgId).filter(Boolean)
    );

    // Filter currentList to ONLY keep optimistic local messages that have NOT yet arrived from the server
    const pendingLocal: DisplayChatMessage[] = currentList.filter((local) => {
      // 1. Matched by clientMsgId
      if (confirmedClientIds.has(local.id)) return false;

      // 2. Fallback heuristic: match by sender + identical trimmed text within 30 seconds
      const localTimeMs = Number(local.id) || (local.createdAt ? new Date(local.createdAt).getTime() : 0);
      const isFulfilled = remoteList.some((r) => {
        const isSameSender = r.senderId === user?.id || local.isSelf;
        const isSameText = r.text.trim() === local.text.trim();
        if (!isSameSender || !isSameText) return false;
        if (!localTimeMs) return true;
        const rTimeMs = new Date(r.createdAt).getTime();
        return Math.abs(rTimeMs - localTimeMs) < 30000;
      });

      return !isFulfilled;
    });

    // Deduplicate remote messages themselves (preventing socket echo duplicates)
    const seenIds = new Set<string>();
    const convertedRemote: DisplayChatMessage[] = [];

    for (const m of remoteList) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);

      convertedRemote.push({
        id: m.id,
        senderId: m.senderId,
        sender: m.senderName,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        role: m.senderId === user?.id ? 'ADMIN' : undefined,
        text: m.text,
        timestamp: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: m.senderId === user?.id,
        channelId: m.channelId || 'general',
        attachments: m.attachments,
        replyToId: m.replyToId,
        replyToText: m.replyToText,
        replyToSender: m.replyToSender,
        reactions: m.reactions,
        createdAt: m.createdAt,
        isEdited: m.isEdited,
      });
    }

    return [...convertedRemote, ...pendingLocal];
  }, [channelMessages, activeChannelId, chatMessages, conversationKey, user]);

  const displayMessages: DisplayChatMessage[] = useMemo(() => {
    if (!searchQuery.trim()) return activeChannelMessages;
    return activeChannelMessages.filter((m: DisplayChatMessage) =>
      m.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeChannelMessages, searchQuery]);

  // Auto-scroll on new messages or channel switch
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length, activeChannelId]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    sendTyping({ roomId: effectiveRoomId, recipientId: effectiveRecipientId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping({ roomId: effectiveRoomId, recipientId: effectiveRecipientId, isTyping: false });
    }, 2000);
  };

  // Voice note recording flow
  const startRecording = async () => {
    try {
      const rec = new VoiceRecorder();
      await rec.start();
      voiceRecorderRef.current = rec;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      toast.error(`Microphone error: ${err.message || 'Permission denied'}`);
    }
  };

  const stopRecording = async () => {
    if (!voiceRecorderRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    try {
      const result = await voiceRecorderRef.current.stop();
      setIsRecording(false);
      setVoicePreview({ dataUrl: result.dataUrl, duration: result.durationSeconds });
    } catch (err) {
      console.error('Error stopping recorder:', err);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (voiceRecorderRef.current) voiceRecorderRef.current.cancel();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setVoicePreview(null);
  };

  const handleSendVoiceNote = async () => {
    if (!voicePreview) return;
    try {
      setIsUploading(true);
      const res = await api.uploadFile(voicePreview.dataUrl, `voice-note-${Date.now()}.webm`, 'audio/webm');
      const targetChannel = activeChannelId || 'general';
      const storageKey = `${conversationKey}:${targetChannel}`;
      const voiceMsg: DisplayChatMessage = {
        id: Date.now().toString(),
        senderId: user?.id || 'self',
        sender: user?.fullName || 'Reddy',
        senderName: user?.fullName || 'Reddy',
        senderAvatar: user?.avatarUrl,
        role: 'ADMIN',
        text: '🎤 Voice message',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true,
        channelId: targetChannel,
        roomId: effectiveRoomId,
        attachments: [
          {
            id: 'att-' + Math.random().toString(36).slice(2),
            type: 'voice',
            url: res.url,
            name: 'Voice message',
            size: res.size,
            duration: voicePreview.duration,
          },
        ],
        replyToId: replyTarget?.id,
        replyToText: replyTarget?.text,
        replyToSender: replyTarget?.senderName,
      };

      setChannelMessages((prev) => ({
        ...prev,
        [storageKey]: [...(prev[storageKey] || []), voiceMsg],
      }));

      sendMessage({
        roomId: effectiveRoomId,
        channelId: effectiveRoomId ? targetChannel : undefined,
        recipientId: effectiveRecipientId,
        text: '🎤 Voice message',
        attachments: voiceMsg.attachments,
        replyToId: replyTarget?.id,
        clientMsgId: voiceMsg.id,
      });

      sound.playSuccess();
      triggerHaptic('light');
      setVoicePreview(null);
      setReplyTarget(null);
    } catch (err: any) {
      console.error('Failed to send voice message:', err);
      toast.error('Failed to upload voice message');
    } finally {
      setIsUploading(false);
    }
  };

  // Send message handler with optimistic local state update & mock peer response
  const handleSendMessage = (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputVal).trim();
    if (!textToSend && !voicePreview) return;

    if (voicePreview) {
      handleSendVoiceNote();
      return;
    }

    const targetChannel = activeChannelId || 'general';
    const storageKey = `${conversationKey}:${targetChannel}`;
    const tempId = Date.now().toString();
    const newMsg: DisplayChatMessage = {
      id: tempId,
      senderId: user?.id || 'self',
      sender: user?.fullName || 'Reddy',
      senderName: user?.fullName || 'Reddy',
      senderAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80',
      role: 'ADMIN',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      channelId: targetChannel,
      roomId: effectiveRoomId,
      replyToId: replyTarget?.id,
      replyToText: replyTarget?.text,
      replyToSender: replyTarget?.senderName,
    };

    // 1. Immediately append to state scoped to this room and channel
    setChannelMessages((prev) => ({
      ...prev,
      [storageKey]: [...(prev[storageKey] || []), newMsg],
    }));

    // 2. Clear input immediately
    if (customText === undefined) {
      setInputVal('');
    }
    setReplyTarget(null);
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
    sound.playTap();
    triggerHaptic('light');

    // 3. Dispatch through WebSocket with clientMsgId
    sendMessage({
      roomId: effectiveRoomId,
      channelId: effectiveRoomId ? targetChannel : undefined,
      recipientId: effectiveRecipientId,
      text: textToSend,
      replyToId: replyTarget?.id,
      clientMsgId: tempId,
    });

    sendTyping({ roomId: effectiveRoomId, recipientId: effectiveRecipientId, isTyping: false });

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Instant location share
  const handleShareCurrentLocation = () => {
    if (!myLocation) {
      requestLocationUpdate();
      toast.info('Fetching live GPS coordinates...');
      return;
    }

    const lat = myLocation.latitude.toFixed(5);
    const lng = myLocation.longitude.toFixed(5);
    const acc = myLocation.accuracy ? `±${myLocation.accuracy.toFixed(1)}m` : '±10m';
    const locText = `📍 Live Location Shared: ${lat}° N, ${lng}° W (Accuracy: ${acc})`;

    handleSendMessage(locText);

    sound.playSuccess();
    triggerHaptic('medium');
    toast.success('Live location posted to channel');
    setShowPlusMenu(false);
  };

  // Image file attachment
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIsUploading(true);
        const dataUrl = reader.result as string;
        const res = await api.uploadFile(dataUrl, file.name, file.type);
        sendMessage({
          roomId: effectiveRoomId,
          channelId: effectiveRoomId ? activeChannelId : undefined,
          recipientId: effectiveRecipientId,
          text: file.name,
          attachments: [
            {
              id: 'att-' + Math.random().toString(36).slice(2),
              type: 'image',
              url: res.url,
              name: file.name,
              size: file.size,
            },
          ],
        });
        setShowPlusMenu(false);
      } catch (err) {
        console.error('Failed to upload image:', err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Parse Discord markdown: bold, italic, code block, inline code, quotes, mentions
  const renderDiscordMarkdown = (text: string) => {
    // Check if location shared
    const isLocationShared = text.includes('📍 Live Location Shared');

    // Parse bold, italics, inline code
    const parts = text.split('\n');
    return (
      <div className="space-y-1">
        {parts.map((line, idx) => {
          // Render blockquote if starts with >
          if (line.startsWith('> ')) {
            return (
              <div key={idx} className="border-l-4 border-[#4e5058] pl-2.5 py-0.5 text-[#949ba4] italic text-xs">
                {line.slice(2)}
              </div>
            );
          }

          // Highlight mentions
          const mentionRegex = /@(\w+)/g;
          const lineWithMentions = line.split(mentionRegex);

          return (
            <p key={idx} className="leading-relaxed break-words">
              {lineWithMentions.map((chunk, cIdx) => {
                if (cIdx % 2 === 1) {
                  return (
                    <span
                      key={cIdx}
                      className="bg-[#5865F2]/20 text-[#c9cdfb] font-semibold px-1 rounded hover:bg-[#5865F2]/40 transition-colors cursor-pointer"
                    >
                      @{chunk}
                    </span>
                  );
                }
                return chunk;
              })}
            </p>
          );
        })}

        {/* If location shared, render Discord rich embed card */}
        {isLocationShared && (
          <div className="mt-2.5 max-w-md rounded-lg overflow-hidden border-l-4 border-emerald-500 bg-[#2b2d31] p-3 text-white shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Live Beacon Coordinate Broadcast
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/50 font-mono">
                GPS LOCKED
              </span>
            </div>

            <p className="text-xs text-[#949ba4] mb-3">{text}</p>

            <button
              onClick={() => {
                // Extract coordinates if present
                const match = text.match(/([0-9.-]+)°\s*N,\s*([0-9.-]+)°\s*W/);
                if (match && onFocusMapLocation) {
                  const lat = parseFloat(match[1]);
                  const lng = -Math.abs(parseFloat(match[2]));
                  onFocusMapLocation(lat, lng);
                } else if (onNavigateTab) {
                  onNavigateTab('map');
                }
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 fill-current" />
              <span>View Coordinates on Live Map</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // Helper for member role badge
  const renderRoleBadge = (role?: UserRole | string) => {
    if (role === 'OWNER') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          OWNER
        </span>
      );
    }
    if (role === 'ADMIN') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#5865F2]/25 text-[#a5b4fc] border border-[#5865F2]/45 tracking-wider">
          ADMIN
        </span>
      );
    }
    if (role === 'MODERATOR' || role === 'MOD') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider">
          MOD
        </span>
      );
    }
    return null;
  };

  const currentTyping = typingUsers[conversationKey];
  const activeRoomObj = userRooms.find((r) => r.id === activeRoomId) || roomDetails;
  const isUniversalRoom = activeRoomId === 'room-universal' || activeRoomObj?.isUniversal;

  return (
    <div className={`flex h-full w-full overflow-hidden select-none relative ${themeConfig.appBg} ${themeConfig.textPrimary}`}>
      {/* 1. Leftmost Server Rail (Discord Guild Rail) */}
      <div className={`w-[72px] ${themeConfig.glassPanel} flex flex-col items-center py-3 gap-2 shrink-0 border-r ${themeConfig.glassBorder} z-20 backdrop-blur-2xl`}>
        {/* Direct Messages Home Pill */}
        <button
          onClick={() => {
            setActiveDirectUser(null);
            setActiveRoomId('room-universal');
            onSelectRoom?.('room-universal');
          }}
          className="group relative flex items-center justify-center w-12 h-12 cursor-pointer focus:outline-none"
          title="Direct Messages / Home"
        >
          {/* Active pill indicator on left edge */}
          <div
            className={`absolute left-0 w-1 bg-cyan-400 rounded-r-full transition-all duration-200 ${
              !activeDirectUser && activeRoomId === 'room-universal'
                ? 'h-10'
                : 'h-0 group-hover:h-5'
            }`}
          />
          <div
            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 ${
              !activeDirectUser && activeRoomId === 'room-universal'
                ? `rounded-2xl ${themeConfig.accentBg} text-white shadow-lg`
                : `rounded-[24px] group-hover:rounded-2xl ${themeConfig.glassCard} group-hover:${themeConfig.accentBg} ${themeConfig.textSecondary} group-hover:text-white`
            }`}
          >
            <Compass className="w-6 h-6" />
          </div>
        </button>

        {/* Separator line */}
        <div className={`w-8 h-[2px] ${themeConfig.glassBorder} rounded`} />

        {/* UNIVERSAL ROOM (Pinned Top with glowing halo) */}
        <button
          onClick={() => {
            setActiveDirectUser(null);
            setActiveRoomId('room-universal');
            onSelectRoom?.('room-universal');
          }}
          className="group relative flex items-center justify-center w-12 h-12 cursor-pointer focus:outline-none"
          title="🌐 Universal Lounge (Open to Everyone - Pinned Top)"
        >
          <div
            className={`absolute left-0 w-1 bg-cyan-400 rounded-r-full transition-all duration-200 ${
              !activeDirectUser && activeRoomId === 'room-universal'
                ? 'h-10'
                : 'h-0 group-hover:h-5'
            }`}
          />
          <div
            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 relative ${
              !activeDirectUser && activeRoomId === 'room-universal'
                ? 'rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-lg ring-2 ring-cyan-400/80 shadow-cyan-500/20'
                : `rounded-[24px] group-hover:rounded-2xl bg-gradient-to-tr from-indigo-950/60 to-slate-900/60 text-cyan-300 group-hover:text-white border ${themeConfig.glassBorder}`
            }`}
          >
            <Globe className="w-6 h-6 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 px-1 bg-cyan-500 text-white text-[8px] font-black rounded-full uppercase tracking-tighter shadow-sm">
              TOP
            </span>
          </div>
        </button>

        {/* Room Servers List */}
        <div className="flex-1 w-full overflow-y-auto space-y-2 flex flex-col items-center py-1">
          {userRooms
            .filter((r) => r.id !== 'room-universal')
            .map((room) => {
              const isSelected = !activeDirectUser && activeRoomId === room.id;
              const initials = room.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveDirectUser(null);
                    setActiveRoomId(room.id);
                    onSelectRoom?.(room.id);
                  }}
                  className="group relative flex items-center justify-center w-12 h-12 cursor-pointer focus:outline-none"
                  title={room.name}
                >
                  <div
                    className={`absolute left-0 w-1 bg-cyan-400 rounded-r-full transition-all duration-200 ${
                      isSelected ? 'h-10' : 'h-0 group-hover:h-5'
                    }`}
                  />
                  <div
                    className={`w-12 h-12 flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? `rounded-2xl ${themeConfig.accentBg} text-white font-bold text-sm shadow-md`
                        : `rounded-[24px] group-hover:rounded-2xl ${themeConfig.glassCard} group-hover:${themeConfig.accentBg} ${themeConfig.textSecondary} group-hover:text-white font-semibold text-xs`
                    }`}
                  >
                    {room.iconUrl ? (
                      <img src={room.iconUrl} alt="" className="w-full h-full object-cover rounded-inherit" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                </button>
              );
            })}

          {/* Add / Explore Rooms Action */}
          <button
            onClick={() => onNavigateTab?.('rooms')}
            className={`group flex items-center justify-center w-12 h-12 rounded-[24px] group-hover:rounded-2xl ${themeConfig.glassCard} hover:${themeConfig.accentBg} ${themeConfig.textSecondary} hover:text-white transition-all duration-200 cursor-pointer`}
            title="Create or Join a Room"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 2. Channel & Audio Sidebar (Discord Channel Bar) */}
      <div className={`w-60 ${themeConfig.glassPanel} flex flex-col shrink-0 border-r ${themeConfig.glassBorder} z-10 hidden sm:flex backdrop-blur-2xl`}>
        {/* Server Header */}
        <div className={`h-12 px-4 border-b ${themeConfig.glassBorder} flex items-center justify-between font-bold ${themeConfig.textPrimary} shadow-sm hover:bg-white/5 transition-colors cursor-pointer`}>
          <div className="flex items-center gap-2 truncate">
            {isUniversalRoom ? (
              <Globe className={`w-4 h-4 ${themeConfig.accentText} shrink-0`} />
            ) : (
              <Hash className="w-4 h-4 opacity-70 shrink-0" />
            )}
            <span className="truncate text-sm font-bold tracking-tight">
              {activeDirectUser ? `@${activeDirectUser.name}` : activeRoomObj?.name || 'Universal Lounge'}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (activeRoomId) {
                navigator.clipboard.writeText(activeRoomId);
                toast.success('Room ID copied to clipboard');
              }
            }}
            title="Copy Room ID"
            className={`p-1 opacity-70 hover:opacity-100 rounded hover:bg-white/10 transition-colors`}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* Direct Message Active State */}
          {activeDirectUser ? (
            <div>
              <span className={`px-2 text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider block mb-1`}>
                Direct Message Channel
              </span>
              <div className={`px-2.5 py-2 rounded-xl ${themeConfig.glassCard} ${themeConfig.textPrimary} flex items-center gap-2.5 border ${themeConfig.glassBorder}`}>
                <img
                  src={activeDirectUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span className="text-xs font-semibold truncate">{activeDirectUser.name}</span>
              </div>
            </div>
          ) : (
            <>
              {/* Text Channels Category */}
              <div>
                <div className={`px-2 mb-1 flex items-center justify-between text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider`}>
                  <span>Text Channels</span>
                  <button
                    onClick={handleShareCurrentLocation}
                    title="Quick Share Live Location"
                    className="hover:text-cyan-400 opacity-70 hover:opacity-100 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {TEXT_CHANNELS.map((ch) => {
                    const Icon = ch.icon;
                    const isActive = activeChannelId === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setActiveChannelId(ch.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          isActive
                            ? `${themeConfig.accentBg} text-white shadow-sm font-semibold`
                            : `${themeConfig.textSecondary} hover:bg-white/5 hover:${themeConfig.textPrimary}`
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${ch.id === 'live-locations' ? 'text-cyan-400' : ''}`} />
                        <span className="truncate">{ch.name}</span>
                        {ch.id === 'live-locations' && (
                          <span className="ml-auto px-1 bg-cyan-500/20 text-cyan-400 text-[9px] font-bold rounded">
                            GPS
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice Channels Category */}
              <div>
                <div className={`px-2 mb-1 flex items-center justify-between text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider`}>
                  <span>Voice Channels</span>
                </div>

                <div className="space-y-0.5">
                  {VOICE_CHANNELS.map((vc) => {
                    const Icon = vc.icon;
                    const isInThisVoice = activeVoiceRoomId === effectiveRoomId;

                    return (
                      <div key={vc.id} className="space-y-1">
                        <button
                          onClick={() => {
                            if (isInThisVoice) {
                              leaveVoiceChannel();
                            } else if (effectiveRoomId) {
                              joinVoiceChannel(effectiveRoomId);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                            isInThisVoice
                              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                              : `${themeConfig.textSecondary} hover:bg-white/5 hover:${themeConfig.textPrimary}`
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon className={`w-4 h-4 shrink-0 ${isInThisVoice ? 'text-cyan-400 animate-pulse' : ''}`} />
                            <span className="truncate">{vc.name}</span>
                          </div>

                          {isInThisVoice ? (
                            <span className="text-[10px] text-cyan-400 font-bold">CONNECTED</span>
                          ) : (
                            <span className="text-[10px] opacity-60">Join</span>
                          )}
                        </button>

                        {/* Connected Speakers in this Voice Channel */}
                        {isInThisVoice && (
                          <div className="pl-6 pr-2 py-1 space-y-1">
                            {/* Self */}
                            <div className={`flex items-center gap-2 text-xs ${themeConfig.textPrimary}`}>
                              <div className={`w-5 h-5 rounded-full overflow-hidden relative ${isSpeaking ? 'ring-2 ring-cyan-400' : ''}`}>
                                <img src={user?.avatarUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="truncate font-medium">{user?.fullName.split(' ')[0]} (You)</span>
                              {isMicMuted && <MicOff className="w-3 h-3 text-rose-400 ml-auto" />}
                            </div>

                            {/* Voice Peers */}
                            {voiceParticipants.map((p) => (
                              <div key={p.peerId} className={`flex items-center gap-2 text-xs ${themeConfig.textPrimary}`}>
                                <div className={`w-5 h-5 rounded-full overflow-hidden relative ${p.isSpeaking ? 'ring-2 ring-cyan-400' : ''}`}>
                                  <img src={p.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                                <span className="truncate font-medium">{p.user.fullName.split(' ')[0]}</span>
                                {p.isSpeaking && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-auto animate-ping" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Connected Voice Panel Bar */}
        {isVoiceConnected && (
          <div className={`px-3 py-2 bg-cyan-950/40 border-t ${themeConfig.glassBorder} backdrop-blur-md flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
              <div>
                <p className="text-[11px] font-bold text-cyan-300 leading-none">Voice Connected</p>
                <p className={`text-[10px] ${themeConfig.textSecondary} leading-tight mt-0.5`}>RTC Active / Spatial Sound</p>
              </div>
            </div>
            <button
              onClick={leaveVoiceChannel}
              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors"
              title="Disconnect Voice"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Discord Bottom User Control Bar */}
        <div className={`h-14 ${themeConfig.glassHeader} px-2.5 flex items-center justify-between shrink-0 border-t ${themeConfig.glassBorder}`}>
          <div
            onClick={() => onNavigateTab?.('profile')}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer flex-1 min-w-0"
          >
            <div className="relative">
              <img
                src={user?.avatarUrl}
                alt=""
                className={`w-8 h-8 rounded-full object-cover border ${themeConfig.glassBorder}`}
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" />
            </div>
            <div className="truncate">
              <p className={`text-xs font-bold ${themeConfig.textPrimary} leading-tight truncate`}>{user?.fullName}</p>
              <p className={`text-[10px] ${themeConfig.textSecondary} leading-none truncate`}>@{user?.username}</p>
            </div>
          </div>

          <div className={`flex items-center ${themeConfig.textSecondary}`}>
            <button
              onClick={toggleMicMute}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                isMicMuted ? 'text-rose-400' : `hover:${themeConfig.textPrimary}`
              }`}
              title={isMicMuted ? 'Unmute' : 'Mute'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsDeafened(!isDeafened)}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                isDeafened ? 'text-rose-400' : `hover:${themeConfig.textPrimary}`
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              <Headphones className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateTab?.('profile')}
              className={`p-1.5 rounded-lg hover:bg-white/10 hover:${themeConfig.textPrimary} transition-colors`}
              title="User Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Discord Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-transparent relative backdrop-blur-md">
        {/* Channel Header */}
        <div className={`h-12 px-4 border-b ${themeConfig.glassBorder} flex items-center justify-between ${themeConfig.glassHeader} shadow-sm z-10 shrink-0`}>
          <div className="flex items-center gap-2 truncate">
            {activeDirectUser ? (
              <span className={`font-bold ${themeConfig.textPrimary} text-sm`}>@{activeDirectUser.name}</span>
            ) : (
              <>
                <Hash className="w-5 h-5 opacity-70 shrink-0" />
                <span className={`font-bold ${themeConfig.textPrimary} text-sm tracking-tight`}>{activeChannelId}</span>
                <span className={`hidden md:inline text-xs ${themeConfig.textSecondary} border-l ${themeConfig.glassBorder} pl-2 truncate`}>
                  {TEXT_CHANNELS.find((c) => c.id === activeChannelId)?.desc || 'Beacon mesh coordination'}
                </span>
              </>
            )}
          </div>

          <div className={`flex items-center gap-1.5 ${themeConfig.textSecondary}`}>
            {/* Small Room Map Button in Room Header */}
            {!activeDirectUser && (
              <button
                onClick={() => {
                  setRoomMapFocusCoords(null);
                  setShowRoomMap(true);
                }}
                className="px-2.5 py-1 rounded-xl bg-emerald-600/25 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-emerald-500/40 active:scale-95"
                title={`Open Room Map showing users in ${activeRoomObj?.name || 'this room'}`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            )}

            <button
              onClick={handleShareCurrentLocation}
              className="px-2.5 py-1 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-cyan-500/30"
              title="Broadcast your live GPS coordinates to this channel"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Share Location</span>
            </button>

            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 hover:bg-white/10 hover:${themeConfig.textPrimary} rounded-xl transition-colors cursor-pointer`}
              title="Search Messages"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowMemberList(!showMemberList)}
              className={`p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer ${
                showMemberList ? `${themeConfig.accentBg} text-white` : `hover:${themeConfig.textPrimary}`
              }`}
              title="Toggle Member List"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Search Bar */}
        {showSearch && (
          <div className={`px-4 py-2 ${themeConfig.glassCard} border-b ${themeConfig.glassBorder} flex items-center gap-2`}>
            <Search className={`w-4 h-4 ${themeConfig.textSecondary}`} />
            <input
              type="text"
              placeholder="Search conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={`${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Message Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
          {/* Channel Welcome Banner */}
          <div className={`pt-6 pb-4 border-b ${themeConfig.glassBorder} mb-2`}>
            <div className={`w-12 h-12 rounded-2xl ${themeConfig.glassCard} flex items-center justify-center mb-2 border ${themeConfig.glassBorder}`}>
              <Hash className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className={`text-xl font-bold ${themeConfig.textPrimary} tracking-tight`}>
              Welcome to #{activeChannelId}!
            </h3>
            <p className={`text-xs ${themeConfig.textSecondary} mt-1`}>
              This is the start of the #{activeChannelId} channel on Beacon Mesh. Send coordinate updates, voice notes, and stay connected with everyone.
            </p>
          </div>

          {displayMessages.length === 0 ? (
            <div className={`py-8 text-center ${themeConfig.textSecondary} text-xs`}>
              No messages yet in this channel. Send the first message or share your live location!
            </div>
          ) : (
            displayMessages.map((msg: DisplayChatMessage) => {
              const isMe = msg.isSelf || msg.senderId === user?.id || (user?.fullName && (msg.senderName === user.fullName || msg.sender === user.fullName));
              const isEditing = editingMessageId === msg.id;
              const msgMember = roomDetails?.members?.find((m) => m.userId === msg.senderId);
              const senderDisplayName = msg.sender || msg.senderName || (isMe ? (user?.fullName || 'Reddy') : 'Peer Node');
              const roleToDisplay = msg.role || (isMe ? 'ADMIN' : msgMember?.role);
              const formattedTime = msg.timestamp || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
              const avatarSrc = msg.senderAvatar || (isMe ? (user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80') : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80');

              return (
                <div
                  key={msg.id}
                  className="group relative flex gap-3.5 hover:bg-white/5 -mx-4 px-4 py-1.5 rounded-xl transition-colors"
                >
                  {/* Floating Action Toolbar on Hover */}
                  <div className={`absolute right-4 -top-3 hidden group-hover:flex items-center gap-1 ${themeConfig.glassPanel} border ${themeConfig.glassBorder} rounded-xl shadow-lg px-1.5 py-0.5 z-20 backdrop-blur-xl`}>
                    <button
                      onClick={() => sendReaction(msg.id, '👍')}
                      className="p-1 hover:bg-white/10 text-xs rounded transition-colors cursor-pointer"
                      title="React 👍"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => sendReaction(msg.id, '❤️')}
                      className="p-1 hover:bg-white/10 text-xs rounded transition-colors cursor-pointer"
                      title="React ❤️"
                    >
                      ❤️
                    </button>
                    <button
                      onClick={() => sendReaction(msg.id, '📍')}
                      className="p-1 hover:bg-white/10 text-xs rounded transition-colors cursor-pointer"
                      title="React 📍"
                    >
                      📍
                    </button>
                    <button
                      onClick={() => setReplyTarget(msg)}
                      className={`p-1 hover:bg-white/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded transition-colors cursor-pointer`}
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    {isMe && (
                      <>
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditingText(msg.text);
                          }}
                          className={`p-1 hover:bg-white/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded transition-colors cursor-pointer`}
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            deleteMessage(msg.id);
                            setChannelMessages((prev) => ({
                              ...prev,
                              [activeChannelId]: (prev[activeChannelId] || []).filter((m) => m.id !== msg.id),
                            }));
                          }}
                          className="p-1 hover:bg-rose-500/20 text-rose-400 rounded transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Sender Avatar */}
                  <img
                    src={avatarSrc}
                    alt={senderDisplayName}
                    className={`w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-90 transition-opacity border ${themeConfig.glassBorder}`}
                    onClick={() => {
                      const peerUser = roomDetails?.members?.find((m) => m.userId === msg.senderId)?.user;
                      if (peerUser) setSelectedProfileUser(peerUser);
                    }}
                  />

                  {/* Message Content Body */}
                  <div className="flex-1 min-w-0">
                    {/* Quoted Reply context */}
                    {msg.replyToText && (
                      <div className={`flex items-center gap-1.5 text-xs ${themeConfig.textSecondary} mb-1 opacity-80`}>
                        <div className={`w-3 h-3 border-l-2 border-t-2 ${themeConfig.glassBorder} rounded-tl-sm -mb-2`} />
                        <span className={`font-bold ${themeConfig.textPrimary} text-[11px] truncate`}>
                          @{msg.replyToSender}
                        </span>
                        <span className="truncate text-[11px] italic">{msg.replyToText}</span>
                      </div>
                    )}

                    {/* Sender Meta Header */}
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span
                        className={`text-sm font-bold cursor-pointer hover:underline ${
                          roleToDisplay === 'OWNER'
                            ? 'text-amber-400'
                            : roleToDisplay === 'ADMIN'
                            ? themeConfig.accentText
                            : themeConfig.textPrimary
                        }`}
                        onClick={() => {
                          const peerUser = roomDetails?.members?.find((m) => m.userId === msg.senderId)?.user;
                          if (peerUser) setSelectedProfileUser(peerUser);
                        }}
                      >
                        {senderDisplayName}
                      </span>
                      {renderRoleBadge(roleToDisplay)}
                      <span className={`text-[10px] ${themeConfig.textSecondary}`}>
                        {formattedTime}
                      </span>
                      {msg.isEdited && <span className={`text-[10px] ${themeConfig.textSecondary}`}>(edited)</span>}
                    </div>

                    {/* Text Message or Edit Box */}
                    {isEditing ? (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className={`flex-1 ${themeConfig.glassInput} text-white px-3 py-1.5 rounded-xl text-sm focus:outline-none border ${themeConfig.glassBorder}`}
                        />
                        <button
                          onClick={() => {
                            editMessage(msg.id, editingText);
                            setEditingMessageId(null);
                          }}
                          className={`p-1.5 ${themeConfig.accentBg} text-white rounded-xl shadow-sm transition-colors`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      renderDiscordMarkdown(msg.text)
                    )}

                    {/* Attachments: Voice Notes or Images */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((att: any) => (
                          <div key={att.id}>
                            {att.type === 'voice' && (
                              <div className={`flex items-center gap-3 p-2.5 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} max-w-sm`}>
                                <FileAudio className={`w-6 h-6 ${themeConfig.accentText} shrink-0`} />
                                <audio controls src={att.url} className="h-8 flex-1" />
                                {att.duration && (
                                  <span className={`text-[10px] ${themeConfig.textSecondary} font-mono`}>
                                    {att.duration}s
                                  </span>
                                )}
                              </div>
                            )}

                            {att.type === 'image' && (
                              <img
                                src={att.url}
                                alt="Attachment"
                                className={`max-h-72 rounded-2xl object-cover cursor-pointer hover:opacity-95 border ${themeConfig.glassBorder} shadow-lg`}
                                onClick={() => window.open(att.url, '_blank')}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reactions Pill Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(msg.reactions).map(([emoji, rawUserIds]) => {
                          const userIds: string[] = Array.isArray(rawUserIds) ? (rawUserIds as string[]) : [];
                          const hasReacted = userIds.includes(user?.id || '');
                          return (
                            <button
                              key={emoji}
                              onClick={() => sendReaction(msg.id, emoji)}
                              className={`px-2 py-0.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                                hasReacted
                                  ? `${themeConfig.accentBg} text-white shadow-sm font-semibold`
                                  : `${themeConfig.glassCard} border ${themeConfig.glassBorder} ${themeConfig.textPrimary} hover:bg-white/10`
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[11px] font-semibold">{userIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quoted Reply Banner */}
        {replyTarget && (
          <div className={`px-4 py-2 ${themeConfig.glassCard} border-t ${themeConfig.glassBorder} flex items-center justify-between text-xs`}>
            <div className="flex items-center gap-2 truncate">
              <span className={themeConfig.textSecondary}>Replying to</span>
              <span className={`font-bold ${themeConfig.textPrimary}`}>@{replyTarget.senderName}:</span>
              <span className={`truncate ${themeConfig.textSecondary}`}>{replyTarget.text}</span>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className={`p-1 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Voice Note Recording Preview */}
        {voicePreview && (
          <div className={`px-4 py-2.5 ${themeConfig.glassCard} border-t ${themeConfig.glassBorder} flex items-center justify-between backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full ${themeConfig.accentBg} text-white flex items-center justify-center shadow`}>
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-xs font-bold ${themeConfig.textPrimary}`}>Recorded Audio Message ({voicePreview.duration}s)</p>
                <audio controls src={voicePreview.dataUrl} className="h-6 mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className={`px-3 py-1.5 text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded-lg hover:bg-white/10`}
              >
                Discard
              </button>
              <button
                onClick={handleSendVoiceNote}
                disabled={isUploading}
                className={`px-3.5 py-1.5 text-xs ${themeConfig.accentBg} text-white font-bold rounded-xl shadow-sm`}
              >
                {isUploading ? 'Uploading...' : 'Send Voice'}
              </button>
            </div>
          </div>
        )}

        {/* Active Audio Waveform Recording State */}
        {isRecording && (
          <div className={`px-4 py-2.5 ${themeConfig.glassPanel} border-t ${themeConfig.glassBorder} flex items-center justify-between gap-3 text-white backdrop-blur-2xl`}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="text-xs font-mono font-bold tabular-nums text-rose-300">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex-1 flex justify-center max-w-xs">
              <AudioWaveformVisualizer analyser={voiceRecorderRef.current?.getAnalyser() || null} height={28} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className={`px-3 py-1 text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`}
              >
                Cancel
              </button>
              <button
                onClick={stopRecording}
                className="px-3.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        <div className="px-4 min-h-6 py-0.5 text-xs flex items-center">
          {currentTyping && currentTyping.userId !== user?.id && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 shadow-sm animate-pulse">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[11px] font-medium tracking-wide">
                <strong className="text-white font-semibold">{currentTyping.name || 'User'}</strong> is typing...
              </span>
            </div>
          )}
        </div>

        {/* Discord Chat Input Box */}
        <div className="px-3 sm:px-4 pb-3 md:pb-4 pt-1.5 shrink-0 z-20">
          <div className={`relative ${themeConfig.glassInput} rounded-2xl flex items-center px-3 py-2 shadow-lg border ${themeConfig.glassBorder}`}>
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Plus Action Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                className={`w-8 h-8 rounded-xl bg-white/10 hover:${themeConfig.accentBg} flex items-center justify-center text-white transition-colors cursor-pointer mr-2 shrink-0`}
                title="Add attachment or location"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Plus Menu Popup */}
              {showPlusMenu && (
                <div className={`absolute bottom-12 left-0 ${themeConfig.glassPanel} border ${themeConfig.glassBorder} rounded-2xl shadow-2xl p-2 w-56 z-50 space-y-1 backdrop-blur-2xl`}>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowPlusMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-xs font-semibold ${themeConfig.textPrimary} hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer`}
                  >
                    <Image className="w-4 h-4 text-cyan-400" />
                    <span>Upload Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareCurrentLocation}
                    className={`w-full px-3 py-2 text-xs font-semibold ${themeConfig.textPrimary} hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer`}
                  >
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Broadcast Live GPS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      startRecording();
                      setShowPlusMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-xs font-semibold ${themeConfig.textPrimary} hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer`}
                  >
                    <Mic className="w-4 h-4 text-amber-400" />
                    <span>Record Voice Note</span>
                  </button>
                </div>
              )}
            </div>

            {/* Text Input */}
            <input
              type="text"
              placeholder={
                activeDirectUser
                  ? `Message @${activeDirectUser.name}...`
                  : `Message #${activeChannelId}...`
              }
              value={inputVal}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className={`flex-1 bg-transparent text-sm ${themeConfig.textPrimary} placeholder-slate-400 focus:outline-none min-w-0 pr-2`}
            />

            {/* Quick Actions Right */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={startRecording}
                className={`p-2 text-slate-400 hover:${themeConfig.textPrimary} hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden sm:flex items-center justify-center`}
                title="Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2 text-slate-400 hover:${themeConfig.textPrimary} hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden sm:flex items-center justify-center`}
                title="Add Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Prominent Active Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputVal.trim() && !voicePreview}
                aria-label="Send Message"
                className={`h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-150 shrink-0 font-medium text-xs cursor-pointer shadow-md ${
                  inputVal.trim() || voicePreview
                    ? 'bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-500 hover:opacity-95 text-white shadow-sky-500/30 active:scale-95'
                    : 'bg-white/10 text-white/40 cursor-not-allowed hover:bg-white/15'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-semibold">Send</span>
              </button>
            </div>

            {/* Quick Emoji Picker Popover */}
            {showEmojiPicker && (
              <div className={`absolute bottom-14 right-0 ${themeConfig.glassPanel} border ${themeConfig.glassBorder} rounded-2xl shadow-2xl p-2 z-50 flex gap-1 backdrop-blur-2xl`}>
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => {
                      setInputVal((prev) => prev + em);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-base cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Right Member List (Collapsible Discord Member Sidebar) */}
      {showMemberList && (
        <div className={`w-60 ${themeConfig.glassPanel} border-l ${themeConfig.glassBorder} flex flex-col shrink-0 hidden lg:flex backdrop-blur-2xl`}>
          <div className={`h-12 px-4 border-b ${themeConfig.glassBorder} flex items-center justify-between text-xs font-bold uppercase tracking-wider ${themeConfig.textSecondary}`}>
            <span>Channel Roster</span>
            <span className="text-[10px] font-mono">
              {roomDetails?.members?.length || 1} members
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {/* ONLINE SECTION */}
            <div>
              <span className={`px-2 text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider block mb-1`}>
                Online —{' '}
                {
                  roomDetails?.members?.filter(
                    (m) => onlineUserIds.includes(m.userId) || m.userId === user?.id
                  ).length || 1
                }
              </span>

              <div className="space-y-0.5">
                {roomDetails?.members
                  ?.filter((m) => onlineUserIds.includes(m.userId) || m.userId === user?.id)
                  .map((mem) => {
                    const peerLoc = userLocations.find((l) => l.userId === mem.userId);
                    let distText = '';
                    if (myLocation && peerLoc && mem.userId !== user?.id) {
                      const m = calculateDistanceMeters(
                        myLocation.latitude,
                        myLocation.longitude,
                        peerLoc.latitude,
                        peerLoc.longitude
                      );
                      distText = formatDistance(m);
                    }

                    return (
                      <button
                        key={mem.userId}
                        onClick={() => setSelectedProfileUser(mem.user)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-left group cursor-pointer"
                      >
                        <div className="relative">
                          <img
                            src={mem.user.avatarUrl}
                            alt=""
                            className={`w-8 h-8 rounded-full object-cover border ${themeConfig.glassBorder}`}
                          />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" />
                        </div>

                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-bold truncate ${
                                mem.role === 'OWNER'
                                  ? 'text-amber-400'
                                  : mem.role === 'ADMIN'
                                  ? themeConfig.accentText
                                  : themeConfig.textPrimary
                              }`}
                            >
                              {mem.user.fullName}
                            </span>
                          </div>
                          <span className={`text-[10px] ${themeConfig.textSecondary} block truncate`}>
                            {distText ? `📍 ${distText} away` : `@${mem.user.username}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* OFFLINE SECTION */}
            {roomDetails?.members?.some(
              (m) => !onlineUserIds.includes(m.userId) && m.userId !== user?.id
            ) && (
              <div>
                <span className={`px-2 text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider block mb-1`}>
                  Offline
                </span>

                <div className="space-y-0.5 opacity-60">
                  {roomDetails?.members
                    ?.filter((m) => !onlineUserIds.includes(m.userId) && m.userId !== user?.id)
                    .map((mem) => (
                      <button
                        key={mem.userId}
                        onClick={() => setSelectedProfileUser(mem.user)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-left cursor-pointer"
                      >
                        <div className="relative">
                          <img
                            src={mem.user.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover grayscale"
                          />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-900" />
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <span className={`text-xs font-semibold ${themeConfig.textSecondary} truncate block`}>
                            {mem.user.fullName}
                          </span>
                          <span className="text-[10px] opacity-60 block truncate">
                            @{mem.user.username}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discord User Profile Popout Modal */}
      {selectedProfileUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`${themeConfig.glassPanel} rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border ${themeConfig.glassBorder} animate-in fade-in duration-200 backdrop-blur-2xl`}>
            {/* Banner */}
            <div className="h-24 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 relative">
              <button
                onClick={() => setSelectedProfileUser(null)}
                className="absolute top-3 right-3 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="px-5 pb-5 pt-0 relative">
              <div className="relative -mt-12 mb-3">
                <img
                  src={selectedProfileUser.avatarUrl}
                  alt=""
                  className={`w-20 h-20 rounded-full object-cover border-4 border-slate-900 shadow-lg`}
                />
                <div
                  className={`absolute bottom-1 left-15 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    onlineUserIds.includes(selectedProfileUser.id)
                      ? 'bg-emerald-400'
                      : 'bg-slate-500'
                  }`}
                />
              </div>

              <h4 className={`text-lg font-bold ${themeConfig.textPrimary}`}>{selectedProfileUser.fullName}</h4>
              <p className={`text-xs ${themeConfig.textSecondary}`}>@{selectedProfileUser.username}</p>

              <div className={`mt-3 p-3 rounded-2xl ${themeConfig.glassCard} text-xs ${themeConfig.textPrimary} border ${themeConfig.glassBorder}`}>
                <p className={`font-semibold text-[11px] ${themeConfig.textSecondary} uppercase tracking-wider mb-1`}>
                  About Me
                </p>
                <p>{selectedProfileUser.about || 'Beacon Mesh Explorer'}</p>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                {selectedProfileUser.id !== user?.id && (
                  <>
                    <button
                      onClick={() => {
                        onSelectChatUser?.({
                          id: selectedProfileUser.id,
                          name: selectedProfileUser.fullName,
                          avatar: selectedProfileUser.avatarUrl,
                        });
                        setActiveDirectUser({
                          id: selectedProfileUser.id,
                          name: selectedProfileUser.fullName,
                          avatar: selectedProfileUser.avatarUrl,
                        });
                        setSelectedProfileUser(null);
                      }}
                      className={`flex-1 py-2 px-3 ${themeConfig.accentBg} text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>

                    {selectedProfileUser.phoneNumber &&
                      selectedProfileUser.privacy?.phoneVisibility !== 'nobody' && (
                        <a
                          href={`tel:${selectedProfileUser.phoneNumber}`}
                          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow"
                          title="Call Phone"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}

                    {userLocations.some((l) => l.userId === selectedProfileUser.id) && (
                      <button
                        onClick={() => {
                          const peerLoc = userLocations.find(
                            (l) => l.userId === selectedProfileUser.id
                          );
                          if (peerLoc && onFocusMapLocation) {
                            onFocusMapLocation(peerLoc.latitude, peerLoc.longitude);
                            setSelectedProfileUser(null);
                          }
                        }}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center shadow cursor-pointer"
                        title="Focus on Map"
                      >
                        <Compass className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          confirm(
                            `Block ${selectedProfileUser.fullName}? They will not be able to message you or track your location.`
                          )
                        ) {
                          try {
                            await api.blockUser(selectedProfileUser.id);
                            toast.success(`Blocked ${selectedProfileUser.fullName}`);
                            setSelectedProfileUser(null);
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to block user');
                          }
                        }
                      }}
                      className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl flex items-center justify-center shadow cursor-pointer transition-colors"
                      title={`Block ${selectedProfileUser.fullName}`}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Featured Room Map Overlay showing Users in the Room */}
      {showRoomMap && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in duration-150">
          <LiveMap
            isActive={showRoomMap}
            roomOnlyMode={true}
            activeRoomDetails={roomDetails || activeRoomObj || null}
            onCloseRoomMap={() => setShowRoomMap(false)}
            focusCoords={roomMapFocusCoords}
            savedPlaces={savedPlaces}
            onRefreshSavedPlaces={onRefreshSavedPlaces}
            rooms={userRooms}
            selectedRoomId={effectiveRoomId || activeRoomId}
            onSelectUserForChat={(targetUserId) => {
              setShowRoomMap(false);
              const peerLoc = userLocations.find((l) => l.userId === targetUserId);
              const mem = roomDetails?.members?.find((m) => m.userId === targetUserId)?.user;
              const name = mem?.fullName || peerLoc?.fullName || 'Peer';
              const avatar = mem?.avatarUrl || peerLoc?.avatarUrl || '';
              onSelectChatUser?.({ id: targetUserId, name, avatar });
              setActiveDirectUser({ id: targetUserId, name, avatar });
            }}
            onAddPlaceAtCoords={(lat, lng) => {
              setShowRoomMap(false);
              onAddPlaceAtCoords?.(lat, lng);
            }}
            onSetReminderAtCoords={(lat, lng, title) => {
              setShowRoomMap(false);
              onSetReminderAtCoords?.(lat, lng, title);
            }}
          />
        </div>
      )}
    </div>
  );
};
