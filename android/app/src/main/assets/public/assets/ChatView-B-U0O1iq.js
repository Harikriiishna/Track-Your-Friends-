import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { $ as Megaphone, A as Send, At as Copy, B as Phone, Bt as Check, Ct as FileAudio, D as Settings, F as Reply, G as Navigation, L as Radio, Q as MessageSquare, R as Plus, U as Pen, V as PhoneOff, X as Mic, Z as MicOff, _t as Hash, c as Users, en as require_react, gt as Headphones, j as Search, jt as Compass, n as X, nt as MapPin, o as Volume2, p as Trash2, pt as Image, tt as Map, u as UserX, v as Smile, vt as Globe } from "./vendor-icons-PxteBMrr.js";
import { E as calculateDistanceMeters, O as formatDistance, a as api, i as useAuth, n as useToast } from "./ToastContext-ziKLJ15f.js";
import { d as useRealtime, h as triggerHaptic, m as sound, p as VoiceRecorder, t as LiveMap, u as useTheme } from "./index-Beu_4vAP.js";
// src/components/Chat/AudioWaveformVisualizer.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var AudioWaveformVisualizer = ({ analyser, height = 36, barColor = "#38bdf8" }) => {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let animationFrameId;
		const bufferLength = analyser ? analyser.frequencyBinCount : 32;
		const dataArray = new Uint8Array(bufferLength);
		const render = () => {
			animationFrameId = requestAnimationFrame(render);
			const width = canvas.width;
			const h = canvas.height;
			ctx.clearRect(0, 0, width, h);
			if (analyser) analyser.getByteFrequencyData(dataArray);
			else for (let i = 0; i < dataArray.length; i++) dataArray[i] = 15 + Math.sin(Date.now() / 200 + i * .5) * 10;
			const barCount = 28;
			const barWidth = Math.floor(width / barCount) - 2;
			const step = Math.floor(dataArray.length / barCount) || 1;
			for (let i = 0; i < barCount; i++) {
				const percent = (dataArray[i * step] || 0) / 255;
				const barHeight = Math.max(4, Math.floor(percent * (h - 6)));
				const x = i * (barWidth + 2);
				const y = Math.floor((h - barHeight) / 2);
				const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
				grad.addColorStop(0, "#38bdf8");
				grad.addColorStop(1, "#2563eb");
				ctx.fillStyle = grad;
				ctx.beginPath();
				const radius = Math.min(barWidth / 2, 2);
				ctx.roundRect(x, y, barWidth, barHeight, radius);
				ctx.fill();
			}
		};
		render();
		return () => {
			cancelAnimationFrame(animationFrameId);
		};
	}, [analyser]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		width: 240,
		height,
		className: "w-full max-w-[240px] h-[36px] block rounded-md"
	});
};
// src/components/Chat/ChatView.tsx
var TEXT_CHANNELS = [
	{
		id: "general",
		name: "general",
		icon: Hash,
		desc: "Global community chatter & announcements"
	},
	{
		id: "live-locations",
		name: "live-locations",
		icon: MapPin,
		desc: "Real-time GPS coordinate drops & map beacons"
	},
	{
		id: "announcements",
		name: "announcements",
		icon: Megaphone,
		desc: "Beacon mesh updates & safety alerts"
	},
	{
		id: "lounge",
		name: "lounge",
		icon: MessageSquare,
		desc: "Casual hangout, voice chatter & coordination"
	}
];
var VOICE_CHANNELS = [{
	id: "voice-general",
	name: "General Voice",
	icon: Volume2
}, {
	id: "voice-radio",
	name: "Field Ops Radio",
	icon: Radio
}];
var QUICK_EMOJIS = [
	"👍",
	"❤️",
	"📍",
	"🔥",
	"🚀",
	"😂",
	"👀",
	"🤝",
	"⚡",
	"🎉"
];
var INITIAL_CHANNEL_MESSAGES = {};
var ChatView = ({ userRooms = [], selectedRoomId: controlledRoomId, onSelectRoom, selectedChatUser, onSelectChatUser, onFocusMapLocation, onNavigateTab, savedPlaces = [], onRefreshSavedPlaces, onAddPlaceAtCoords, onSetReminderAtCoords, roomId: fallbackRoomId, recipientId: fallbackRecipientId, recipientName: fallbackRecipientName, recipientAvatar: fallbackRecipientAvatar, roomName: fallbackRoomName }) => {
	const { user } = useAuth();
	const { myLocation, userLocations, onlineUserIds, chatMessages, sendMessage, setConversationMessages, sendTyping, sendReaction, deleteMessage, clearChat, editMessage, typingUsers, activeVoiceRoomId, isVoiceConnected, isMicMuted, isSpeaking, voiceParticipants, joinVoiceChannel, leaveVoiceChannel, toggleMicMute, requestLocationUpdate } = useRealtime();
	const toast = useToast();
	const { themeConfig, currentTheme } = useTheme();
	const [activeRoomId, setActiveRoomId] = (0, import_react.useState)(controlledRoomId || fallbackRoomId || (userRooms.length > 0 ? userRooms[0].id : "room-universal"));
	const [activeChannelId, setActiveChannelId] = (0, import_react.useState)("general");
	const [activeDirectUser, setActiveDirectUser] = (0, import_react.useState)(selectedChatUser || (fallbackRecipientId ? {
		id: fallbackRecipientId,
		name: fallbackRecipientName || "User",
		avatar: fallbackRecipientAvatar || ""
	} : null));
	(0, import_react.useEffect)(() => {
		if (controlledRoomId) {
			setActiveRoomId(controlledRoomId);
			setActiveDirectUser(null);
		}
	}, [controlledRoomId]);
	(0, import_react.useEffect)(() => {
		if (selectedChatUser) setActiveDirectUser(selectedChatUser);
	}, [selectedChatUser]);
	const [roomDetails, setRoomDetails] = (0, import_react.useState)(null);
	const [showRoomMap, setShowRoomMap] = (0, import_react.useState)(false);
	const [roomMapFocusCoords, setRoomMapFocusCoords] = (0, import_react.useState)(null);
	const [channelMessages, setChannelMessages] = (0, import_react.useState)(INITIAL_CHANNEL_MESSAGES);
	const [inputVal, setInputVal] = (0, import_react.useState)("");
	const [replyTarget, setReplyTarget] = (0, import_react.useState)(null);
	const [editingMessageId, setEditingMessageId] = (0, import_react.useState)(null);
	const [editingText, setEditingText] = (0, import_react.useState)("");
	const [isRecording, setIsRecording] = (0, import_react.useState)(false);
	const [recordingSeconds, setRecordingSeconds] = (0, import_react.useState)(0);
	const [voicePreview, setVoicePreview] = (0, import_react.useState)(null);
	const [isUploading, setIsUploading] = (0, import_react.useState)(false);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [showSearch, setShowSearch] = (0, import_react.useState)(false);
	const [showMemberList, setShowMemberList] = (0, import_react.useState)(true);
	const [showEmojiPicker, setShowEmojiPicker] = (0, import_react.useState)(false);
	const [showPlusMenu, setShowPlusMenu] = (0, import_react.useState)(false);
	const [selectedProfileUser, setSelectedProfileUser] = (0, import_react.useState)(null);
	const [isDeafened, setIsDeafened] = (0, import_react.useState)(false);
	const messagesEndRef = (0, import_react.useRef)(null);
	const fileInputRef = (0, import_react.useRef)(null);
	const voiceRecorderRef = (0, import_react.useRef)(null);
	const recordingTimerRef = (0, import_react.useRef)(null);
	const typingTimeoutRef = (0, import_react.useRef)(null);
	const lastTypingSentRef = (0, import_react.useRef)(0);
	const effectiveRoomId = activeDirectUser ? void 0 : activeRoomId;
	const effectiveRecipientId = activeDirectUser ? activeDirectUser.id : void 0;
	const conversationKey = effectiveRoomId || effectiveRecipientId || "room-universal";
	(0, import_react.useEffect)(() => {
		if (!effectiveRoomId) return;
		let active = true;
		async function fetchDetails() {
			try {
				const res = await api.get(`/api/rooms/${effectiveRoomId}`);
				if (!active || !res?.room) return;
				setRoomDetails((prev) => {
					if (!prev || prev.id !== res.room.id) return res.room;
					const prevMem = (prev.members || []).map((m) => `${m.userId}:${m.role}`).join("|");
					const nextMem = (res.room.members || []).map((m) => `${m.userId}:${m.role}`).join("|");
					if (prev.name === res.room.name && prev.description === res.room.description && prev.memberCount === res.room.memberCount && prevMem === nextMem) return prev;
					return res.room;
				});
			} catch (err) {
				console.warn("Could not load room details:", err);
			}
		}
		fetchDetails();
		window.addEventListener("beacon:cloud-sync-updated", fetchDetails);
		return () => {
			active = false;
			window.removeEventListener("beacon:cloud-sync-updated", fetchDetails);
		};
	}, [effectiveRoomId]);
	(0, import_react.useEffect)(() => {
		let active = true;
		async function loadHistory() {
			try {
				if (effectiveRoomId) {
					const res = await api.get(`/api/rooms/${effectiveRoomId}/messages`);
					if (active && res?.messages) setConversationMessages(effectiveRoomId, res.messages);
				} else if (effectiveRecipientId) {
					const res = await api.get(`/api/direct-messages/${effectiveRecipientId}`);
					if (active && res?.messages) setConversationMessages(effectiveRecipientId, res.messages);
				}
			} catch (err) {
				console.warn("Could not load message history:", err);
			}
		}
		loadHistory();
		return () => {
			active = false;
		};
	}, [
		effectiveRoomId,
		effectiveRecipientId,
		setConversationMessages
	]);
	const activeChannelMessages = (0, import_react.useMemo)(() => {
		const storageKey = `${conversationKey}:${activeChannelId}`;
		const currentList = channelMessages[storageKey] || [];
		const remoteList = (chatMessages[conversationKey] || []).filter((m) => {
			if ((m.channelId || "general") !== activeChannelId) return false;
			if (effectiveRoomId && m.roomId && m.roomId !== effectiveRoomId) return false;
			return true;
		});
		const confirmedClientIds = new Set(remoteList.map((m) => m.clientMsgId).filter(Boolean));
		const pendingLocal = currentList.filter((local) => {
			if (confirmedClientIds.has(local.id)) return false;
			const localTimeMs = Number(local.id) || (local.createdAt ? new Date(local.createdAt).getTime() : 0);
			return !remoteList.some((r) => {
				const isSameSender = r.senderId === user?.id || local.isSelf;
				const isSameText = r.text.trim() === local.text.trim();
				if (!isSameSender || !isSameText) return false;
				if (!localTimeMs) return true;
				const rTimeMs = new Date(r.createdAt).getTime();
				return Math.abs(rTimeMs - localTimeMs) < 3e4;
			});
		});
		const seenIds = /* @__PURE__ */ new Set();
		const convertedRemote = [];
		for (const m of remoteList) {
			if (seenIds.has(m.id)) continue;
			seenIds.add(m.id);
			convertedRemote.push({
				id: m.id,
				senderId: m.senderId,
				sender: m.senderName,
				senderName: m.senderName,
				senderAvatar: m.senderAvatar,
				role: m.senderId === user?.id ? "ADMIN" : void 0,
				text: m.text,
				timestamp: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				}) : (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				}),
				isSelf: m.senderId === user?.id,
				channelId: m.channelId || "general",
				attachments: m.attachments,
				replyToId: m.replyToId,
				replyToText: m.replyToText,
				replyToSender: m.replyToSender,
				reactions: m.reactions,
				createdAt: m.createdAt,
				isEdited: m.isEdited
			});
		}
		return [...convertedRemote, ...pendingLocal];
	}, [
		channelMessages,
		activeChannelId,
		chatMessages,
		conversationKey,
		user,
		effectiveRoomId
	]);
	const displayMessages = (0, import_react.useMemo)(() => {
		if (!searchQuery.trim()) return activeChannelMessages;
		return activeChannelMessages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
	}, [activeChannelMessages, searchQuery]);
	(0, import_react.useEffect)(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [displayMessages.length, activeChannelId]);
	const handleInputChange = (e) => {
		setInputVal(e.target.value);
		const now = performance.now();
		if (now - lastTypingSentRef.current > 1800) {
			lastTypingSentRef.current = now;
			sendTyping({
				roomId: effectiveRoomId,
				recipientId: effectiveRecipientId,
				isTyping: true
			});
		}
		if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
		typingTimeoutRef.current = setTimeout(() => {
			lastTypingSentRef.current = 0;
			sendTyping({
				roomId: effectiveRoomId,
				recipientId: effectiveRecipientId,
				isTyping: false
			});
		}, 2200);
	};
	const startRecording = async () => {
		try {
			const rec = new VoiceRecorder();
			await rec.start();
			voiceRecorderRef.current = rec;
			setIsRecording(true);
			setRecordingSeconds(0);
			recordingTimerRef.current = setInterval(() => {
				setRecordingSeconds((s) => s + 1);
			}, 1e3);
		} catch (err) {
			toast.error(`Microphone error: ${err.message || "Permission denied"}`);
		}
	};
	const stopRecording = async () => {
		if (!voiceRecorderRef.current) return;
		if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
		try {
			const result = await voiceRecorderRef.current.stop();
			setIsRecording(false);
			setVoicePreview({
				dataUrl: result.dataUrl,
				duration: result.durationSeconds
			});
		} catch (err) {
			console.error("Error stopping recorder:", err);
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
			const res = await api.uploadFile(voicePreview.dataUrl, `voice-note-${Date.now()}.webm`, "audio/webm");
			const targetChannel = activeChannelId || "general";
			const storageKey = `${conversationKey}:${targetChannel}`;
			const voiceMsg = {
				id: Date.now().toString(),
				senderId: user?.id || "self",
				sender: user?.fullName || "Reddy",
				senderName: user?.fullName || "Reddy",
				senderAvatar: user?.avatarUrl,
				role: "ADMIN",
				text: "🎤 Voice message",
				timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				}),
				isSelf: true,
				channelId: targetChannel,
				roomId: effectiveRoomId,
				attachments: [{
					id: "att-" + Math.random().toString(36).slice(2),
					type: "voice",
					url: res.url,
					name: "Voice message",
					size: res.size,
					duration: voicePreview.duration
				}],
				replyToId: replyTarget?.id,
				replyToText: replyTarget?.text,
				replyToSender: replyTarget?.senderName
			};
			setChannelMessages((prev) => ({
				...prev,
				[storageKey]: [...prev[storageKey] || [], voiceMsg]
			}));
			sendMessage({
				roomId: effectiveRoomId,
				channelId: effectiveRoomId ? targetChannel : void 0,
				recipientId: effectiveRecipientId,
				text: "🎤 Voice message",
				attachments: voiceMsg.attachments,
				replyToId: replyTarget?.id,
				clientMsgId: voiceMsg.id
			});
			sound.playSuccess();
			triggerHaptic("light");
			setVoicePreview(null);
			setReplyTarget(null);
		} catch (err) {
			console.error("Failed to send voice message:", err);
			toast.error("Failed to upload voice message");
		} finally {
			setIsUploading(false);
		}
	};
	const handleSendMessage = (customText) => {
		const textToSend = (customText !== void 0 ? customText : inputVal).trim();
		if (!textToSend && !voicePreview) return;
		if (voicePreview) {
			handleSendVoiceNote();
			return;
		}
		const targetChannel = activeChannelId || "general";
		const storageKey = `${conversationKey}:${targetChannel}`;
		const tempId = Date.now().toString();
		const newMsg = {
			id: tempId,
			senderId: user?.id || "self",
			sender: user?.fullName || "Reddy",
			senderName: user?.fullName || "Reddy",
			senderAvatar: user?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80",
			role: "ADMIN",
			text: textToSend,
			timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit"
			}),
			isSelf: true,
			channelId: targetChannel,
			roomId: effectiveRoomId,
			replyToId: replyTarget?.id,
			replyToText: replyTarget?.text,
			replyToSender: replyTarget?.senderName
		};
		setChannelMessages((prev) => ({
			...prev,
			[storageKey]: [...prev[storageKey] || [], newMsg]
		}));
		if (customText === void 0) setInputVal("");
		setReplyTarget(null);
		setShowEmojiPicker(false);
		setShowPlusMenu(false);
		sound.playTap();
		triggerHaptic("light");
		sendMessage({
			roomId: effectiveRoomId,
			channelId: effectiveRoomId ? targetChannel : void 0,
			recipientId: effectiveRecipientId,
			text: textToSend,
			replyToId: replyTarget?.id,
			clientMsgId: tempId
		});
		sendTyping({
			roomId: effectiveRoomId,
			recipientId: effectiveRecipientId,
			isTyping: false
		});
		setTimeout(() => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}, 50);
	};
	const handleShareCurrentLocation = () => {
		if (!myLocation) {
			requestLocationUpdate();
			toast.info("Fetching live GPS coordinates...");
			return;
		}
		const locText = `📍 Live Location Shared: ${myLocation.latitude.toFixed(5)}° N, ${myLocation.longitude.toFixed(5)}° W (Accuracy: ${myLocation.accuracy ? `±${myLocation.accuracy.toFixed(1)}m` : "±10m"})`;
		handleSendMessage(locText);
		sound.playSuccess();
		triggerHaptic("medium");
		toast.success("Live location posted to channel");
		setShowPlusMenu(false);
	};
	const handleImageUpload = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async () => {
			try {
				setIsUploading(true);
				const dataUrl = reader.result;
				const res = await api.uploadFile(dataUrl, file.name, file.type);
				sendMessage({
					roomId: effectiveRoomId,
					channelId: effectiveRoomId ? activeChannelId : void 0,
					recipientId: effectiveRecipientId,
					text: file.name,
					attachments: [{
						id: "att-" + Math.random().toString(36).slice(2),
						type: "image",
						url: res.url,
						name: file.name,
						size: file.size
					}]
				});
				setShowPlusMenu(false);
			} catch (err) {
				console.error("Failed to upload image:", err);
			} finally {
				setIsUploading(false);
			}
		};
		reader.readAsDataURL(file);
	};
	const renderDiscordMarkdown = (text) => {
		const isLocationShared = text.includes("📍 Live Location Shared");
		const parts = text.split("\n");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-1",
			children: [parts.map((line, idx) => {
				if (line.startsWith("> ")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-l-4 border-[#4e5058] pl-2.5 py-0.5 text-[#949ba4] italic text-xs",
					children: line.slice(2)
				}, idx);
				const lineWithMentions = line.split(/@(\w+)/g);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "leading-relaxed break-words",
					children: lineWithMentions.map((chunk, cIdx) => {
						if (cIdx % 2 === 1) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "bg-[#5865F2]/20 text-[#c9cdfb] font-semibold px-1 rounded hover:bg-[#5865F2]/40 transition-colors cursor-pointer",
							children: ["@", chunk]
						}, cIdx);
						return chunk;
					})
				}, idx);
			}), isLocationShared && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2.5 max-w-md rounded-lg overflow-hidden border-l-4 border-emerald-500 bg-[#2b2d31] p-3 text-white shadow-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between mb-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-emerald-400 shrink-0 animate-bounce" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-bold text-white tracking-wide",
								children: "Live Beacon Coordinate Broadcast"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/50 font-mono",
							children: "GPS LOCKED"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-[#949ba4] mb-3",
						children: text
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => {
							const match = text.match(/([0-9.-]+)°\s*N,\s*([0-9.-]+)°\s*W/);
							if (match && onFocusMapLocation) onFocusMapLocation(parseFloat(match[1]), -Math.abs(parseFloat(match[2])));
							else if (onNavigateTab) onNavigateTab("map");
						},
						className: "w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "View Coordinates on Live Map" })]
					})
				]
			})]
		});
	};
	const renderRoleBadge = (role) => {
		if (role === "OWNER") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40",
			children: "OWNER"
		});
		if (role === "ADMIN") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#5865F2]/25 text-[#a5b4fc] border border-[#5865F2]/45 tracking-wider",
			children: "ADMIN"
		});
		if (role === "MODERATOR" || role === "MOD") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider",
			children: "MOD"
		});
		return null;
	};
	const currentTyping = typingUsers[conversationKey];
	const activeRoomObj = userRooms.find((r) => r.id === activeRoomId) || roomDetails;
	const isUniversalRoom = activeRoomId === "room-universal" || activeRoomObj?.isUniversal;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex h-full w-full overflow-hidden select-none relative ${themeConfig.appBg} ${themeConfig.textPrimary}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `w-[72px] ${themeConfig.glassPanel} flex flex-col items-center py-3 gap-2 shrink-0 border-r ${themeConfig.glassBorder} z-20 backdrop-blur-2xl`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => {
							setActiveDirectUser(null);
							setActiveRoomId("room-universal");
							onSelectRoom?.("room-universal");
						},
						className: "group relative flex items-center justify-center w-12 h-12 cursor-pointer focus:outline-none",
						title: "Direct Messages / Home",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute left-0 w-1 bg-cyan-400 rounded-r-full transition-all duration-200 ${!activeDirectUser && activeRoomId === "room-universal" ? "h-10" : "h-0 group-hover:h-5"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `w-12 h-12 flex items-center justify-center transition-all duration-200 ${!activeDirectUser && activeRoomId === "room-universal" ? `rounded-2xl ${themeConfig.accentBg} text-white shadow-lg` : `rounded-[24px] group-hover:rounded-2xl ${themeConfig.glassCard} group-hover:${themeConfig.accentBg} ${themeConfig.textSecondary} group-hover:text-white`}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-6 h-6" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `w-8 h-[2px] ${themeConfig.glassBorder} rounded` }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => {
							setActiveDirectUser(null);
							setActiveRoomId("room-universal");
							onSelectRoom?.("room-universal");
						},
						className: "group relative flex items-center justify-center w-12 h-12 cursor-pointer focus:outline-none",
						title: "🌐 Universal Lounge (Open to Everyone - Pinned Top)",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute left-0 w-1 bg-cyan-400 rounded-r-full transition-all duration-200 ${!activeDirectUser && activeRoomId === "room-universal" ? "h-10" : "h-0 group-hover:h-5"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `w-12 h-12 flex items-center justify-center transition-all duration-200 relative ${!activeDirectUser && activeRoomId === "room-universal" ? "rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-lg ring-2 ring-cyan-400/80 shadow-cyan-500/20" : `rounded-[24px] group-hover:rounded-2xl bg-gradient-to-tr from-indigo-950/60 to-slate-900/60 text-cyan-300 group-hover:text-white border ${themeConfig.glassBorder}`}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-6 h-6 animate-spin-slow" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "absolute -top-1 -right-1 px-1 bg-cyan-500 text-white text-[8px] font-black rounded-full uppercase tracking-tighter shadow-sm",
								children: "TOP"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 w-full overflow-y-auto space-y-2 flex flex-col items-center py-1",
						children: [userRooms.filter((r) => r.id !== "room-universal").map((room) => {
							const isSelected = !activeDirectUser && activeRoomId === room.id;
							const initials = room.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => {
									setActiveDirectUser(null);
									setActiveRoomId(room.id);
									onSelectRoom?.(room.id);
								},
								className: "group relative flex items-center justify-center w-12 h-12 cursor-pointer focus:outline-none",
								title: room.name,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute left-0 w-1 bg-cyan-400 rounded-r-full transition-all duration-200 ${isSelected ? "h-10" : "h-0 group-hover:h-5"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `w-12 h-12 flex items-center justify-center transition-all duration-200 ${isSelected ? `rounded-2xl ${themeConfig.accentBg} text-white font-bold text-sm shadow-md` : `rounded-[24px] group-hover:rounded-2xl ${themeConfig.glassCard} group-hover:${themeConfig.accentBg} ${themeConfig.textSecondary} group-hover:text-white font-semibold text-xs`}`,
									children: room.iconUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: room.iconUrl,
										alt: "",
										className: "w-full h-full object-cover rounded-inherit"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: initials })
								})]
							}, room.id);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => onNavigateTab?.("rooms"),
							className: `group flex items-center justify-center w-12 h-12 rounded-[24px] group-hover:rounded-2xl ${themeConfig.glassCard} hover:${themeConfig.accentBg} ${themeConfig.textSecondary} hover:text-white transition-all duration-200 cursor-pointer`,
							title: "Create or Join a Room",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-6 h-6" })
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `w-60 ${themeConfig.glassPanel} flex flex-col shrink-0 border-r ${themeConfig.glassBorder} z-10 hidden sm:flex backdrop-blur-2xl`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `h-12 px-4 border-b ${themeConfig.glassBorder} flex items-center justify-between font-bold ${themeConfig.textPrimary} shadow-sm hover:bg-white/5 transition-colors cursor-pointer`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 truncate",
							children: [isUniversalRoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: `w-4 h-4 ${themeConfig.accentText} shrink-0` }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hash, { className: "w-4 h-4 opacity-70 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-sm font-bold tracking-tight",
								children: activeDirectUser ? `@${activeDirectUser.name}` : activeRoomObj?.name || "Universal Lounge"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: (e) => {
								e.stopPropagation();
								if (activeRoomId) {
									navigator.clipboard.writeText(activeRoomId);
									toast.success("Room ID copied to clipboard");
								}
							},
							title: "Copy Room ID",
							className: `p-1 opacity-70 hover:opacity-100 rounded hover:bg-white/10 transition-colors`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 overflow-y-auto px-2 py-3 space-y-4",
						children: activeDirectUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `px-2 text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider block mb-1`,
							children: "Direct Message Channel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `px-2.5 py-2 rounded-xl ${themeConfig.glassCard} ${themeConfig.textPrimary} flex items-center gap-2.5 border ${themeConfig.glassBorder}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: activeDirectUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80",
								alt: "",
								className: "w-6 h-6 rounded-full object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-semibold truncate",
								children: activeDirectUser.name
							})]
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `px-2 mb-1 flex items-center justify-between text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Text Channels" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleShareCurrentLocation,
								title: "Quick Share Live Location",
								className: "hover:text-cyan-400 opacity-70 hover:opacity-100 transition-colors",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3.5 h-3.5" })
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-0.5",
							children: TEXT_CHANNELS.map((ch) => {
								const Icon = ch.icon;
								const isActive = activeChannelId === ch.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setActiveChannelId(ch.id),
									className: `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${isActive ? `${themeConfig.accentBg} text-white shadow-sm font-semibold` : `${themeConfig.textSecondary} hover:bg-white/5 hover:${themeConfig.textPrimary}`}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: `w-4 h-4 shrink-0 ${ch.id === "live-locations" ? "text-cyan-400" : ""}` }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate",
											children: ch.name
										}),
										ch.id === "live-locations" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-auto px-1 bg-cyan-500/20 text-cyan-400 text-[9px] font-bold rounded",
											children: "GPS"
										})
									]
								}, ch.id);
							})
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `px-2 mb-1 flex items-center justify-between text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Voice Channels" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-0.5",
							children: VOICE_CHANNELS.map((vc) => {
								const Icon = vc.icon;
								const isInThisVoice = activeVoiceRoomId === effectiveRoomId;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											if (isInThisVoice) leaveVoiceChannel();
											else if (effectiveRoomId) joinVoiceChannel(effectiveRoomId);
										},
										className: `w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${isInThisVoice ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30" : `${themeConfig.textSecondary} hover:bg-white/5 hover:${themeConfig.textPrimary}`}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 truncate",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: `w-4 h-4 shrink-0 ${isInThisVoice ? "text-cyan-400 animate-pulse" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "truncate",
												children: vc.name
											})]
										}), isInThisVoice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-cyan-400 font-bold",
											children: "CONNECTED"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] opacity-60",
											children: "Join"
										})]
									}), isInThisVoice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "pl-6 pr-2 py-1 space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `flex items-center gap-2 text-xs ${themeConfig.textPrimary}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `w-5 h-5 rounded-full overflow-hidden relative ${isSpeaking ? "ring-2 ring-cyan-400" : ""}`,
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
														src: user?.avatarUrl,
														alt: "",
														className: "w-full h-full object-cover"
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "truncate font-medium",
													children: [user?.fullName.split(" ")[0], " (You)"]
												}),
												isMicMuted && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, { className: "w-3 h-3 text-rose-400 ml-auto" })
											]
										}), voiceParticipants.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `flex items-center gap-2 text-xs ${themeConfig.textPrimary}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `w-5 h-5 rounded-full overflow-hidden relative ${p.isSpeaking ? "ring-2 ring-cyan-400" : ""}`,
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
														src: p.user.avatarUrl,
														alt: "",
														className: "w-full h-full object-cover"
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "truncate font-medium",
													children: p.user.fullName.split(" ")[0]
												}),
												p.isSpeaking && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-cyan-400 ml-auto animate-ping" })
											]
										}, p.peerId))]
									})]
								}, vc.id);
							})
						})] })] })
					}),
					isVoiceConnected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `px-3 py-2 bg-cyan-950/40 border-t ${themeConfig.glassBorder} backdrop-blur-md flex items-center justify-between`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-bold text-cyan-300 leading-none",
								children: "Voice Connected"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `text-[10px] ${themeConfig.textSecondary} leading-tight mt-0.5`,
								children: "RTC Active / Spatial Sound"
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: leaveVoiceChannel,
							className: "p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors",
							title: "Disconnect Voice",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhoneOff, { className: "w-3.5 h-3.5" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `h-14 ${themeConfig.glassHeader} px-2.5 flex items-center justify-between shrink-0 border-t ${themeConfig.glassBorder}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							onClick: () => onNavigateTab?.("profile"),
							className: "flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer flex-1 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: user?.avatarUrl,
									alt: "",
									className: `w-8 h-8 rounded-full object-cover border ${themeConfig.glassBorder}`
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "truncate",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: `text-xs font-bold ${themeConfig.textPrimary} leading-tight truncate`,
									children: user?.fullName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: `text-[10px] ${themeConfig.textSecondary} leading-none truncate`,
									children: ["@", user?.username]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `flex items-center ${themeConfig.textSecondary}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: toggleMicMute,
									className: `p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isMicMuted ? "text-rose-400" : `hover:${themeConfig.textPrimary}`}`,
									title: isMicMuted ? "Unmute" : "Mute",
									children: isMicMuted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, { className: "w-4 h-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "w-4 h-4" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setIsDeafened(!isDeafened),
									className: `p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isDeafened ? "text-rose-400" : `hover:${themeConfig.textPrimary}`}`,
									title: isDeafened ? "Undeafen" : "Deafen",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Headphones, { className: "w-4 h-4" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => onNavigateTab?.("profile"),
									className: `p-1.5 rounded-lg hover:bg-white/10 hover:${themeConfig.textPrimary} transition-colors`,
									title: "User Settings",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "w-4 h-4" })
								})
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 flex flex-col h-full min-w-0 bg-transparent relative backdrop-blur-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `h-12 px-4 border-b ${themeConfig.glassBorder} flex items-center justify-between ${themeConfig.glassHeader} shadow-sm z-10 shrink-0`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-2 truncate",
							children: activeDirectUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: `font-bold ${themeConfig.textPrimary} text-sm`,
								children: ["@", activeDirectUser.name]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hash, { className: "w-5 h-5 opacity-70 shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `font-bold ${themeConfig.textPrimary} text-sm tracking-tight`,
									children: activeChannelId
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `hidden md:inline text-xs ${themeConfig.textSecondary} border-l ${themeConfig.glassBorder} pl-2 truncate`,
									children: TEXT_CHANNELS.find((c) => c.id === activeChannelId)?.desc || "Beacon mesh coordination"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `flex items-center gap-1.5 ${themeConfig.textSecondary}`,
							children: [
								!activeDirectUser && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setRoomMapFocusCoords(null);
										setShowRoomMap(true);
									},
									className: "px-2.5 py-1 rounded-xl bg-emerald-600/25 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-emerald-500/40 active:scale-95",
									title: `Open Room Map showing users in ${activeRoomObj?.name || "this room"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Map" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: handleShareCurrentLocation,
									className: "px-2.5 py-1 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-cyan-500/30",
									title: "Broadcast your live GPS coordinates to this channel",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "hidden md:inline",
										children: "Share Location"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowSearch(!showSearch),
									className: `p-2 hover:bg-white/10 hover:${themeConfig.textPrimary} rounded-xl transition-colors cursor-pointer`,
									title: "Search Messages",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-4 h-4" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowMemberList(!showMemberList),
									className: `p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer ${showMemberList ? `${themeConfig.accentBg} text-white` : `hover:${themeConfig.textPrimary}`}`,
									title: "Toggle Member List",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4" })
								})
							]
						})]
					}),
					showSearch && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `px-4 py-2 ${themeConfig.glassCard} border-b ${themeConfig.glassBorder} flex items-center gap-2`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: `w-4 h-4 ${themeConfig.textSecondary}` }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "Search conversation...",
								value: searchQuery,
								onChange: (e) => setSearchQuery(e.target.value),
								className: `flex-1 bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400`
							}),
							searchQuery && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setSearchQuery(""),
								className: `${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `pt-6 pb-4 border-b ${themeConfig.glassBorder} mb-2`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `w-12 h-12 rounded-2xl ${themeConfig.glassCard} flex items-center justify-center mb-2 border ${themeConfig.glassBorder}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hash, { className: "w-7 h-7 text-cyan-400" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: `text-xl font-bold ${themeConfig.textPrimary} tracking-tight`,
										children: [
											"Welcome to #",
											activeChannelId,
											"!"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: `text-xs ${themeConfig.textSecondary} mt-1`,
										children: [
											"This is the start of the #",
											activeChannelId,
											" channel on Beacon Mesh. Send coordinate updates, voice notes, and stay connected with everyone."
										]
									})
								]
							}),
							displayMessages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `py-8 text-center ${themeConfig.textSecondary} text-xs`,
								children: "No messages yet in this channel. Send the first message or share your live location!"
							}) : displayMessages.map((msg) => {
								const isMe = msg.isSelf || msg.senderId === user?.id || user?.fullName && (msg.senderName === user.fullName || msg.sender === user.fullName);
								const isEditing = editingMessageId === msg.id;
								const msgMember = roomDetails?.members?.find((m) => m.userId === msg.senderId);
								const senderDisplayName = msg.sender || msg.senderName || (isMe ? user?.fullName || "Reddy" : "Peer Node");
								const roleToDisplay = msg.role || (isMe ? "ADMIN" : msgMember?.role);
								const formattedTime = msg.timestamp || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit"
								}) : (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit"
								}));
								const avatarSrc = msg.senderAvatar || (isMe ? user?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80" : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80");
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "group relative flex gap-3.5 hover:bg-white/5 -mx-4 px-4 py-1.5 rounded-xl transition-colors",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `absolute right-4 -top-3 hidden group-hover:flex items-center gap-1 ${themeConfig.glassPanel} border ${themeConfig.glassBorder} rounded-xl shadow-lg px-1.5 py-0.5 z-20 backdrop-blur-xl`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => sendReaction(msg.id, "👍"),
													className: "p-1 hover:bg-white/10 text-xs rounded transition-colors cursor-pointer",
													title: "React 👍",
													children: "👍"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => sendReaction(msg.id, "❤️"),
													className: "p-1 hover:bg-white/10 text-xs rounded transition-colors cursor-pointer",
													title: "React ❤️",
													children: "❤️"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => sendReaction(msg.id, "📍"),
													className: "p-1 hover:bg-white/10 text-xs rounded transition-colors cursor-pointer",
													title: "React 📍",
													children: "📍"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setReplyTarget(msg),
													className: `p-1 hover:bg-white/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded transition-colors cursor-pointer`,
													title: "Reply",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reply, { className: "w-3.5 h-3.5" })
												}),
												isMe && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => {
														setEditingMessageId(msg.id);
														setEditingText(msg.text);
													},
													className: `p-1 hover:bg-white/10 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded transition-colors cursor-pointer`,
													title: "Edit",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pen, { className: "w-3.5 h-3.5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => {
														deleteMessage(msg.id);
														setChannelMessages((prev) => ({
															...prev,
															[activeChannelId]: (prev[activeChannelId] || []).filter((m) => m.id !== msg.id)
														}));
													},
													className: "p-1 hover:bg-rose-500/20 text-rose-400 rounded transition-colors cursor-pointer",
													title: "Delete",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
												})] })
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: avatarSrc,
											alt: senderDisplayName,
											className: `w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-90 transition-opacity border ${themeConfig.glassBorder}`,
											onClick: () => {
												const peerUser = roomDetails?.members?.find((m) => m.userId === msg.senderId)?.user;
												if (peerUser) setSelectedProfileUser(peerUser);
											}
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 min-w-0",
											children: [
												msg.replyToText && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: `flex items-center gap-1.5 text-xs ${themeConfig.textSecondary} mb-1 opacity-80`,
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `w-3 h-3 border-l-2 border-t-2 ${themeConfig.glassBorder} rounded-tl-sm -mb-2` }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: `font-bold ${themeConfig.textPrimary} text-[11px] truncate`,
															children: ["@", msg.replyToSender]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "truncate text-[11px] italic",
															children: msg.replyToText
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-baseline gap-2 mb-0.5",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: `text-sm font-bold cursor-pointer hover:underline ${roleToDisplay === "OWNER" ? "text-amber-400" : roleToDisplay === "ADMIN" ? themeConfig.accentText : themeConfig.textPrimary}`,
															onClick: () => {
																const peerUser = roomDetails?.members?.find((m) => m.userId === msg.senderId)?.user;
																if (peerUser) setSelectedProfileUser(peerUser);
															},
															children: senderDisplayName
														}),
														renderRoleBadge(roleToDisplay),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: `text-[10px] ${themeConfig.textSecondary}`,
															children: formattedTime
														}),
														msg.isEdited && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: `text-[10px] ${themeConfig.textSecondary}`,
															children: "(edited)"
														})
													]
												}),
												isEditing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-1 flex items-center gap-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: editingText,
															onChange: (e) => setEditingText(e.target.value),
															className: `flex-1 ${themeConfig.glassInput} text-white px-3 py-1.5 rounded-xl text-sm focus:outline-none border ${themeConfig.glassBorder}`
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => {
																editMessage(msg.id, editingText);
																setEditingMessageId(null);
															},
															className: `p-1.5 ${themeConfig.accentBg} text-white rounded-xl shadow-sm transition-colors`,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" })
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => setEditingMessageId(null),
															className: "p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
														})
													]
												}) : renderDiscordMarkdown(msg.text),
												msg.attachments && msg.attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-2 space-y-2",
													children: msg.attachments.map((att) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [att.type === "voice" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: `flex items-center gap-3 p-2.5 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} max-w-sm`,
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileAudio, { className: `w-6 h-6 ${themeConfig.accentText} shrink-0` }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
																controls: true,
																src: att.url,
																className: "h-8 flex-1"
															}),
															att.duration && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: `text-[10px] ${themeConfig.textSecondary} font-mono`,
																children: [att.duration, "s"]
															})
														]
													}), att.type === "image" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
														src: att.url,
														alt: "Attachment",
														className: `max-h-72 rounded-2xl object-cover cursor-pointer hover:opacity-95 border ${themeConfig.glassBorder} shadow-lg`,
														onClick: () => window.open(att.url, "_blank")
													})] }, att.id))
												}),
												msg.reactions && Object.keys(msg.reactions).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "flex flex-wrap gap-1 mt-1.5",
													children: Object.entries(msg.reactions).map(([emoji, rawUserIds]) => {
														const userIds = Array.isArray(rawUserIds) ? rawUserIds : [];
														const hasReacted = userIds.includes(user?.id || "");
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															onClick: () => sendReaction(msg.id, emoji),
															className: `px-2 py-0.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${hasReacted ? `${themeConfig.accentBg} text-white shadow-sm font-semibold` : `${themeConfig.glassCard} border ${themeConfig.glassBorder} ${themeConfig.textPrimary} hover:bg-white/10`}`,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: emoji }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[11px] font-semibold",
																children: userIds.length
															})]
														}, emoji);
													})
												})
											]
										})
									]
								}, msg.id);
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: messagesEndRef })
						]
					}),
					replyTarget && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `px-4 py-2 ${themeConfig.glassCard} border-t ${themeConfig.glassBorder} flex items-center justify-between text-xs`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 truncate",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: themeConfig.textSecondary,
									children: "Replying to"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `font-bold ${themeConfig.textPrimary}`,
									children: [
										"@",
										replyTarget.senderName,
										":"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `truncate ${themeConfig.textSecondary}`,
									children: replyTarget.text
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setReplyTarget(null),
							className: `p-1 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
						})]
					}),
					voicePreview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `px-4 py-2.5 ${themeConfig.glassCard} border-t ${themeConfig.glassBorder} flex items-center justify-between backdrop-blur-xl`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `w-8 h-8 rounded-full ${themeConfig.accentBg} text-white flex items-center justify-center shadow`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "w-4 h-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: `text-xs font-bold ${themeConfig.textPrimary}`,
								children: [
									"Recorded Audio Message (",
									voicePreview.duration,
									"s)"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
								controls: true,
								src: voicePreview.dataUrl,
								className: "h-6 mt-1"
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: cancelRecording,
								className: `px-3 py-1.5 text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} rounded-lg hover:bg-white/10`,
								children: "Discard"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleSendVoiceNote,
								disabled: isUploading,
								className: `px-3.5 py-1.5 text-xs ${themeConfig.accentBg} text-white font-bold rounded-xl shadow-sm`,
								children: isUploading ? "Uploading..." : "Send Voice"
							})]
						})]
					}),
					isRecording && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `px-4 py-2.5 ${themeConfig.glassPanel} border-t ${themeConfig.glassBorder} flex items-center justify-between gap-3 text-white backdrop-blur-2xl`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "relative flex h-3 w-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex rounded-full h-3 w-3 bg-rose-500" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs font-mono font-bold tabular-nums text-rose-300",
									children: [
										Math.floor(recordingSeconds / 60),
										":",
										(recordingSeconds % 60).toString().padStart(2, "0")
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 flex justify-center max-w-xs",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudioWaveformVisualizer, {
									analyser: voiceRecorderRef.current?.getAnalyser() || null,
									height: 28
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: cancelRecording,
									className: `px-3 py-1 text-xs ${themeConfig.textSecondary} hover:${themeConfig.textPrimary}`,
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: stopRecording,
									className: "px-3.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm",
									children: "Done"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 min-h-6 py-0.5 text-xs flex items-center",
						children: currentTyping && currentTyping.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 shadow-sm animate-pulse",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce",
										style: { animationDelay: "0ms" }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce",
										style: { animationDelay: "150ms" }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce",
										style: { animationDelay: "300ms" }
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] font-medium tracking-wide",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
									className: "text-white font-semibold",
									children: currentTyping.name || "User"
								}), " is typing..."]
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 sm:px-4 pb-3 md:pb-4 pt-1.5 shrink-0 z-20",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `relative ${themeConfig.glassInput} rounded-2xl flex items-center px-3 py-2 shadow-lg border ${themeConfig.glassBorder}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "file",
									ref: fileInputRef,
									onChange: handleImageUpload,
									accept: "image/*",
									className: "hidden"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setShowPlusMenu(!showPlusMenu),
										className: `w-8 h-8 rounded-xl bg-white/10 hover:${themeConfig.accentBg} flex items-center justify-center text-white transition-colors cursor-pointer mr-2 shrink-0`,
										title: "Add attachment or location",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" })
									}), showPlusMenu && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `absolute bottom-12 left-0 ${themeConfig.glassPanel} border ${themeConfig.glassBorder} rounded-2xl shadow-2xl p-2 w-56 z-50 space-y-1 backdrop-blur-2xl`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => {
													fileInputRef.current?.click();
													setShowPlusMenu(false);
												},
												className: `w-full px-3 py-2 text-xs font-semibold ${themeConfig.textPrimary} hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, { className: "w-4 h-4 text-cyan-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Upload Image" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: handleShareCurrentLocation,
												className: `w-full px-3 py-2 text-xs font-semibold ${themeConfig.textPrimary} hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Broadcast Live GPS" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => {
													startRecording();
													setShowPlusMenu(false);
												},
												className: `w-full px-3 py-2 text-xs font-semibold ${themeConfig.textPrimary} hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "w-4 h-4 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Record Voice Note" })]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: activeDirectUser ? `Message @${activeDirectUser.name}...` : `Message #${activeChannelId}...`,
									value: inputVal,
									onChange: handleInputChange,
									onKeyDown: (e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleSendMessage();
										}
									},
									className: `flex-1 bg-transparent text-sm ${themeConfig.textPrimary} placeholder-slate-400 focus:outline-none min-w-0 pr-2`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 shrink-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: startRecording,
											className: `p-2 text-slate-400 hover:${themeConfig.textPrimary} hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden sm:flex items-center justify-center`,
											title: "Voice Note",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "w-4 h-4" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setShowEmojiPicker(!showEmojiPicker),
											className: `p-2 text-slate-400 hover:${themeConfig.textPrimary} hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden sm:flex items-center justify-center`,
											title: "Add Emoji",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smile, { className: "w-4 h-4" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => handleSendMessage(),
											disabled: !inputVal.trim() && !voicePreview,
											"aria-label": "Send Message",
											className: `h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-150 shrink-0 font-medium text-xs cursor-pointer shadow-md ${inputVal.trim() || voicePreview ? "bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-500 hover:opacity-95 text-white shadow-sky-500/30 active:scale-95" : "bg-white/10 text-white/40 cursor-not-allowed hover:bg-white/15"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "hidden sm:inline font-semibold",
												children: "Send"
											})]
										})
									]
								}),
								showEmojiPicker && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `absolute bottom-14 right-0 ${themeConfig.glassPanel} border ${themeConfig.glassBorder} rounded-2xl shadow-2xl p-2 z-50 flex gap-1 backdrop-blur-2xl`,
									children: QUICK_EMOJIS.map((em) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => {
											setInputVal((prev) => prev + em);
											setShowEmojiPicker(false);
										},
										className: "p-1.5 hover:bg-white/10 rounded-lg text-base cursor-pointer",
										children: em
									}, em))
								})
							]
						})
					})
				]
			}),
			showMemberList && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `w-60 ${themeConfig.glassPanel} border-l ${themeConfig.glassBorder} flex flex-col shrink-0 hidden lg:flex backdrop-blur-2xl`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `h-12 px-4 border-b ${themeConfig.glassBorder} flex items-center justify-between text-xs font-bold uppercase tracking-wider ${themeConfig.textSecondary}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Channel Roster" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[10px] font-mono",
						children: [roomDetails?.members?.length || 1, " members"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto px-2 py-3 space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `px-2 text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider block mb-1`,
						children: [
							"Online —",
							" ",
							roomDetails?.members?.filter((m) => onlineUserIds.includes(m.userId) || m.userId === user?.id).length || 1
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-0.5",
						children: roomDetails?.members?.filter((m) => onlineUserIds.includes(m.userId) || m.userId === user?.id).map((mem) => {
							const peerLoc = userLocations.find((l) => l.userId === mem.userId);
							let distText = "";
							if (myLocation && peerLoc && mem.userId !== user?.id) {
								const m = calculateDistanceMeters(myLocation.latitude, myLocation.longitude, peerLoc.latitude, peerLoc.longitude);
								distText = formatDistance(m);
							}
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSelectedProfileUser(mem.user),
								className: "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-left group cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: mem.user.avatarUrl,
										alt: "",
										className: `w-8 h-8 rounded-full object-cover border ${themeConfig.glassBorder}`
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "truncate flex-1 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center gap-1.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `text-xs font-bold truncate ${mem.role === "OWNER" ? "text-amber-400" : mem.role === "ADMIN" ? themeConfig.accentText : themeConfig.textPrimary}`,
											children: mem.user.fullName
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `text-[10px] ${themeConfig.textSecondary} block truncate`,
										children: distText ? `📍 ${distText} away` : `@${mem.user.username}`
									})]
								})]
							}, mem.userId);
						})
					})] }), roomDetails?.members?.some((m) => !onlineUserIds.includes(m.userId) && m.userId !== user?.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `px-2 text-[11px] font-bold ${themeConfig.textSecondary} uppercase tracking-wider block mb-1`,
						children: "Offline"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-0.5 opacity-60",
						children: roomDetails?.members?.filter((m) => !onlineUserIds.includes(m.userId) && m.userId !== user?.id).map((mem) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setSelectedProfileUser(mem.user),
							className: "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-left cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: mem.user.avatarUrl,
									alt: "",
									className: "w-8 h-8 rounded-full object-cover grayscale"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-900" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "truncate flex-1 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-xs font-semibold ${themeConfig.textSecondary} truncate block`,
									children: mem.user.fullName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] opacity-60 block truncate",
									children: ["@", mem.user.username]
								})]
							})]
						}, mem.userId))
					})] })]
				})]
			}),
			selectedProfileUser && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `${themeConfig.glassPanel} rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border ${themeConfig.glassBorder} animate-in fade-in duration-200 backdrop-blur-2xl`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-24 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 relative",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setSelectedProfileUser(null),
							className: "absolute top-3 right-3 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-5 pb-5 pt-0 relative",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative -mt-12 mb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: selectedProfileUser.avatarUrl,
									alt: "",
									className: `w-20 h-20 rounded-full object-cover border-4 border-slate-900 shadow-lg`
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute bottom-1 left-15 w-4 h-4 rounded-full border-2 border-slate-900 ${onlineUserIds.includes(selectedProfileUser.id) ? "bg-emerald-400" : "bg-slate-500"}` })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: `text-lg font-bold ${themeConfig.textPrimary}`,
								children: selectedProfileUser.fullName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: `text-xs ${themeConfig.textSecondary}`,
								children: ["@", selectedProfileUser.username]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `mt-3 p-3 rounded-2xl ${themeConfig.glassCard} text-xs ${themeConfig.textPrimary} border ${themeConfig.glassBorder}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: `font-semibold text-[11px] ${themeConfig.textSecondary} uppercase tracking-wider mb-1`,
									children: "About Me"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: selectedProfileUser.about || "Beacon Mesh Explorer" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 flex gap-2",
								children: selectedProfileUser.id !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											onSelectChatUser?.({
												id: selectedProfileUser.id,
												name: selectedProfileUser.fullName,
												avatar: selectedProfileUser.avatarUrl
											});
											setActiveDirectUser({
												id: selectedProfileUser.id,
												name: selectedProfileUser.fullName,
												avatar: selectedProfileUser.avatarUrl
											});
											setSelectedProfileUser(null);
										},
										className: `flex-1 py-2 px-3 ${themeConfig.accentBg} text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Message" })]
									}),
									selectedProfileUser.phoneNumber && selectedProfileUser.privacy?.phoneVisibility !== "nobody" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: `tel:${selectedProfileUser.phoneNumber}`,
										className: "p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow",
										title: "Call Phone",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "w-4 h-4" })
									}),
									userLocations.some((l) => l.userId === selectedProfileUser.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => {
											const peerLoc = userLocations.find((l) => l.userId === selectedProfileUser.id);
											if (peerLoc && onFocusMapLocation) {
												onFocusMapLocation(peerLoc.latitude, peerLoc.longitude);
												setSelectedProfileUser(null);
											}
										},
										className: "p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center shadow cursor-pointer",
										title: "Focus on Map",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-4 h-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: async () => {
											if (confirm(`Block ${selectedProfileUser.fullName}? They will not be able to message you or track your location.`)) try {
												await api.blockUser(selectedProfileUser.id);
												toast.success(`Blocked ${selectedProfileUser.fullName}`);
												setSelectedProfileUser(null);
											} catch (err) {
												toast.error(err.message || "Failed to block user");
											}
										},
										className: "p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl flex items-center justify-center shadow cursor-pointer transition-colors",
										title: `Block ${selectedProfileUser.fullName}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserX, { className: "w-4 h-4" })
									})
								] })
							})
						]
					})]
				})
			}),
			showRoomMap && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in duration-150",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveMap, {
					isActive: showRoomMap,
					roomOnlyMode: true,
					activeRoomDetails: roomDetails || activeRoomObj || null,
					onCloseRoomMap: () => setShowRoomMap(false),
					focusCoords: roomMapFocusCoords,
					savedPlaces,
					onRefreshSavedPlaces,
					rooms: userRooms,
					selectedRoomId: effectiveRoomId || activeRoomId,
					onSelectUserForChat: (targetUserId) => {
						setShowRoomMap(false);
						const peerLoc = userLocations.find((l) => l.userId === targetUserId);
						const mem = roomDetails?.members?.find((m) => m.userId === targetUserId)?.user;
						const name = mem?.fullName || peerLoc?.fullName || "Peer";
						const avatar = mem?.avatarUrl || peerLoc?.avatarUrl || "";
						onSelectChatUser?.({
							id: targetUserId,
							name,
							avatar
						});
						setActiveDirectUser({
							id: targetUserId,
							name,
							avatar
						});
					},
					onAddPlaceAtCoords: (lat, lng) => {
						setShowRoomMap(false);
						onAddPlaceAtCoords?.(lat, lng);
					},
					onSetReminderAtCoords: (lat, lng, title) => {
						setShowRoomMap(false);
						onSetReminderAtCoords?.(lat, lng, title);
					}
				})
			})
		]
	});
};
export { ChatView };
