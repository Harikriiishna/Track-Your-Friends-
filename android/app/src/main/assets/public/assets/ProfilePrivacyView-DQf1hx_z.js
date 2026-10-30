import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { At as Copy, B as Phone, Bt as Check, C as Shield, Dt as Download, Ht as Camera, I as RefreshCw, Jt as Bell, L as Radio, Nt as Clock, T as ShieldAlert, W as Palette, _ as Sparkles, d as TriangleAlert, en as require_react, it as LogOut, kt as Cpu, l as User, lt as Laptop, m as Terminal, mt as History, nt as MapPin, p as Trash2, u as UserX, y as Smartphone } from "./vendor-icons-PxteBMrr.js";
import { a as api, i as useAuth, n as useToast } from "./ToastContext-ziKLJ15f.js";
import { c as PWAInstallButton, f as notifications, i as MEMBER_ICONS, l as GLASS_THEMES, o as getMemberIconEmoji, r as MARKER_COLORS, s as BackendDiagnosticPanel, u as useTheme } from "./index-Beu_4vAP.js";
// src/components/Profile/ProfilePrivacyView.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var ProfilePrivacyView = () => {
	const { user, updateProfile, updatePrivacy, logout } = useAuth();
	const { currentTheme, setTheme, themeConfig } = useTheme();
	const toast = useToast();
	const [fullName, setFullName] = (0, import_react.useState)(user?.fullName || "");
	const [about, setAbout] = (0, import_react.useState)(user?.about || "");
	const [phoneNumber, setPhoneNumber] = (0, import_react.useState)(user?.phoneNumber || "");
	const [avatarUrl, setAvatarUrl] = (0, import_react.useState)(user?.avatarUrl || "");
	const [markerColor, setMarkerColor] = (0, import_react.useState)(user?.markerColor || "#0ea5e9");
	const [markerIcon, setMarkerIcon] = (0, import_react.useState)(user?.markerIcon || "person");
	const [markerLabel, setMarkerLabel] = (0, import_react.useState)(user?.markerLabel || "");
	const [locationSharingEnabled, setLocationSharingEnabled] = (0, import_react.useState)(user?.privacy?.locationSharingEnabled ?? true);
	const [temporarySharingOption, setTemporarySharingOption] = (0, import_react.useState)("always");
	const [activeExpiry, setActiveExpiry] = (0, import_react.useState)(user?.privacy?.temporarySharingExpiry || null);
	const [locVis, setLocVis] = (0, import_react.useState)(user?.privacy?.locationVisibility || "room_members");
	const [phoneVis, setPhoneVis] = (0, import_react.useState)(user?.privacy?.phoneVisibility || "room_members");
	const [profileVis, setProfileVis] = (0, import_react.useState)(user?.privacy?.profileVisibility || "public");
	const [showOnline, setShowOnline] = (0, import_react.useState)(user?.privacy?.showOnlineStatus ?? true);
	const [sessions, setSessions] = (0, import_react.useState)([]);
	const [loadingSessions, setLoadingSessions] = (0, import_react.useState)(false);
	const [blockedUsers, setBlockedUsers] = (0, import_react.useState)([]);
	const [loadingBlocked, setLoadingBlocked] = (0, import_react.useState)(false);
	const [isPurgingHistory, setIsPurgingHistory] = (0, import_react.useState)(false);
	const [showPurgeConfirmModal, setShowPurgeConfirmModal] = (0, import_react.useState)(false);
	const [isSaving, setIsSaving] = (0, import_react.useState)(false);
	const [saveSuccess, setSaveSuccess] = (0, import_react.useState)(false);
	const [shareRequests, setShareRequests] = (0, import_react.useState)([]);
	const [notificationPermission, setNotificationPermission] = (0, import_react.useState)(notifications.getPermission());
	const handleRequestNotifications = async () => {
		const granted = await notifications.requestPermission();
		setNotificationPermission(granted ? "granted" : "denied");
		if (granted) notifications.send("Beacon Alerts Enabled", { body: "You will receive critical emergency alerts and location notifications." });
	};
	const fileInputRef = (0, import_react.useRef)(null);
	const loadRequests = async () => {
		if (!user || !api.getToken()) return;
		try {
			const res = await api.get("/api/locations/requests");
			setShareRequests(res.requests || []);
		} catch (err) {
			console.warn("Could not load location share requests:", err);
		}
	};
	const loadSessions = async () => {
		if (!user || !api.getToken()) return;
		try {
			setLoadingSessions(true);
			const res = await api.getSessions();
			setSessions(res.sessions || []);
		} catch (err) {
			console.warn("Could not load active sessions:", err);
		} finally {
			setLoadingSessions(false);
		}
	};
	const loadBlockedUsers = async () => {
		if (!user || !api.getToken()) return;
		try {
			setLoadingBlocked(true);
			const res = await api.getBlockedUsers();
			setBlockedUsers(res.blockedUsers || []);
		} catch (err) {
			console.warn("Could not load blocked users:", err);
		} finally {
			setLoadingBlocked(false);
		}
	};
	(0, import_react.useEffect)(() => {
		if (!user || !api.getToken()) return;
		loadRequests();
		loadSessions();
		loadBlockedUsers();
	}, [user?.id]);
	const handleAvatarChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async () => {
			try {
				const dataUrl = reader.result;
				const res = await api.uploadFile(dataUrl, `avatar-${Date.now()}.png`, file.type);
				setAvatarUrl(res.url);
				toast.success("Avatar uploaded");
			} catch (err) {
				toast.error("Failed to upload avatar image");
			}
		};
		reader.readAsDataURL(file);
	};
	const handleSaveProfile = async (e) => {
		e.preventDefault();
		setIsSaving(true);
		setSaveSuccess(false);
		try {
			await updateProfile({
				fullName,
				about,
				phoneNumber,
				avatarUrl,
				markerColor,
				markerIcon,
				markerLabel
			});
			let expiryIso = null;
			if (!locationSharingEnabled) expiryIso = null;
			else if (temporarySharingOption === "1h") expiryIso = new Date(Date.now() + 36e5).toISOString();
			else if (temporarySharingOption === "8h") expiryIso = new Date(Date.now() + 288e5).toISOString();
			else if (temporarySharingOption === "24h") expiryIso = new Date(Date.now() + 864e5).toISOString();
			else expiryIso = null;
			await updatePrivacy({
				locationVisibility: locVis,
				phoneVisibility: phoneVis,
				profileVisibility: profileVis,
				showOnlineStatus: showOnline,
				locationSharingEnabled,
				temporarySharingExpiry: expiryIso
			});
			setActiveExpiry(expiryIso);
			setSaveSuccess(true);
			toast.success("Privacy & security preferences saved");
			setTimeout(() => setSaveSuccess(false), 3e3);
		} catch (err) {
			toast.error(err.message || "Failed to update profile settings");
		} finally {
			setIsSaving(false);
		}
	};
	const handleRevokeSession = async (sessionToken) => {
		try {
			await api.revokeSession(sessionToken);
			setSessions((prev) => prev.filter((s) => s.token !== sessionToken));
			toast.success("Device session revoked");
		} catch (err) {
			toast.error(err.message || "Failed to revoke device session");
		}
	};
	const handleRevokeOtherSessions = async () => {
		try {
			const res = await api.revokeOtherSessions();
			setSessions((prev) => prev.filter((s) => s.isCurrent));
			toast.success(`Revoked ${res.revokedCount} other active sessions`);
		} catch (err) {
			toast.error(err.message || "Failed to revoke other sessions");
		}
	};
	const handleUnblockUser = async (targetUserId, name) => {
		try {
			await api.unblockUser(targetUserId);
			setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
			toast.success(`Unblocked ${name}`);
		} catch (err) {
			toast.error(err.message || "Failed to unblock user");
		}
	};
	const handlePurgeLocationHistory = async () => {
		try {
			setIsPurgingHistory(true);
			const res = await api.clearLocationHistory();
			toast.success(res.message || "All location breadcrumbs permanently deleted");
			setShowPurgeConfirmModal(false);
		} catch (err) {
			toast.error(err.message || "Failed to clear location history");
		} finally {
			setIsPurgingHistory(false);
		}
	};
	const handleRespondRequest = async (requestId, response) => {
		try {
			const res = await api.post("/api/locations/respond", {
				requestId,
				response
			});
			setShareRequests((prev) => prev.map((r) => r.id === requestId ? res.request : r));
			toast.success(`Location request ${response}`);
		} catch (err) {
			toast.error(err.message || "Failed to update request");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full overflow-y-auto p-4 md:p-6 pb-28 space-y-6 max-w-4xl mx-auto w-full relative z-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: `font-bold ${themeConfig.textPrimary} text-xl tracking-tight`,
					children: "Account, Privacy & Glass Optics"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: `text-xs ${themeConfig.textSecondary}`,
					children: "Control your themes, identity, phone visibility, and real-time location sharing permissions"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: logout,
					className: "px-3.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center gap-1.5 transition-colors border border-rose-500/20 cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "w-4 h-4" }), "Log Out"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `${themeConfig.glassPanel} rounded-3xl border ${themeConfig.glassBorder} p-6 shadow-xl`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between mb-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, {
								className: "w-5 h-5",
								style: { color: themeConfig.accentHex }
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: `font-bold ${themeConfig.textPrimary} text-base`,
								children: "Glass Themes & UI Optics"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15",
							children: "6 Glass Themes"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs ${themeConfig.textSecondary} mb-4`,
						children: "Select your preferred frosted glass aesthetic. All panels, maps, menus, and discord channels update instantly."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3",
						children: Object.keys(GLASS_THEMES).map((themeId) => {
							const t = GLASS_THEMES[themeId];
							const isSelected = currentTheme === themeId;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setTheme(themeId),
								className: `p-3 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${isSelected ? "ring-2 ring-white/90 border-white/50 shadow-lg scale-[1.02]" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `h-14 w-full rounded-xl bg-gradient-to-r ${t.previewGradient} p-2 flex items-end justify-between border border-white/20 mb-2 relative overflow-hidden shadow-inner`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-bold text-white px-2 py-0.5 rounded bg-black/40 backdrop-blur-md",
											children: t.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-3.5 h-3.5 rounded-full border-2 border-white shadow",
											style: { backgroundColor: t.accentHex }
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-bold text-white block truncate",
											children: t.name
										}), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white text-slate-900",
											children: "Active"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] text-white/60 line-clamp-1 mt-0.5 block",
										children: t.tagline
									})
								]
							}, themeId);
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackendDiagnosticPanel, { compactByDefault: false }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleSaveProfile,
				className: "space-y-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `${themeConfig.glassPanel} rounded-3xl border ${themeConfig.glassBorder} p-6 shadow-xl`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: `font-bold ${themeConfig.textPrimary} text-sm mb-4 flex items-center gap-2`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, {
									className: "w-4 h-4",
									style: { color: themeConfig.accentHex }
								}), "Public Identity"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col sm:flex-row items-center gap-6 mb-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative group",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: avatarUrl || user?.avatarUrl,
											alt: "Avatar",
											className: "w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-md group-hover:opacity-90 transition-opacity"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => fileInputRef.current?.click(),
											className: "absolute bottom-0 right-0 p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg transition-transform active:scale-95",
											title: "Upload Photo",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "w-4 h-4" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "file",
											ref: fileInputRef,
											onChange: handleAvatarChange,
											accept: "image/*",
											className: "hidden"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1 text-center sm:text-left",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-bold text-slate-900 text-base",
											children: user?.fullName
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-slate-500 font-mono",
											children: [
												"@",
												user?.username,
												" · ",
												user?.email
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-slate-400",
											children: "Uploaded avatar is stored persistently on the backend server."
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-semibold text-slate-700 mb-1",
										children: "Full Name"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										required: true,
										value: fullName,
										onChange: (e) => setFullName(e.target.value),
										className: "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-semibold text-slate-700 mb-1",
										children: "Phone Number"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "tel",
										placeholder: "+1 (555) 000-0000",
										value: phoneNumber,
										onChange: (e) => setPhoneNumber(e.target.value),
										className: "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "sm:col-span-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-semibold text-slate-700 mb-1",
											children: "About / Status"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: about,
											onChange: (e) => setAbout(e.target.value),
											className: "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "font-bold text-slate-900 text-sm flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "w-4 h-4 text-sky-600" }), "Map Marker & Family Role Styling"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-slate-500 mt-0.5",
									children: "Customize your live map marker color, role icon, and label to help family members identify you visually."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold font-mono border border-sky-100 flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3 h-3 text-sky-500" }), "Live Visuals"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-inner",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative z-10 flex flex-col items-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3",
											children: "Live Map Appearance"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative flex items-center justify-center w-20 h-20",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute -top-4 w-24 h-24 pointer-events-none opacity-60 transition-transform duration-300",
													style: {
														background: `radial-gradient(circle at 50% 100%, ${markerColor}66 0%, ${markerColor}11 50%, transparent 75%)`,
														clipPath: "polygon(50% 100%, 15% 0%, 85% 0%)"
													}
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute inset-2 rounded-full animate-ping opacity-30",
													style: { backgroundColor: markerColor }
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "relative w-12 h-12 rounded-full border-2 border-white shadow-2xl overflow-hidden bg-slate-900 transition-all duration-300 ring-4",
													style: {
														borderColor: "#ffffff",
														outlineColor: markerColor,
														boxShadow: `0 0 20px ${markerColor}80`
													},
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
														src: avatarUrl || user?.avatarUrl,
														alt: "Preview",
														className: "w-full h-full object-cover"
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-xs shadow-lg",
													title: "Role Badge",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: getMemberIconEmoji(markerIcon) })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "absolute -bottom-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg whitespace-nowrap border border-white/20 flex items-center gap-1",
													style: { backgroundColor: markerColor },
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: getMemberIconEmoji(markerIcon) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: markerLabel.trim() || fullName.split(" ")[0] || "You" })]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative z-10 max-w-sm space-y-2 text-center sm:text-left",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
												className: "font-bold text-white text-sm",
												children: markerLabel.trim() ? `${markerLabel} (${fullName})` : fullName
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-xs text-slate-300 leading-relaxed",
												children: [
													"When you share location in rooms, peers will see your directional beacon pulsing with",
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold",
														style: { color: markerColor },
														children: MARKER_COLORS.find((c) => c.hex.toLowerCase() === markerColor.toLowerCase())?.label || "Custom Color"
													}),
													" ",
													"and the ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-bold",
														children: [
															getMemberIconEmoji(markerIcon),
															" ",
															MEMBER_ICONS.find((i) => i.id === markerIcon)?.label || "Member"
														]
													}),
													" badge."
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-300",
													children: ["Hex: ", markerColor]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-300",
													children: ["Role: ", markerIcon]
												})]
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 font-mono",
								children: "1. Marker Accent Color"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-3 sm:grid-cols-6 gap-2",
								children: MARKER_COLORS.map((c) => {
									const isSelected = markerColor.toLowerCase() === c.hex.toLowerCase();
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setMarkerColor(c.hex),
										className: `p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${isSelected ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-5 h-5 rounded-full border border-white shadow-sm flex items-center justify-center shrink-0",
											style: { backgroundColor: c.hex },
											children: isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
												className: "w-3 h-3 text-white",
												strokeWidth: 3
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-slate-800 truncate",
											children: c.label
										})]
									}, c.id);
								})
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 font-mono",
								children: "2. Family Member & Role Icon"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2",
								children: MEMBER_ICONS.map((icon) => {
									const isSelected = markerIcon === icon.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setMarkerIcon(icon.id),
										className: `p-2.5 rounded-2xl border flex items-center gap-2 transition-all cursor-pointer ${isSelected ? "border-slate-900 bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20" : "border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-base shrink-0",
											children: icon.emoji
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold truncate",
											children: icon.label
										})]
									}, icon.id);
								})
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 font-mono",
									children: "3. Marker Display Label / Nickname"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-slate-500 mb-2",
									children: "Optional short text shown on your map pin (e.g. \"Dad\", \"Mom\", \"Sam (Kid)\", \"Van #1\")."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									maxLength: 20,
									placeholder: `e.g. ${fullName.split(" ")[0] || "Dad"}`,
									value: markerLabel,
									onChange: (e) => setMarkerLabel(e.target.value),
									className: "w-full max-w-md px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
								})
							] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "font-bold text-slate-900 text-sm flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-4 h-4 text-emerald-600" }), "Privacy & Location Visibility Governance"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-500 mt-0.5",
								children: "Every privacy setting below is strictly enforced by the server; unauthorized queries never receive coordinates."
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-2xl border transition-all ${locationSharingEnabled ? "bg-blue-50/70 border-blue-200" : "bg-amber-50/70 border-amber-200"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, { className: `w-4 h-4 ${locationSharingEnabled ? "text-blue-600 animate-pulse" : "text-amber-600"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-slate-900 text-xs",
														children: "Master GPS Location Sharing Switch"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: `text-[10px] font-bold px-2 py-0.5 rounded-full ${locationSharingEnabled ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`,
													children: locationSharingEnabled ? "Broadcasting Active" : "Broadcasting Paused"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-600 mb-3 leading-relaxed",
												children: "When disabled, your phone stops transmitting real-time coordinates. The server immediately drops all incoming GPS updates and removes your active position from peers."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between pt-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs font-semibold text-slate-800",
													children: "Allow Beacon to transmit my live GPS location:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
													className: "relative inline-flex items-center cursor-pointer",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: locationSharingEnabled,
														onChange: (e) => setLocationSharingEnabled(e.target.checked),
														className: "sr-only peer"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })]
												})]
											}),
											locationSharingEnabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-4 pt-3 border-t border-blue-200/60",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between mb-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5 text-blue-600" }), "Auto-Expire Location Sharing Duration"]
													}), activeExpiry && new Date(activeExpiry) > /* @__PURE__ */ new Date() && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200",
														children: ["Expires: ", new Date(activeExpiry).toLocaleTimeString([], {
															hour: "2-digit",
															minute: "2-digit"
														})]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "grid grid-cols-2 sm:grid-cols-4 gap-2",
													children: [
														{
															id: "always",
															label: "Indefinitely",
															sub: "Until manual stop"
														},
														{
															id: "1h",
															label: "1 Hour",
															sub: "Auto-off in 60m"
														},
														{
															id: "8h",
															label: "8 Hours",
															sub: "Work/Trip shift"
														},
														{
															id: "24h",
															label: "24 Hours",
															sub: "Auto-off tomorrow"
														}
													].map((dur) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														type: "button",
														onClick: () => setTemporarySharingOption(dur.id),
														className: `p-2 rounded-xl border text-left transition-all ${temporarySharingOption === dur.id ? "border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-xs" : "border-slate-200 bg-white/70 hover:bg-white text-slate-600"}`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold text-xs block text-slate-900",
															children: dur.label
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-slate-500 block truncate",
															children: dur.sub
														})]
													}, dur.id))
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 bg-slate-50 rounded-2xl border border-slate-200",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-blue-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-slate-900 text-xs",
														children: "Live GPS Location Visibility"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-semibold text-slate-500 uppercase tracking-wider",
													children: "Server Enforced"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-500 mb-3",
												children: "Decide who is permitted to view your map marker and real-time distance calculations."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "grid grid-cols-1 sm:grid-cols-3 gap-2",
												children: [
													{
														id: "room_members",
														label: "Room Members",
														desc: "People in shared rooms"
													},
													{
														id: "emergency_only",
														label: "Emergency Only",
														desc: "Distress alerts only"
													},
													{
														id: "nobody",
														label: "Nobody (Private)",
														desc: "Completely off the map"
													}
												].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => setLocVis(opt.id),
													className: `p-3 rounded-xl border text-left transition-all ${locVis === opt.id ? "border-slate-900 bg-white ring-2 ring-slate-900/10 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-100 text-slate-600"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-xs block text-slate-900",
														children: opt.label
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] text-slate-500 mt-0.5 block",
														children: opt.desc
													})]
												}, opt.id))
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 bg-slate-50 rounded-2xl border border-slate-200",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex items-center justify-between mb-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "w-4 h-4 text-purple-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-slate-900 text-xs",
														children: "Phone Number Visibility"
													})]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-500 mb-3",
												children: "Controls whether room members or distress responders can see your direct contact number."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "grid grid-cols-1 sm:grid-cols-3 gap-2",
												children: [
													{
														id: "room_members",
														label: "Room Members",
														desc: "Visible to members"
													},
													{
														id: "everyone",
														label: "Everyone",
														desc: "Visible to community"
													},
													{
														id: "nobody",
														label: "Nobody",
														desc: "Hidden from profiles"
													}
												].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => setPhoneVis(opt.id),
													className: `p-3 rounded-xl border text-left transition-all ${phoneVis === opt.id ? "border-slate-900 bg-white ring-2 ring-slate-900/10 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-100 text-slate-600"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-xs block text-slate-900",
														children: opt.label
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[11px] text-slate-500 mt-0.5 block",
														children: opt.desc
													})]
												}, opt.id))
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-slate-900 text-xs block",
											children: "Show Online / Active Status"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs text-slate-500",
											children: "Allow other room members to see green active indicator"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "relative inline-flex items-center cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: showOnline,
												onChange: (e) => setShowOnline(e.target.checked),
												className: "sr-only peer"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900" })]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2 flex items-center justify-between",
								children: [saveSuccess && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs font-bold text-emerald-600 flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4" }), " Preferences saved successfully"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: isSaving,
									className: "ml-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer",
									children: isSaving ? "Saving..." : "Save All Preferences"
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "font-bold text-slate-900 text-sm flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "w-4 h-4 text-rose-600" }), "Location History & Ephemeral Data Control"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500 mt-1 max-w-xl leading-relaxed",
						children: "Beacon stores GPS breadcrumbs ephemerally (max 24 hours) for live movement trails. Coordinates older than 24 hours are automatically purged by the server. You can also purge all your stored breadcrumbs immediately at any time."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setShowPurgeConfirmModal(true),
						className: "px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4 text-rose-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Purge Location History" })]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, { className: "w-4 h-4 text-indigo-600" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-slate-900 text-sm",
								children: "Active Devices & Authorized Sessions"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold",
								children: [sessions.length, " Active"]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500 mt-0.5",
						children: "Manage all phones, tablets, and computers currently authenticated with your Beacon credentials."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: loadSessions,
							disabled: loadingSessions,
							className: "p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer",
							title: "Refresh session list",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-4 h-4 ${loadingSessions ? "animate-spin" : ""}` })
						}), sessions.filter((s) => !s.isCurrent).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleRevokeOtherSessions,
							className: "px-3.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer",
							children: "Log Out All Other Devices"
						})]
					})]
				}), sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl",
					children: "Loading active sessions..."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2.5",
					children: sessions.map((s) => {
						const isCurrent = s.isCurrent;
						const formattedDate = new Date(s.createdAt).toLocaleDateString([], {
							month: "short",
							day: "numeric",
							hour: "2-digit",
							minute: "2-digit"
						});
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${isCurrent ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-300/40" : "bg-slate-50/80 border-slate-200"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `p-2.5 rounded-xl ${isCurrent ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"} shrink-0`,
									children: s.userAgent?.includes("Mobile") || s.userAgent?.includes("Android") || s.userAgent?.includes("iPhone") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "w-4 h-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, { className: "w-4 h-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-slate-900 text-xs truncate",
											children: s.userAgent || "Web / Mobile Client"
										}), isCurrent && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider shrink-0",
											children: "Current Device"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["IP: ", s.ip || "Localhost"] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Signed in: ", formattedDate] })
										]
									})]
								})]
							}), !isCurrent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleRevokeSession(s.token),
								className: "px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl border border-rose-200 transition-colors shrink-0 cursor-pointer",
								children: "Revoke"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-slate-400 font-medium px-2 shrink-0",
								children: "Active"
							})]
						}, s.token);
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserX, { className: "w-4 h-4 text-rose-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-bold text-slate-900 text-sm",
							children: [
								"Blocked Users (",
								blockedUsers.length,
								")"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500 mt-0.5",
						children: "Blocked users cannot send you direct messages, see your live location coordinates, or view your online presence."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: loadBlockedUsers,
						className: "p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer",
						title: "Refresh blocked users",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-4 h-4 ${loadingBlocked ? "animate-spin" : ""}` })
					})]
				}), blockedUsers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl",
					children: "You haven't blocked any users. You can block any member directly from room rosters or chat profiles."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: blockedUsers.map((bUser) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: bUser.avatarUrl,
								alt: bUser.fullName,
								className: "w-9 h-9 rounded-full object-cover border border-slate-200"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-slate-900 text-xs block",
								children: bUser.fullName
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-slate-500 font-mono",
								children: ["@", bUser.username]
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleUnblockUser(bUser.id, bUser.fullName),
							className: "px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer",
							children: "Unblock"
						})]
					}, bUser.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-700 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-5 h-5 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-white text-sm",
							children: "Security & Cryptographic Standards"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-slate-400",
							children: "Specification v1.0 Architectural Hardening"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded-full border border-emerald-500/30",
						children: "PASSED 26/26"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-2xl bg-white/5 border border-white/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-cyan-300 block mb-1",
								children: "OWASP PBKDF2 Hashing"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-slate-300 text-[11px] leading-relaxed",
								children: "100,000 iterations of SHA-512 with per-user cryptographic salts. Passwords never stored in plaintext."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-2xl bg-white/5 border border-white/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-emerald-300 block mb-1",
								children: "Server-Authoritative RBAC"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-slate-300 text-[11px] leading-relaxed",
								children: "Object-level permissions strictly checked on every room message, voice channel, and GPS broadcast."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-2xl bg-white/5 border border-white/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-amber-300 block mb-1",
								children: "Rate Limiting & DDoS Defense"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-slate-300 text-[11px] leading-relaxed",
								children: "Token-bucket rate limiters enforce throttling on authentication (10 req/15m) and emergency broadcasts."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-2xl bg-white/5 border border-white/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-purple-300 block mb-1",
								children: "Upload Sandboxing & XSS Filter"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-slate-300 text-[11px] leading-relaxed",
								children: "Strict MIME-type validation, 10MB file limit, UUID renaming, and script-tag stripping on all channels."
							})]
						})
					]
				})]
			}),
			showPurgeConfirmModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-3 rounded-2xl bg-rose-100 text-rose-600",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-6 h-6" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-base text-slate-900",
								children: "Purge Stored Location History?"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-500",
								children: "This action cannot be undone."
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-600 leading-relaxed",
							children: "All of your historical location breadcrumbs and movement trails recorded across all rooms will be permanently deleted from the server database."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2.5 pt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowPurgeConfirmModal(false),
								className: "px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled: isPurgingHistory,
								onClick: handlePurgeLocationHistory,
								className: "px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer flex items-center gap-1.5",
								children: [isPurgingHistory ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "w-3.5 h-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isPurgingHistory ? "Purging..." : "Confirm Purge" })]
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "font-bold text-slate-900 text-sm mb-1 flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-blue-600" }),
							"Location Sharing Requests (",
							shareRequests.filter((r) => r.status === "pending").length,
							" Pending)"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500 mb-4",
						children: "People requesting direct access to your live location. You can approve permanently, grant temporary 1-hour access, or decline."
					}),
					shareRequests.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl",
						children: "No pending location sharing requests."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-3",
						children: shareRequests.map((req) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: req.fromUserAvatar,
									alt: req.fromUserName,
									className: "w-10 h-10 rounded-full object-cover border border-slate-200"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-slate-900 text-sm block",
									children: req.fromUserName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-slate-500",
									children: ["Requested location · Status: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: req.status })]
								})] })]
							}), req.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handleRespondRequest(req.id, "accepted"),
										className: "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl",
										children: "Allow"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handleRespondRequest(req.id, "temporary"),
										className: "px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl",
										children: "Allow 1 Hour"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handleRespondRequest(req.id, "denied"),
										className: "px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl",
										children: "Deny"
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold",
								children: req.status === "temporary" ? "Active for 1hr" : req.status
							})]
						}, req.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-bold text-slate-900 text-sm flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-4 h-4 text-amber-500" }), "Emergency & Community Push Notifications"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 mt-1 max-w-md",
							children: "Receive high-priority notifications for emergency SOS broadcasts, group reminders near saved places, and direct messages."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 text-xs font-mono text-slate-400",
							children: ["Current browser status: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-slate-700 uppercase",
								children: notificationPermission
							})]
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2",
						children: notificationPermission !== "granted" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleRequestNotifications,
							className: "px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-colors active:scale-95",
							children: "Enable Notifications"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => notifications.notifyEmergency(user?.fullName || "Self", "Test Beacon notification delivery check"),
							className: "px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors",
							children: "Send Test Alert"
						})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md border border-slate-700",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-3 bg-white/10 rounded-2xl shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "w-6 h-6 text-sky-400" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-white text-sm flex items-center gap-2",
							children: "Install Beacon on Your Device"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-300 mt-1 max-w-md leading-relaxed",
							children: "Install as a full Progressive Web App on Android, iOS, or Desktop for standalone mode, offline cache access, and rapid home-screen launch."
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PWAInstallButton, {})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `${themeConfig.glassPanel} rounded-3xl p-6 border ${themeConfig.glassBorder} shadow-xl backdrop-blur-2xl space-y-4`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `p-2.5 rounded-2xl ${themeConfig.accentBg} text-white shadow-md`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "w-5 h-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: `font-bold text-sm ${themeConfig.textPrimary}`,
									children: "Native Android APK Packaging"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
									children: "CAPACITOR CONFIGURED"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: `text-xs ${themeConfig.textSecondary} mt-0.5`,
								children: [
									"Package ID: ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-cyan-400",
										children: "com.beacon.mesh"
									}),
									" · App Name: ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold",
										children: "Beacon"
									})
								]
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Server Proxy Secured" })]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: `text-xs ${themeConfig.textSecondary} leading-relaxed`,
						children: [
							"The standalone native Android project has been scaffolded under ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
								className: "px-1.5 py-0.5 rounded bg-black/40 font-mono text-cyan-300",
								children: "/android"
							}),
							" with full permissions for GPS coordinates, microphone audio notes, and WebSocket mesh networking."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk",
						download: true,
						className: "w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-4 h-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Download Latest Android APK (app-debug.apk)" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2 pt-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} flex items-center justify-between gap-3`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center shrink-0",
										children: "1"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "truncate",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: `text-xs font-semibold ${themeConfig.textPrimary}`,
											children: "Sync Web Assets to Native Android"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
											className: "text-[11px] text-cyan-300 font-mono truncate block",
											children: "npm run cap:sync"
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										navigator.clipboard.writeText("npm run cap:sync");
										toast.success("Command copied: npm run cap:sync");
									},
									className: "p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0",
									title: "Copy Command",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} flex items-center justify-between gap-3`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center shrink-0",
										children: "2"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "truncate",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: `text-xs font-semibold ${themeConfig.textPrimary}`,
											children: "Assemble Standalone Debug APK"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
											className: "text-[11px] text-cyan-300 font-mono truncate block",
											children: "cd android && ./gradlew assembleDebug"
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										navigator.clipboard.writeText("cd android && ./gradlew assembleDebug");
										toast.success("Command copied: cd android && ./gradlew assembleDebug");
									},
									className: "p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0",
									title: "Copy Command",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3 rounded-2xl ${themeConfig.glassCard} border ${themeConfig.glassBorder} flex items-center justify-between gap-3`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center shrink-0",
										children: "3"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "truncate",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: `text-xs font-semibold ${themeConfig.textPrimary}`,
											children: "Install on Physical Android Device via ADB"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
											className: "text-[11px] text-cyan-300 font-mono truncate block",
											children: "adb install -r android/app/build/outputs/apk/debug/app-debug.apk"
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										navigator.clipboard.writeText("adb install -r android/app/build/outputs/apk/debug/app-debug.apk");
										toast.success("Command copied ADB install string");
									},
									className: "p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0",
									title: "Copy Command",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 text-slate-400",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "w-3.5 h-3.5 text-cyan-400 shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Output Path:" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "text-cyan-300 font-mono truncate",
									children: "android/app/build/outputs/apk/debug/app-debug.apk"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-emerald-400 font-medium",
							children: "✓ Zero plaintext keys in client APK"
						})]
					})
				]
			})
		]
	});
};
export { ProfilePrivacyView };
