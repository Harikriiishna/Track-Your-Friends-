import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { B as Phone, H as PhoneCall, Jt as Bell, Q as MessageSquare, R as Plus, Tt as EyeOff, V as PhoneOff, X as Mic, Xt as BellOff, Y as Minimize2, Yt as BellRing, Z as MicOff, at as Lock, b as SlidersHorizontal, c as Users, dt as KeyRound, en as require_react, et as Maximize2, it as LogOut, j as Search, jt as Compass, n as X, nt as MapPin, o as Volume2, tt as Map$1, u as UserX, vt as Globe, wt as Eye } from "./vendor-icons-PxteBMrr.js";
import { E as calculateDistanceMeters, O as formatDistance, a as api, i as useAuth, n as useToast, o as localBackend } from "./ToastContext-ziKLJ15f.js";
import { d as useRealtime, f as notifications, m as sound, t as LiveMap, u as useTheme } from "./index-Beu_4vAP.js";
// src/components/Rooms/RoomsManager.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var RoomsManager = ({ isActive = true, onSelectRoom, selectedRoomId, savedPlaces = [], onRefreshSavedPlaces, onSelectUserForChat, onOpenChat, onFocusMapLocation, onAddPlaceAtCoords, onSetReminderAtCoords }) => {
	const { user, logout } = useAuth();
	const { themeConfig } = useTheme();
	const { myLocation, userLocations, onlineUserIds, activeVoiceRoomId, isVoiceConnected, isMicMuted, isSpeaking, voiceParticipants, joinVoiceChannel, leaveVoiceChannel, toggleMicMute, sendMessage } = useRealtime();
	const toast = useToast();
	const [rooms, setRooms] = (0, import_react.useState)([]);
	const [activeRoomDetails, setActiveRoomDetails] = (0, import_react.useState)(null);
	const [showCreateModal, setShowCreateModal] = (0, import_react.useState)(false);
	const [showJoinModal, setShowJoinModal] = (0, import_react.useState)(false);
	const [showRoomMap, setShowRoomMap] = (0, import_react.useState)(true);
	const [isRoomMapFullscreen, setIsRoomMapFullscreen] = (0, import_react.useState)(false);
	const [roomMapFocusCoords, setRoomMapFocusCoords] = (0, import_react.useState)(null);
	const roomMapPanelRef = import_react.useRef(null);
	const [isLoading, setIsLoading] = (0, import_react.useState)(true);
	const [quickHubMessage, setQuickHubMessage] = (0, import_react.useState)("");
	const storageKey = `beacon_member_geofence_alerts_${user?.id || "default"}`;
	const [memberGeofenceAlerts, setMemberGeofenceAlerts] = (0, import_react.useState)(() => {
		try {
			const raw = localStorage.getItem(`beacon_member_geofence_alerts_${user?.id || "default"}`);
			return raw ? JSON.parse(raw) : {};
		} catch {
			return {};
		}
	});
	const [expandedGeofenceMemberId, setExpandedGeofenceMemberId] = (0, import_react.useState)(null);
	const [geofenceEvents, setGeofenceEvents] = (0, import_react.useState)([]);
	const memberInsideGeofenceRef = import_react.useRef({});
	(0, import_react.useEffect)(() => {
		try {
			const raw = localStorage.getItem(storageKey);
			if (raw) setMemberGeofenceAlerts(JSON.parse(raw));
		} catch {}
	}, [storageKey]);
	const saveMemberGeofenceAlerts = import_react.useCallback((updater) => {
		setMemberGeofenceAlerts((prev) => {
			const next = updater(prev);
			try {
				localStorage.setItem(storageKey, JSON.stringify(next));
			} catch {}
			return next;
		});
	}, [storageKey]);
	const getMemberAlertConfig = import_react.useCallback((targetUserId) => {
		return memberGeofenceAlerts[targetUserId] || {
			enabled: false,
			notifyOnEnter: true,
			notifyOnLeave: true,
			placeIds: []
		};
	}, [memberGeofenceAlerts]);
	const handleToggleMemberGeofenceAlert = import_react.useCallback(async (targetUserId, memberName) => {
		const current = getMemberAlertConfig(targetUserId);
		const nextEnabled = !current.enabled;
		if (nextEnabled && notifications.isSupported() && notifications.getPermission() === "default") await notifications.requestPermission();
		const peerLoc = userLocations.find((l) => l.userId === targetUserId);
		const currentlyInsidePlaces = [];
		if (peerLoc && savedPlaces.length > 0) savedPlaces.forEach((place) => {
			const isInside = calculateDistanceMeters(peerLoc.latitude, peerLoc.longitude, place.latitude, place.longitude) <= (place.radiusMeters || 150);
			memberInsideGeofenceRef.current[`${targetUserId}::${place.id}`] = isInside;
			if (isInside) currentlyInsidePlaces.push(place.name);
		});
		saveMemberGeofenceAlerts((prev) => ({
			...prev,
			[targetUserId]: {
				...current,
				enabled: nextEnabled
			}
		}));
		sound.playChime();
		if (nextEnabled) {
			if (savedPlaces.length === 0) toast.info(`Geofence alerts enabled for ${memberName}. Add a Saved Place in the Wishlist/Saved tab to monitor boundaries.`);
			else if (currentlyInsidePlaces.length > 0) toast.success(`Geofence alerts ON for ${memberName} (currently inside ${currentlyInsidePlaces.join(", ")})`);
			else toast.success(`Geofence alerts ON for ${memberName} across ${current.placeIds.length > 0 ? current.placeIds.length : savedPlaces.length} saved location${savedPlaces.length === 1 ? "" : "s"}`);
		} else toast.info(`Geofence alerts muted for ${memberName}`);
	}, [
		getMemberAlertConfig,
		saveMemberGeofenceAlerts,
		userLocations,
		savedPlaces,
		toast
	]);
	const handleUpdateMemberGeofenceConfig = import_react.useCallback((targetUserId, patch) => {
		saveMemberGeofenceAlerts((prev) => {
			const base = prev[targetUserId] || {
				enabled: true,
				notifyOnEnter: true,
				notifyOnLeave: true,
				placeIds: []
			};
			return {
				...prev,
				[targetUserId]: {
					...base,
					...patch
				}
			};
		});
	}, [saveMemberGeofenceAlerts]);
	const handleToggleMemberWatchedPlace = import_react.useCallback((targetUserId, placeId) => {
		const cfg = getMemberAlertConfig(targetUserId);
		const nextPlaceIds = cfg.placeIds.includes(placeId) ? cfg.placeIds.filter((id) => id !== placeId) : [...cfg.placeIds, placeId];
		handleUpdateMemberGeofenceConfig(targetUserId, { placeIds: nextPlaceIds });
	}, [getMemberAlertConfig, handleUpdateMemberGeofenceConfig]);
	(0, import_react.useEffect)(() => {
		if (!savedPlaces || savedPlaces.length === 0 || userLocations.length === 0) return;
		userLocations.forEach((peerLoc) => {
			if (peerLoc.userId === user?.id) return;
			const cfg = memberGeofenceAlerts[peerLoc.userId];
			if (!cfg || !cfg.enabled) return;
			const memberName = (activeRoomDetails?.members?.find((m) => m.userId === peerLoc.userId))?.user?.fullName || peerLoc.fullName || peerLoc.username || "Group Member";
			(cfg.placeIds && cfg.placeIds.length > 0 ? savedPlaces.filter((p) => cfg.placeIds.includes(p.id)) : savedPlaces).forEach((place) => {
				const dist = calculateDistanceMeters(peerLoc.latitude, peerLoc.longitude, place.latitude, place.longitude);
				const isInside = dist <= (place.radiusMeters || 150);
				const stateKey = `${peerLoc.userId}::${place.id}`;
				const wasInside = memberInsideGeofenceRef.current[stateKey];
				if (wasInside === void 0) {
					memberInsideGeofenceRef.current[stateKey] = isInside;
					return;
				}
				if (!wasInside && isInside) {
					memberInsideGeofenceRef.current[stateKey] = true;
					if (cfg.notifyOnEnter) {
						sound.playChime();
						toast.success(`📍 Geofence Alert: ${memberName} entered "${place.name}" (${Math.round(dist)}m)`);
						notifications.notifyMemberGeofence(memberName, "entered", place.name, dist);
						setGeofenceEvents((prev) => [{
							id: `${Date.now()}-${peerLoc.userId}-${place.id}-enter`,
							userId: peerLoc.userId,
							memberName,
							placeId: place.id,
							placeName: place.name,
							action: "entered",
							distanceMeters: Math.round(dist),
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						}, ...prev.slice(0, 19)]);
					}
				} else if (wasInside && !isInside) {
					memberInsideGeofenceRef.current[stateKey] = false;
					if (cfg.notifyOnLeave) {
						sound.playChime();
						toast.info(`🚶 Geofence Alert: ${memberName} left "${place.name}" (${Math.round(dist)}m)`);
						notifications.notifyMemberGeofence(memberName, "left", place.name, dist);
						setGeofenceEvents((prev) => [{
							id: `${Date.now()}-${peerLoc.userId}-${place.id}-leave`,
							userId: peerLoc.userId,
							memberName,
							placeId: place.id,
							placeName: place.name,
							action: "left",
							distanceMeters: Math.round(dist),
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						}, ...prev.slice(0, 19)]);
					}
				}
			});
		});
	}, [
		userLocations,
		savedPlaces,
		memberGeofenceAlerts,
		activeRoomDetails,
		user?.id,
		toast
	]);
	const [newRoomName, setNewRoomName] = (0, import_react.useState)("");
	const [newRoomDesc, setNewRoomDesc] = (0, import_react.useState)("");
	const [newRoomPassword, setNewRoomPassword] = (0, import_react.useState)("");
	const [joinRoomId, setJoinRoomId] = (0, import_react.useState)("");
	const [joinPassword, setJoinPassword] = (0, import_react.useState)("");
	const [errorMsg, setErrorMsg] = (0, import_react.useState)(null);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [searchCategory, setSearchCategory] = (0, import_react.useState)("all");
	const filteredRooms = import_react.useMemo(() => {
		if (!searchQuery.trim()) return rooms;
		const q = searchQuery.toLowerCase().trim();
		return rooms.filter((r) => r.name.toLowerCase().includes(q) || r.description && r.description.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
	}, [rooms, searchQuery]);
	const filteredMembers = import_react.useMemo(() => {
		if (!searchQuery.trim()) return [];
		const q = searchQuery.toLowerCase().trim();
		const memberMap = /* @__PURE__ */ new Map();
		if (activeRoomDetails?.members) activeRoomDetails.members.forEach((m) => {
			const u = m.user;
			const name = u?.fullName || "";
			const uname = u?.username || "";
			if (name.toLowerCase().includes(q) || uname.toLowerCase().includes(q) || m.role && m.role.toLowerCase().includes(q)) {
				const loc = userLocations.find((l) => l.userId === m.userId);
				memberMap.set(m.userId, {
					userId: m.userId,
					fullName: name || "Member",
					username: uname || m.userId.slice(0, 6),
					avatarUrl: u?.avatarUrl,
					role: m.role,
					roomId: activeRoomDetails.id,
					roomName: activeRoomDetails.name,
					isOnline: onlineUserIds.includes(m.userId),
					latitude: loc?.latitude,
					longitude: loc?.longitude
				});
			}
		});
		userLocations.forEach((loc) => {
			if (loc.fullName.toLowerCase().includes(q) || loc.username.toLowerCase().includes(q)) {
				if (!memberMap.has(loc.userId)) memberMap.set(loc.userId, {
					userId: loc.userId,
					fullName: loc.fullName,
					username: loc.username,
					avatarUrl: loc.avatarUrl,
					isOnline: onlineUserIds.includes(loc.userId),
					latitude: loc.latitude,
					longitude: loc.longitude
				});
			}
		});
		if (user && (user.fullName.toLowerCase().includes(q) || user.username.toLowerCase().includes(q))) {
			if (!memberMap.has(user.id)) memberMap.set(user.id, {
				userId: user.id,
				fullName: `${user.fullName} (You)`,
				username: user.username,
				avatarUrl: user.avatarUrl,
				role: "SELF",
				isOnline: true,
				latitude: myLocation?.latitude,
				longitude: myLocation?.longitude
			});
		}
		return Array.from(memberMap.values());
	}, [
		searchQuery,
		activeRoomDetails,
		userLocations,
		onlineUserIds,
		user,
		myLocation
	]);
	const loadRooms = import_react.useCallback(async (showSpinner = false) => {
		if (!user?.id) return;
		try {
			if (showSpinner) setIsLoading(true);
			const res = await api.get("/api/rooms");
			if (Array.isArray(res?.rooms)) {
				setRooms((prev) => {
					return prev.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join("|") === res.rooms.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join("|") ? prev : res.rooms;
				});
				if (!selectedRoomId && res.rooms.length > 0) {
					const customRoom = res.rooms.find((r) => r.id !== "room-universal");
					onSelectRoom(customRoom ? customRoom.id : res.rooms[0].id);
				}
			}
		} catch (err) {
			console.warn("Could not load rooms from backend, using cached rooms:", err);
			const fallbackRooms = localBackend.getUserRooms(user.id);
			if (fallbackRooms.length > 0) {
				setRooms((prev) => prev.length > 0 ? prev : fallbackRooms);
				if (!selectedRoomId) {
					const customRoom = fallbackRooms.find((r) => r.id !== "room-universal");
					onSelectRoom(customRoom ? customRoom.id : fallbackRooms[0].id);
				}
			}
		} finally {
			if (showSpinner) setIsLoading(false);
		}
	}, [
		user?.id,
		selectedRoomId,
		onSelectRoom
	]);
	(0, import_react.useEffect)(() => {
		loadRooms(true);
		const onSync = () => {
			loadRooms(false);
		};
		window.addEventListener("beacon:cloud-sync-updated", onSync);
		return () => {
			window.removeEventListener("beacon:cloud-sync-updated", onSync);
		};
	}, [loadRooms]);
	(0, import_react.useEffect)(() => {
		if (!selectedRoomId) {
			setActiveRoomDetails(null);
			return;
		}
		let mounted = true;
		async function loadDetails() {
			try {
				const res = await api.get(`/api/rooms/${selectedRoomId}`);
				if (!mounted || !res?.room) return;
				setActiveRoomDetails((prev) => {
					if (!prev || prev.id !== res.room.id) return res.room;
					const prevMemSig = (prev.members || []).map((m) => `${m.userId}:${m.role}`).join("|");
					const nextMemSig = (res.room.members || []).map((m) => `${m.userId}:${m.role}`).join("|");
					if (prev.name === res.room.name && prev.description === res.room.description && prev.memberCount === res.room.memberCount && prevMemSig === nextMemSig) return prev;
					return res.room;
				});
			} catch (err) {
				if (!mounted) return;
				if (selectedRoomId === "room-universal") setActiveRoomDetails((prev) => prev?.id === "room-universal" ? prev : {
					id: "room-universal",
					name: "🌐 Universal Lounge",
					description: "The open global town square for everyone on Beacon. Coordinate live locations, chat across channels, and meet members worldwide.",
					ownerId: "system",
					hasPassword: false,
					createdAt: "2026-01-01T00:00:00.000Z",
					memberCount: 1,
					isPrivate: false,
					isUniversal: true,
					members: []
				});
			}
		}
		loadDetails();
		window.addEventListener("beacon:cloud-sync-updated", loadDetails);
		return () => {
			mounted = false;
			window.removeEventListener("beacon:cloud-sync-updated", loadDetails);
		};
	}, [selectedRoomId]);
	const handleCreateRoom = async (e) => {
		e.preventDefault();
		setErrorMsg(null);
		try {
			const res = await api.post("/api/rooms", {
				name: newRoomName,
				description: newRoomDesc,
				password: newRoomPassword
			});
			setRooms((prev) => prev.some((r) => r.id === res.room.id) ? prev : [...prev, res.room]);
			setActiveRoomDetails(res.room);
			onSelectRoom(res.room.id);
			setShowCreateModal(false);
			setNewRoomName("");
			setNewRoomDesc("");
			setNewRoomPassword("");
			toast.success(`Room "${res.room.name}" created — you are now inside`);
		} catch (err) {
			setErrorMsg(err.message || "Failed to create room");
			toast.error(err.message || "Failed to create room");
		}
	};
	const handleJoinRoom = async (e) => {
		e.preventDefault();
		setErrorMsg(null);
		try {
			const res = await api.post("/api/rooms/join", {
				roomId: joinRoomId,
				password: joinPassword
			});
			setRooms((prev) => prev.some((r) => r.id === res.room.id) ? prev.map((r) => r.id === res.room.id ? res.room : r) : [...prev, res.room]);
			setActiveRoomDetails(res.room);
			onSelectRoom(res.room.id);
			setShowJoinModal(false);
			setJoinRoomId("");
			setJoinPassword("");
			toast.success(`Joined "${res.room.name}" — you will stay in this room until you press Leave`);
		} catch (err) {
			setErrorMsg(err.message || "Failed to join room");
			toast.error(err.message || "Failed to join room");
		}
	};
	const handleLeaveRoom = async (roomId) => {
		try {
			await api.post(`/api/rooms/${roomId}/leave`);
			const remaining = rooms.filter((r) => r.id !== roomId);
			setRooms(remaining);
			if (selectedRoomId === roomId) {
				const nextRoom = remaining.find((r) => r.id !== "room-universal") || remaining[0];
				onSelectRoom(nextRoom ? nextRoom.id : "room-universal");
			}
			toast.success("You left the room");
		} catch (err) {
			toast.error(err.message || "Failed to leave room");
		}
	};
	const handleChangeRole = async (targetUserId, newRole) => {
		if (!selectedRoomId) return;
		try {
			await api.post(`/api/rooms/${selectedRoomId}/roles`, {
				targetUserId,
				newRole
			});
			const res = await api.get(`/api/rooms/${selectedRoomId}`);
			setActiveRoomDetails(res.room);
			toast.success(`Role updated to ${newRole}`);
		} catch (err) {
			toast.error(err.message || "Failed to change role");
		}
	};
	const handleKickMember = async (targetUserId, memberName) => {
		if (!selectedRoomId) return;
		if (!confirm(`Are you sure you want to remove ${memberName} from this room?`)) return;
		try {
			await api.kickRoomMember(selectedRoomId, targetUserId);
			const res = await api.get(`/api/rooms/${selectedRoomId}`);
			setActiveRoomDetails(res.room);
			toast.success(`${memberName} was removed from the room`);
		} catch (err) {
			toast.error(err.message || "Failed to remove member");
		}
	};
	const handleBlockUser = async (targetUserId, memberName) => {
		if (!confirm(`Block ${memberName}? They will not be able to message you or track your location.`)) return;
		try {
			await api.blockUser(targetUserId);
			toast.success(`Blocked ${memberName}`);
		} catch (err) {
			toast.error(err.message || "Failed to block user");
		}
	};
	const myMembership = activeRoomDetails?.members?.find((m) => m.userId === user?.id);
	const canManageRoles = myMembership?.role === "OWNER" || myMembership?.role === "ADMIN";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex flex-col h-full border-r ${themeConfig.glassBorder} transition-colors duration-200`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-4 border-b ${themeConfig.glassBorder} ${themeConfig.glassHeader} space-y-3`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: `font-bold ${themeConfig.textPrimary} text-base flex items-center gap-2`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-5 h-5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Rooms & Mesh" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs ${themeConfig.textSecondary}`,
						children: "Private encrypted groups & mesh coordinates"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setShowJoinModal(true),
							className: `px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 border ${themeConfig.glassBorder} hover:bg-white/10 ${themeConfig.textPrimary} cursor-pointer`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "w-3.5 h-3.5" }), "Join"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setShowCreateModal(true),
							className: `px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 shadow-md cursor-pointer ${themeConfig.accentBg}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-3.5 h-3.5" }), "New"]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `flex items-center gap-2.5 px-3 py-2 rounded-2xl border ${themeConfig.glassBorder} bg-black/20 focus-within:ring-2 focus-within:ring-sky-500/50 transition-all shadow-inner`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-4 h-4 text-sky-400 shrink-0" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "Search rooms or members by name, handle, role...",
								value: searchQuery,
								onChange: (e) => setSearchQuery(e.target.value),
								className: `w-full bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400 font-medium`
							}),
							searchQuery && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setSearchQuery(""),
								className: "p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer",
								title: "Clear search",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
							})
						]
					}), searchQuery.trim() && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 text-[11px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSearchCategory("all"),
								className: `px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${searchCategory === "all" ? "bg-sky-500 text-white shadow-sm" : "bg-white/5 text-slate-300 hover:bg-white/10"}`,
								children: [
									"All (",
									filteredRooms.length + filteredMembers.length,
									")"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSearchCategory("rooms"),
								className: `px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${searchCategory === "rooms" ? "bg-sky-500 text-white shadow-sm" : "bg-white/5 text-slate-300 hover:bg-white/10"}`,
								children: [
									"Rooms (",
									filteredRooms.length,
									")"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSearchCategory("members"),
								className: `px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${searchCategory === "members" ? "bg-sky-500 text-white shadow-sm" : "bg-white/5 text-slate-300 hover:bg-white/10"}`,
								children: [
									"Members (",
									filteredMembers.length,
									")"
								]
							})
						]
					})]
				})]
			}),
			searchQuery.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto p-4 pb-28 space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between text-xs text-slate-400",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Search results for ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", {
							className: "text-white font-semibold",
							children: [
								"\"",
								searchQuery,
								"\""
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setSearchQuery(""),
							className: "text-sky-400 hover:underline cursor-pointer",
							children: "Clear filter"
						})]
					}),
					(searchCategory === "all" || searchCategory === "rooms") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono",
								children: [
									"Matching Rooms (",
									filteredRooms.length,
									")"
								]
							})
						}), filteredRooms.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-2xl bg-white/5 text-center text-xs text-slate-400",
							children: [
								"No rooms matched \"",
								searchQuery,
								"\""
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-1 md:grid-cols-2 gap-2",
							children: filteredRooms.map((room) => {
								const isSelected = room.id === selectedRoomId;
								const isUniversal = room.isUniversal || room.id === "room-universal";
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `p-3 rounded-2xl border transition-all flex items-center justify-between ${isSelected ? "bg-sky-500/15 border-sky-400/60 ring-1 ring-sky-400/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1 pr-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1.5",
												children: [
													isUniversal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5 text-indigo-400 shrink-0" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: "font-bold text-xs text-white truncate",
														children: room.name
													}),
													room.hasPassword && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-3 h-3 text-amber-400 shrink-0" })
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[11px] text-slate-400 truncate mt-0.5",
												children: room.description || "Secure communication and location sharing channel."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[10px] text-sky-300 font-mono",
												children: [
													room.memberCount,
													" members · ID: ",
													room.id
												]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => {
											onSelectRoom(room.id);
											toast.success(`Switched to room: ${room.name}`);
										},
										className: `px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${isSelected ? "bg-sky-500 text-white shadow-sm" : "bg-white/10 hover:bg-white/20 text-white"}`,
										children: isSelected ? "Active" : "Select"
									})]
								}, room.id);
							})
						})]
					}),
					(searchCategory === "all" || searchCategory === "members") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2 pt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono",
								children: [
									"Matching Members (",
									filteredMembers.length,
									")"
								]
							})
						}), filteredMembers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-2xl bg-white/5 text-center text-xs text-slate-400",
							children: [
								"No members matched \"",
								searchQuery,
								"\""
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2",
							children: filteredMembers.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative w-9 h-9 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: member.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.userId}`,
											alt: member.fullName,
											className: "w-full h-full rounded-full object-cover border border-white/20 bg-slate-800"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 ${member.isOnline ? "bg-emerald-400" : "bg-slate-500"}` })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-bold text-xs text-white truncate",
												children: member.fullName
											}), member.role && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono text-sky-300 uppercase",
												children: member.role
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[11px] text-slate-400 block truncate",
											children: [
												"@",
												member.username,
												" ",
												member.roomName ? `· in ${member.roomName}` : ""
											]
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 shrink-0 flex-wrap justify-end",
									children: [
										member.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleToggleMemberGeofenceAlert(member.userId, member.fullName),
											className: `px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${getMemberAlertConfig(member.userId).enabled ? "bg-amber-500/25 border-amber-400/50 text-amber-200 hover:bg-amber-500/35" : "bg-white/5 border-white/15 text-slate-300 hover:bg-white/15"}`,
											title: getMemberAlertConfig(member.userId).enabled ? `Disable saved location geofence enter/leave alerts for ${member.fullName}` : `Alert me when ${member.fullName} enters or leaves a saved location geofence`,
											children: getMemberAlertConfig(member.userId).enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "w-3.5 h-3.5 text-amber-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Geofence On" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellOff, { className: "w-3.5 h-3.5 text-slate-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Geofence Off" })] })
										}),
										onSelectUserForChat && member.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => onSelectUserForChat(member.userId),
											className: "px-2.5 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
											title: "Direct Message",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Message" })]
										}),
										member.latitude !== void 0 && member.longitude !== void 0 && onFocusMapLocation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => onFocusMapLocation(member.latitude, member.longitude),
											className: "px-2.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
											title: "Locate on Map",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Map" })]
										}),
										member.roomId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => onSelectRoom(member.roomId),
											className: "px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer",
											title: "Go to Room",
											children: "Room"
										})
									]
								})]
							}, member.userId))
						})]
					}),
					filteredRooms.length === 0 && filteredMembers.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "py-10 text-center space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-10 h-10 text-slate-600 mx-auto" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold text-slate-300",
								children: "No rooms or members found"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-500 max-w-xs mx-auto",
								children: "Try searching by first name, username, or room topic name."
							})
						]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				rooms.some((r) => r.isUniversal || r.id === "room-universal") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 text-white flex items-center justify-between shadow-lg border border-indigo-500/30",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200 shadow-inner",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-5 h-5 text-indigo-300 animate-spin-slow" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-bold tracking-tight text-white",
								children: "Universal Hub"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-1.5 py-0.5 rounded-full bg-indigo-500/40 text-indigo-200 text-[10px] font-semibold border border-indigo-400/30",
								children: "Open to All"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-indigo-200/80",
							children: "Universal room pinned to top — open communication & live mesh coordinates"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								onSelectRoom("room-universal");
								if (onOpenChat) {
									onOpenChat("room-universal");
									toast.success("Opening Universal Hub Messages & Chat...");
								}
							},
							className: "px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-indigo-900 shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0",
							title: "Message in Universal Hub",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-4 h-4 text-indigo-700" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Message" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								onSelectRoom("room-universal");
								joinVoiceChannel("room-universal");
								toast.info("Connecting to Universal WebRTC voice channel...");
							},
							className: "px-2.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/40 hover:bg-indigo-500/60 text-white border border-indigo-400/30 transition-all cursor-pointer flex items-center gap-1 shrink-0",
							title: "Join Universal Live Audio",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhoneCall, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Voice" })]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `p-3 overflow-x-auto flex gap-2 border-b ${themeConfig.glassBorder} ${themeConfig.glassPanel} shrink-0`,
					children: rooms.map((room) => {
						const isSelected = room.id === selectedRoomId;
						const isUniversal = room.isUniversal || room.id === "room-universal";
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => onSelectRoom(room.id),
							className: `px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${isSelected ? isUniversal ? "bg-gradient-to-r from-indigo-700 to-blue-700 text-white shadow-md" : "bg-slate-900 text-white shadow" : isUniversal ? "bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`,
							children: [
								isUniversal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5 text-indigo-400 shrink-0" }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: room.name }),
								isUniversal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-indigo-400/20 text-indigo-600 font-bold",
									children: "Top"
								}) : null,
								room.hasPassword && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-3 h-3 opacity-70" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] opacity-75 font-mono",
									children: [
										"(",
										room.memberCount,
										")"
									]
								})
							]
						}, room.id);
					})
				}),
				activeRoomDetails ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto p-4 pb-28 space-y-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `rounded-2xl border p-4 shadow-sm ${activeRoomDetails.isUniversal || activeRoomDetails.id === "room-universal" ? "bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 border-indigo-200" : "bg-white border-slate-200"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [
												activeRoomDetails.isUniversal || activeRoomDetails.id === "room-universal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5" })
												}) : null,
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "font-bold text-slate-900 text-lg",
													children: activeRoomDetails.name
												}),
												(activeRoomDetails.isUniversal || activeRoomDetails.id === "room-universal") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold",
													children: "🌐 Universal Room (Open to All)"
												}),
												activeRoomDetails.hasPassword && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-semibold flex items-center gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-3 h-3" }), " Password Protected"]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-slate-600 mt-1",
											children: activeRoomDetails.description || "Secure communication and location sharing channel."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 flex items-center gap-3 text-xs text-slate-400",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Room ID: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
													className: "bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono select-all",
													children: activeRoomDetails.id
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Your Role: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "text-slate-800",
													children: myMembership?.role || "MEMBER"
												})] })
											]
										})
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => {
												setRoomMapFocusCoords(null);
												if (!showRoomMap) {
													setShowRoomMap(true);
													setTimeout(() => {
														roomMapPanelRef.current?.scrollIntoView({
															behavior: "smooth",
															block: "nearest"
														});
													}, 80);
												} else setIsRoomMapFullscreen(true);
											},
											className: "px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95",
											title: `Open Live Map showing users in ${activeRoomDetails.name}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
												"Map (",
												activeRoomDetails.members?.length || 1,
												")"
											] })]
										}), !(activeRoomDetails.isUniversal || activeRoomDetails.id === "room-universal") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => {
												onOpenChat?.(activeRoomDetails.id);
												toast.success(`Opening chat in ${activeRoomDetails.name}...`);
											},
											className: "px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95",
											title: `Open Messages in ${activeRoomDetails.name}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Chat" })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => handleLeaveRoom(activeRoomDetails.id),
											className: "px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95",
											title: "Leave Room",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Leave" })]
										})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "hidden sm:block px-2.5 py-1 rounded-lg bg-indigo-100/80 text-indigo-700 text-[10px] font-bold",
											children: "Permanent Hub"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => {
												onOpenChat?.("room-universal");
												toast.success("Opening Universal Hub Messages & Chat...");
											},
											className: "px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95",
											title: "Open Universal Hub Messages",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Message" })]
										})] })]
									})]
								}),
								(activeRoomDetails.isUniversal || activeRoomDetails.id === "room-universal") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 border border-indigo-500/30 text-white space-y-3 shadow-md",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center text-indigo-300",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-4 h-4" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold text-white block",
												children: "Universal Lounge Communication Hub"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] text-indigo-200/80 block",
												children: "#general · #live-locations · #announcements · #lounge"
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 w-full sm:w-auto",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => {
													onOpenChat?.("room-universal");
													toast.success("Switching to Universal Hub Messages & Chat...");
												},
												className: "flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95",
												title: "Open full conversation in Universal Hub",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Message (Open Chat)" })]
											}), myLocation && onFocusMapLocation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => onFocusMapLocation(myLocation.latitude, myLocation.longitude),
												className: "px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer",
												title: "View my location on map",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3.5 h-3.5 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Live Pin" })]
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit: (e) => {
											e.preventDefault();
											if (!quickHubMessage.trim()) return;
											sendMessage({
												roomId: "room-universal",
												channelId: "general",
												text: quickHubMessage.trim()
											});
											setQuickHubMessage("");
											toast.success("Message sent to Universal Hub!");
										},
										className: "flex items-center gap-2 pt-2 border-t border-white/10",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "relative flex-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												placeholder: "Send a quick message to Universal Hub...",
												value: quickHubMessage,
												onChange: (e) => setQuickHubMessage(e.target.value),
												className: "w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-indigo-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "submit",
											disabled: !quickHubMessage.trim(),
											className: "px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Send" })
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 pt-4 border-t border-slate-100",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `w-3 h-3 rounded-full ${activeVoiceRoomId === activeRoomDetails.id ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold text-slate-900",
												children: "Live WebRTC Audio Channel"
											})]
										}), activeVoiceRoomId === activeRoomDetails.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: toggleMicMute,
												className: `p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${isMicMuted ? "bg-amber-100 text-amber-800" : "bg-slate-100 hover:bg-slate-200 text-slate-800"}`,
												children: [isMicMuted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, { className: "w-4 h-4 text-amber-600" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "w-4 h-4" }), isMicMuted ? "Muted" : "Mute"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: leaveVoiceChannel,
												className: "px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhoneOff, { className: "w-4 h-4" }), "Disconnect"]
											})]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => joinVoiceChannel(activeRoomDetails.id),
											className: "px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhoneCall, { className: "w-4 h-4" }), "Join Voice"]
										})]
									}), activeVoiceRoomId === activeRoomDetails.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 p-3 bg-slate-900 rounded-xl text-white",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] text-slate-400 block mb-2",
											children: "Connected Speakers:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: `relative w-6 h-6 rounded-full overflow-hidden ${isSpeaking ? "ring-2 ring-emerald-400" : ""}`,
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
															src: user?.avatarUrl,
															alt: "",
															className: "w-full h-full object-cover"
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-xs font-medium",
														children: "You"
													}),
													isMicMuted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, { className: "w-3 h-3 text-amber-400" }) : isSpeaking ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "w-3 h-3 text-emerald-400 animate-pulse" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "w-3 h-3 text-slate-400" })
												]
											}), voiceParticipants.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: `relative w-6 h-6 rounded-full overflow-hidden ${p.isSpeaking ? "ring-2 ring-emerald-400" : ""}`,
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
															src: p.user.avatarUrl,
															alt: "",
															className: "w-full h-full object-cover"
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-xs font-medium",
														children: p.user.fullName.split(" ")[0]
													}),
													p.isSpeaking && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "w-3 h-3 text-emerald-400 animate-pulse" })
												]
											}, p.peerId))]
										})]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							ref: roomMapPanelRef,
							className: "space-y-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
										className: "font-bold text-slate-900 text-sm flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "w-4 h-4 text-emerald-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Room Live Map Panel — ", activeRoomDetails.name] })]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [showRoomMap && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setIsRoomMapFullscreen((prev) => !prev),
										className: "px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95",
										title: isRoomMapFullscreen ? "Dock Map into Panel" : "Expand Room Map to Full Screen",
										children: isRoomMapFullscreen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize2, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dock Panel" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Full Screen" })] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											if (showRoomMap) {
												setIsRoomMapFullscreen(false);
												setShowRoomMap(false);
											} else setShowRoomMap(true);
										},
										className: `px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ${showRoomMap ? "bg-slate-200 hover:bg-slate-300 text-slate-800" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`,
										title: showRoomMap ? "Hide Room Map Panel" : "Show Room Map Panel",
										children: [showRoomMap ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-3.5 h-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: showRoomMap ? "Hide Map" : "Show Map" })]
									})]
								})]
							}), showRoomMap && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: isRoomMapFullscreen ? "fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in duration-150" : "relative w-full h-[520px] sm:h-[580px] rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xl bg-slate-950 flex flex-col transition-all duration-200",
								children: [isRoomMapFullscreen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-slate-900/95 border-b border-white/10 px-4 py-2 flex items-center justify-between text-white shrink-0 z-40",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-bold text-xs truncate",
											children: [activeRoomDetails.name, " — Full Screen Room Map"]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => setIsRoomMapFullscreen(false),
											className: "px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minimize2, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dock Panel" })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => {
												setIsRoomMapFullscreen(false);
												setShowRoomMap(false);
											},
											className: "p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer transition-colors",
											title: "Close Room Map",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "relative flex-1 w-full h-full",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveMap, {
										isActive: isActive && showRoomMap,
										roomOnlyMode: true,
										activeRoomDetails,
										onCloseRoomMap: isRoomMapFullscreen ? () => setIsRoomMapFullscreen(false) : () => setShowRoomMap(false),
										focusCoords: roomMapFocusCoords,
										savedPlaces,
										onRefreshSavedPlaces,
										rooms,
										selectedRoomId: activeRoomDetails.id,
										onSelectUserForChat: (targetUserId) => {
											setIsRoomMapFullscreen(false);
											onSelectUserForChat?.(targetUserId);
										},
										onAddPlaceAtCoords: (lat, lng) => {
											setIsRoomMapFullscreen(false);
											onAddPlaceAtCoords?.(lat, lng);
										},
										onSetReminderAtCoords: (lat, lng, title) => {
											setIsRoomMapFullscreen(false);
											onSetReminderAtCoords?.(lat, lng, title);
										}
									})
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
										className: "font-bold text-slate-900 text-sm flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4 text-slate-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Members & Live Coordinates (",
											activeRoomDetails.members?.length || 0,
											")"
										] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-[11px] text-slate-500",
										children: [
											"Toggle ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-slate-700",
												children: "Geofence Alert"
											}),
											" on any member to get notified when they enter or leave your ",
											savedPlaces.length,
											" saved location",
											savedPlaces.length === 1 ? "" : "s",
											"."
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 flex-wrap",
										children: [activeRoomDetails.members && activeRoomDetails.members.some((m) => m.userId !== user?.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												const peers = (activeRoomDetails.members || []).filter((m) => m.userId !== user?.id);
												const nextState = !peers.every((m) => getMemberAlertConfig(m.userId).enabled);
												saveMemberGeofenceAlerts((prev) => {
													const copy = { ...prev };
													peers.forEach((m) => {
														const existing = copy[m.userId] || {
															enabled: false,
															notifyOnEnter: true,
															notifyOnLeave: true,
															placeIds: []
														};
														copy[m.userId] = {
															...existing,
															enabled: nextState
														};
													});
													return copy;
												});
												sound.playChime();
												toast.info(nextState ? `Enabled geofence enter/leave alerts for all ${peers.length} room member${peers.length === 1 ? "" : "s"}` : "Muted geofence alerts for all members in this room");
											},
											className: "px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95",
											title: "Toggle geofence enter/leave notifications for all members in this room",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-3.5 h-3.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: (activeRoomDetails.members || []).filter((m) => m.userId !== user?.id).every((m) => getMemberAlertConfig(m.userId).enabled) ? "Mute All Geofences" : "Alert All Members" })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => {
												setRoomMapFocusCoords(null);
												setShowRoomMap(true);
												setIsRoomMapFullscreen(true);
											},
											className: "px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95",
											title: `View all members of ${activeRoomDetails.name} on Full Screen Room Map`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Full Room Map" })]
										})]
									})]
								}),
								geofenceEvents.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[11px] font-bold text-amber-900 flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "w-3.5 h-3.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
												"Recent Saved Location Geofence Alerts (",
												geofenceEvents.length,
												")"
											] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setGeofenceEvents([]),
											className: "text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer",
											children: "Clear"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "space-y-1 max-h-28 overflow-y-auto",
										children: geofenceEvents.slice(0, 5).map((ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-xs text-amber-950 flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200/60",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: ev.memberName }),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: ev.action === "entered" ? "text-emerald-700 font-bold" : "text-rose-700 font-bold",
													children: ev.action
												}),
												" ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: ev.placeName }),
												" (",
												ev.distanceMeters,
												"m)"
											] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] text-slate-500 font-mono shrink-0",
												children: new Date(ev.timestamp).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit"
												})
											})]
										}, ev.id))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-2",
									children: activeRoomDetails.members?.map((mem) => {
										const isOnline = onlineUserIds.includes(mem.userId);
										const peerLoc = userLocations.find((l) => l.userId === mem.userId);
										const alertCfg = getMemberAlertConfig(mem.userId);
										const isExpanded = expandedGeofenceMemberId === mem.userId;
										let distanceText = "Location private / offline";
										if (mem.userId === user?.id) distanceText = "You (Current device)";
										else if (myLocation && peerLoc) {
											const m = calculateDistanceMeters(myLocation.latitude, myLocation.longitude, peerLoc.latitude, peerLoc.longitude);
											distanceText = `${formatDistance(m)} away`;
										}
										const insideSavedPlaces = peerLoc && savedPlaces.length > 0 ? savedPlaces.filter((place) => {
											return calculateDistanceMeters(peerLoc.latitude, peerLoc.longitude, place.latitude, place.longitude) <= (place.radiusMeters || 150);
										}) : [];
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-3 bg-white rounded-xl border transition-all shadow-sm space-y-2.5 ${alertCfg.enabled && mem.userId !== user?.id ? "border-amber-300 ring-1 ring-amber-200/60" : "border-slate-200"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between gap-2 flex-wrap",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-3 min-w-0",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "relative shrink-0",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
															src: mem.user.avatarUrl,
															alt: mem.user.fullName,
															className: "w-10 h-10 rounded-full object-cover border border-slate-200"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? "bg-emerald-500" : "bg-slate-300"}` })]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "min-w-0",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2 flex-wrap",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-bold text-slate-900 text-sm truncate",
																	children: mem.user.fullName
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700",
																	children: mem.role
																}),
																insideSavedPlaces.map((pl) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1",
																	title: `${mem.user.fullName} is currently inside "${pl.name}" geofence (${pl.radiusMeters}m radius)`,
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-2.5 h-2.5 text-emerald-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["At ", pl.name] })]
																}, pl.id))
															]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["@", mem.user.username] }),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-blue-600 font-medium",
																	children: distanceText
																}),
																alertCfg.enabled && mem.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "text-amber-700 font-semibold text-[11px]",
																	children: [
																		"Watching",
																		" ",
																		alertCfg.placeIds.length > 0 ? `${alertCfg.placeIds.length} place${alertCfg.placeIds.length === 1 ? "" : "s"}` : `all ${savedPlaces.length} saved place${savedPlaces.length === 1 ? "" : "s"}`
																	]
																})] })
															]
														})]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1.5 flex-wrap",
													children: [
														mem.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center rounded-xl border overflow-hidden shadow-2xs",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	type: "button",
																	role: "switch",
																	"aria-checked": alertCfg.enabled,
																	onClick: () => handleToggleMemberGeofenceAlert(mem.userId, mem.user.fullName),
																	className: `px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${alertCfg.enabled ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`,
																	title: alertCfg.enabled ? `Geofence notifications ON for ${mem.user.fullName} (click to mute)` : `Enable notifications when ${mem.user.fullName} enters or leaves a saved location geofence`,
																	children: alertCfg.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Geofence Alert On" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellOff, { className: "w-3.5 h-3.5 text-slate-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Geofence Alert" })] })
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	type: "button",
																	onClick: () => setExpandedGeofenceMemberId((prev) => prev === mem.userId ? null : mem.userId),
																	className: `px-2 py-1.5 border-l text-xs transition-colors cursor-pointer ${isExpanded ? "bg-slate-900 text-white border-slate-800" : alertCfg.enabled ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300" : "bg-slate-50 hover:bg-slate-200 text-slate-600 border-slate-200"}`,
																	title: `Configure saved location geofence rules for ${mem.user.fullName}`,
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "w-3.5 h-3.5" })
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																onClick: () => {
																	onSelectUserForChat?.(mem.userId);
																	toast.info(`Opening direct chat with ${mem.user.fullName}`);
																},
																className: "px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 dark:text-sky-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-sky-200 dark:border-sky-800/50 transition-colors cursor-pointer",
																title: `Direct Message ${mem.user.fullName}`,
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Message" })]
															}),
															mem.user.phoneNumber && mem.user.privacy?.phoneVisibility !== "nobody" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
																href: `tel:${mem.user.phoneNumber}`,
																className: "p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors",
																title: `Call ${mem.user.phoneNumber}`,
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "w-4 h-4" })
															}),
															peerLoc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => {
																	setRoomMapFocusCoords({
																		lat: peerLoc.latitude,
																		lng: peerLoc.longitude
																	});
																	setShowRoomMap(true);
																	setTimeout(() => {
																		roomMapPanelRef.current?.scrollIntoView({
																			behavior: "smooth",
																			block: "nearest"
																		});
																	}, 60);
																},
																className: "p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer",
																title: `Focus ${mem.user.fullName} on Room Map Panel`,
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-4 h-4" })
															})
														] }),
														canManageRoles && mem.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															value: mem.role,
															onChange: (e) => handleChangeRole(mem.userId, e.target.value),
															className: "text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none ml-1",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "ADMIN",
																	children: "ADMIN"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "MODERATOR",
																	children: "MODERATOR"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "MEMBER",
																	children: "MEMBER"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "GUEST",
																	children: "GUEST"
																})
															]
														}),
														canManageRoles && mem.userId !== user?.id && mem.role !== "OWNER" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => handleKickMember(mem.userId, mem.user.fullName),
															className: "p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer",
															title: `Remove ${mem.user.fullName} from room`,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "w-3.5 h-3.5 rotate-180" })
														}),
														mem.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => handleBlockUser(mem.userId, mem.user.fullName),
															className: "p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer",
															title: `Block ${mem.user.fullName}`,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserX, { className: "w-3.5 h-3.5" })
														})
													]
												})]
											}), isExpanded && mem.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "pt-2.5 border-t border-slate-100 bg-slate-50/80 -mx-3 -mb-3 p-3 rounded-b-xl space-y-2.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between flex-wrap gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-xs font-bold text-slate-800 flex items-center gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellRing, { className: "w-3.5 h-3.5 text-amber-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Geofence Alert Rules for ", mem.user.fullName] })]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: alertCfg.notifyOnEnter,
																onChange: (e) => handleUpdateMemberGeofenceConfig(mem.userId, {
																	enabled: true,
																	notifyOnEnter: e.target.checked
																}),
																className: "rounded accent-amber-600"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "On Enter" })]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: alertCfg.notifyOnLeave,
																onChange: (e) => handleUpdateMemberGeofenceConfig(mem.userId, {
																	enabled: true,
																	notifyOnLeave: e.target.checked
																}),
																className: "rounded accent-amber-600"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "On Leave" })]
														})]
													})]
												}), savedPlaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "No saved locations yet. Add a saved place to monitor its geofence radius." })
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "space-y-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between text-[11px] text-slate-500",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
															"Select saved locations to watch (leave all unchecked to monitor all ",
															savedPlaces.length,
															" places):"
														] }), alertCfg.placeIds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															type: "button",
															onClick: () => handleUpdateMemberGeofenceConfig(mem.userId, { placeIds: [] }),
															className: "text-sky-600 font-semibold hover:underline cursor-pointer",
															children: [
																"Monitor All (",
																savedPlaces.length,
																")"
															]
														})]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex flex-wrap gap-1.5",
														children: savedPlaces.map((place) => {
															const isWatched = alertCfg.placeIds.length === 0 || alertCfg.placeIds.includes(place.id);
															const isSpecificallySelected = alertCfg.placeIds.includes(place.id);
															const distToPlace = peerLoc ? Math.round(calculateDistanceMeters(peerLoc.latitude, peerLoc.longitude, place.latitude, place.longitude)) : null;
															const isInsideNow = distToPlace !== null && distToPlace <= (place.radiusMeters || 150);
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																type: "button",
																onClick: () => handleToggleMemberWatchedPlace(mem.userId, place.id),
																className: `px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${isSpecificallySelected ? "bg-slate-900 text-white border-slate-900 shadow-xs" : isWatched ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-100" : "bg-slate-100 text-slate-400 border-slate-200 opacity-60 hover:opacity-100"}`,
																title: `Radius: ${place.radiusMeters}m${distToPlace !== null ? ` · Member is ${formatDistance(distToPlace)} away` : ""}`,
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: `w-3 h-3 ${isInsideNow ? "text-emerald-500" : "text-amber-500"}` }),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: place.name }),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "text-[10px] opacity-75 font-mono",
																		children: [
																			"(",
																			place.radiusMeters,
																			"m",
																			distToPlace !== null ? ` · ${formatDistance(distToPlace)}` : "",
																			")"
																		]
																	})
																]
															}, place.id);
														})
													})]
												})]
											})]
										}, mem.userId);
									})
								})
							]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-12 h-12 text-slate-300 mb-2" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-semibold text-slate-700",
							children: "No rooms available"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 mt-1",
							children: "Create or join a room using a unique Room ID"
						})
					]
				})
			] }),
			showCreateModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: { colorScheme: "light" },
					className: "bg-white text-slate-950 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-popIn",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-xl text-slate-950 mb-1",
							children: "Create Private Room"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-700 mb-4 font-medium",
							children: "Set up a secure encrypted room for your family or team."
						}),
						errorMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: errorMsg }), errorMsg.toLowerCase().includes("session") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => logout(),
								className: "ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] shrink-0",
								children: "Sign In"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleCreateRoom,
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1.5",
									children: "Room Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									required: true,
									placeholder: "e.g. Family Safe Haven or Reddy",
									value: newRoomName,
									onChange: (e) => setNewRoomName(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1.5",
									children: "Description"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "e.g. Real-time family check-ins and emergency alerts",
									value: newRoomDesc,
									onChange: (e) => setNewRoomDesc(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1.5",
									children: "Room Password (Optional)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									placeholder: "Leave empty for open room",
									value: newRoomPassword,
									onChange: (e) => setNewRoomPassword(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-3 flex items-center justify-end gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setShowCreateModal(false),
										className: "px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer",
										children: "Cancel"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer",
										children: "Create Room"
									})]
								})
							]
						})
					]
				})
			}),
			showJoinModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: { colorScheme: "light" },
					className: "bg-white text-slate-950 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-popIn",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-xl text-slate-950 mb-1",
							children: "Join Room"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-700 mb-4 font-medium",
							children: "Enter the unique Room ID or Room Name and password (if required)."
						}),
						errorMsg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: errorMsg }), errorMsg.toLowerCase().includes("session") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => logout(),
								className: "ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] shrink-0",
								children: "Sign In"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleJoinRoom,
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1.5",
									children: "Room ID or Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									required: true,
									placeholder: "e.g. Reddy or room-name",
									value: joinRoomId,
									onChange: (e) => setJoinRoomId(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1.5",
									children: "Password"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									placeholder: "Room password if protected",
									value: joinPassword,
									onChange: (e) => setJoinPassword(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-3 flex items-center justify-end gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setShowJoinModal(false),
										className: "px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer",
										children: "Cancel"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer",
										children: "Join Room"
									})]
								})
							]
						})
					]
				})
			})
		]
	});
};
export { RoomsManager };
