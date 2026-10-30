import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { Dt as Download, P as RotateCcw, St as FileText, T as ShieldAlert, en as require_react, j as Search, yt as Funnel } from "./vendor-icons-PxteBMrr.js";
import { a as api, i as useAuth, n as useToast } from "./ToastContext-ziKLJ15f.js";
// src/components/Admin/AdminDashboard.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var AdminDashboard = () => {
	const { user } = useAuth();
	const toast = useToast();
	const [stats, setStats] = (0, import_react.useState)(null);
	const [usersList, setUsersList] = (0, import_react.useState)([]);
	const [roomsList, setRoomsList] = (0, import_react.useState)([]);
	const [reportsList, setReportsList] = (0, import_react.useState)([]);
	const [logsList, setLogsList] = (0, import_react.useState)([]);
	const [activeTab, setActiveTab] = (0, import_react.useState)("overview");
	const [isLoading, setIsLoading] = (0, import_react.useState)(true);
	const [logActionFilter, setLogActionFilter] = (0, import_react.useState)("ALL");
	const [logUserFilter, setLogUserFilter] = (0, import_react.useState)("");
	const [logSearchQuery, setLogSearchQuery] = (0, import_react.useState)("");
	const [userSearchQuery, setUserSearchQuery] = (0, import_react.useState)("");
	const [userRoleFilter, setUserRoleFilter] = (0, import_react.useState)("all");
	const [roomSearchQuery, setRoomSearchQuery] = (0, import_react.useState)("");
	const [roomTypeFilter, setRoomTypeFilter] = (0, import_react.useState)("all");
	const loadAdminData = async () => {
		try {
			setIsLoading(true);
			const res = await api.get("/api/admin/stats");
			setStats(res.stats);
			setUsersList(res.users);
			setRoomsList(res.rooms);
			setReportsList(res.reports);
			setLogsList(res.logs);
		} catch (err) {
			console.error("Failed to load admin telemetry:", err);
		} finally {
			setIsLoading(false);
		}
	};
	(0, import_react.useEffect)(() => {
		loadAdminData();
	}, []);
	const handleResolveReport = async (id, status) => {
		try {
			await api.post(`/api/admin/reports/${id}/resolve`, { status });
			setReportsList((prev) => prev.map((r) => r.id === id ? {
				...r,
				status
			} : r));
			toast.success(`Report ${status}`);
		} catch (err) {
			toast.error(err.message || "Action failed");
		}
	};
	const availableActionTypes = (0, import_react.useMemo)(() => {
		const set = /* @__PURE__ */ new Set();
		logsList.forEach((l) => {
			const prefix = l.action.split(":")[0] || l.action;
			set.add(prefix);
		});
		return Array.from(set).sort();
	}, [logsList]);
	const filteredLogs = (0, import_react.useMemo)(() => {
		return logsList.filter((log) => {
			if (logActionFilter !== "ALL") {
				if (!log.action.startsWith(logActionFilter)) return false;
			}
			if (logUserFilter.trim()) {
				const uQuery = logUserFilter.toLowerCase().trim();
				if (!(log.userName.toLowerCase().includes(uQuery) || log.userId.toLowerCase().includes(uQuery))) return false;
			}
			if (logSearchQuery.trim()) {
				const sQuery = logSearchQuery.toLowerCase().trim();
				if (!(log.details.toLowerCase().includes(sQuery) || log.action.toLowerCase().includes(sQuery))) return false;
			}
			return true;
		});
	}, [
		logsList,
		logActionFilter,
		logUserFilter,
		logSearchQuery
	]);
	const filteredUsers = (0, import_react.useMemo)(() => {
		return usersList.filter((u) => {
			if (userRoleFilter === "admin" && !u.isAdmin) return false;
			if (userRoleFilter === "online" && !u.isOnline) return false;
			if (userSearchQuery.trim()) {
				const q = userSearchQuery.toLowerCase().trim();
				return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
			}
			return true;
		});
	}, [
		usersList,
		userRoleFilter,
		userSearchQuery
	]);
	const filteredRooms = (0, import_react.useMemo)(() => {
		return roomsList.filter((r) => {
			if (roomTypeFilter === "protected" && !r.hasPassword) return false;
			if (roomTypeFilter === "open" && r.hasPassword) return false;
			if (roomSearchQuery.trim()) {
				const q = roomSearchQuery.toLowerCase().trim();
				return r.name.toLowerCase().includes(q) || r.description && r.description.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
			}
			return true;
		});
	}, [
		roomsList,
		roomTypeFilter,
		roomSearchQuery
	]);
	const exportLogsAsJson = () => {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
		const downloadAnchor = document.createElement("a");
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `beacon-audit-logs-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
	};
	if (!user?.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "h-full flex flex-col items-center justify-center p-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-12 h-12 text-rose-500 mb-3" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-bold text-slate-900 text-lg",
				children: "Administrator Access Required"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-slate-500 mt-1 max-w-sm",
				children: "This system console is restricted to platform administrators with authenticated clearance."
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "font-bold text-slate-900 text-xl flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-5 h-5 text-indigo-600" }), "System Administration & Audit"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-slate-500",
					children: "Real-time platform oversight, room moderation, abuse reports and immutable audit trail"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: loadAdminData,
						className: "px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: `w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}` }), "Refresh Data"]
					})
				})]
			}),
			stats && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-semibold text-slate-500 block",
							children: "Total Users"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-2xl font-black text-slate-900 tabular-nums",
							children: stats.totalUsers
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-semibold text-emerald-600 block",
							children: "Online Now"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-2xl font-black text-emerald-600 tabular-nums",
							children: stats.onlineUsers
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-semibold text-slate-500 block",
							children: "Private Rooms"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-2xl font-black text-slate-900 tabular-nums",
							children: stats.totalRooms
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-semibold text-slate-500 block",
							children: "Messages Sent"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-2xl font-black text-slate-900 tabular-nums",
							children: stats.totalMessages
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-semibold text-rose-600 block",
							children: "Active SOS"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-2xl font-black text-rose-600 tabular-nums",
							children: stats.activeAlerts
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-semibold text-amber-600 block",
							children: "Pending Reports"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-2xl font-black text-amber-600 tabular-nums",
							children: stats.pendingReports
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto",
				children: [
					"overview",
					"users",
					"rooms",
					"reports",
					"logs"
				].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setActiveTab(tab),
					className: `px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors shrink-0 ${activeTab === tab ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"}`,
					children: [
						tab,
						tab === "logs" && ` (${logsList.length})`,
						tab === "reports" && reportsList.length > 0 && ` (${reportsList.length})`
					]
				}, tab))
			}),
			activeTab === "users" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "font-bold text-sm text-slate-900",
						children: [
							"Registered Users (",
							filteredUsers.length,
							" of ",
							usersList.length,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "Search user, @username, email...",
								value: userSearchQuery,
								onChange: (e) => setUserSearchQuery(e.target.value),
								className: "pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-56"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: userRoleFilter,
							onChange: (e) => setUserRoleFilter(e.target.value),
							className: "px-2.5 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-700 focus:outline-none font-semibold",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "all",
									children: "All Status"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "online",
									children: "Online Only"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "admin",
									children: "Admins Only"
								})
							]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "divide-y divide-slate-100 max-h-[600px] overflow-y-auto",
					children: filteredUsers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-8 text-center text-slate-400 text-xs",
						children: "No users match your filter query."
					}) : filteredUsers.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 flex items-center justify-between hover:bg-slate-50 transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: u.avatarUrl,
								alt: "",
								className: "w-10 h-10 rounded-full object-cover border border-slate-200"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-sm text-slate-900",
											children: u.fullName
										}),
										u.isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded",
											children: "ADMIN"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `w-2 h-2 rounded-full ${u.isOnline ? "bg-emerald-500" : "bg-slate-300"}` })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-slate-500 font-mono",
									children: [
										"@",
										u.username,
										" · ",
										u.email
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[11px] text-slate-400 mt-0.5 font-mono",
									children: ["ID: ", u.id]
								})
							] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right text-xs text-slate-500",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `block font-medium ${u.isOnline ? "text-emerald-600 font-bold" : ""}`,
								children: u.isOnline ? "Active Now" : "Offline"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Joined ", new Date(u.createdAt).toLocaleDateString()] })]
						})]
					}, u.id))
				})]
			}),
			activeTab === "rooms" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "font-bold text-sm text-slate-900",
						children: [
							"Active Rooms (",
							filteredRooms.length,
							" of ",
							roomsList.length,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "Search room name or ID...",
								value: roomSearchQuery,
								onChange: (e) => setRoomSearchQuery(e.target.value),
								className: "pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-52"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: roomTypeFilter,
							onChange: (e) => setRoomTypeFilter(e.target.value),
							className: "px-2.5 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-700 focus:outline-none font-semibold",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "all",
									children: "All Rooms"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "protected",
									children: "Password Protected"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "open",
									children: "Open Rooms"
								})
							]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "divide-y divide-slate-100 max-h-[600px] overflow-y-auto",
					children: filteredRooms.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-8 text-center text-slate-400 text-xs",
						children: "No rooms found."
					}) : filteredRooms.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 flex items-center justify-between hover:bg-slate-50 transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "font-bold text-slate-900 text-sm",
								children: r.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-500",
								children: r.description || "No description provided"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-slate-400 font-mono mt-1 block",
								children: ["ID: ", r.id]
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right text-xs text-slate-600",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-bold block text-slate-900",
								children: [r.memberCount, " members"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `text-[11px] ${r.hasPassword ? "text-amber-600 font-medium" : "text-slate-400"}`,
								children: r.hasPassword ? "🔒 Protected" : "🌐 Open"
							})]
						})]
					}, r.id))
				})]
			}),
			activeTab === "reports" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-b border-slate-100 font-bold text-sm",
					children: [
						"Abuse & Spam Moderation Queue (",
						reportsList.length,
						")"
					]
				}), reportsList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "p-8 text-center text-slate-400 text-xs",
					children: "No pending moderation reports."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "divide-y divide-slate-100",
					children: reportsList.map((rep) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 flex items-start justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-bold text-sm text-slate-900",
									children: [
										"Reported ",
										rep.targetType,
										": ",
										rep.targetId
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800",
									children: rep.status
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-slate-600 mt-1",
								children: [
									"Reason: \"",
									rep.reason,
									"\""
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] text-slate-400 block mt-1",
								children: [
									"Reported by ",
									rep.reporterName,
									" on ",
									new Date(rep.timestamp).toLocaleString()
								]
							})
						] }), rep.status === "pending" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleResolveReport(rep.id, "reviewed"),
								className: "px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors",
								children: "Mark Reviewed"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => handleResolveReport(rep.id, "dismissed"),
								className: "px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors",
								children: "Dismiss"
							})]
						})]
					}, rep.id))
				})]
			}),
			(activeTab === "overview" || activeTab === "logs") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 border-b border-slate-100 space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "font-bold text-sm text-slate-900 flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "w-4 h-4 text-slate-500" }),
								"Security & System Audit Log",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs font-normal text-slate-500 font-mono",
									children: [
										"(",
										filteredLogs.length,
										" / ",
										logsList.length,
										" events)"
									]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: exportLogsAsJson,
								title: "Export filtered logs to JSON",
								className: "flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Export JSON" })]
							}), (logActionFilter !== "ALL" || logUserFilter || logSearchQuery) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setLogActionFilter("ALL");
									setLogUserFilter("");
									setLogSearchQuery("");
								},
								className: "text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1",
								children: "Reset Filters"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "w-3.5 h-3.5 text-slate-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: logActionFilter,
									onChange: (e) => setLogActionFilter(e.target.value),
									className: "bg-transparent text-xs text-slate-800 w-full focus:outline-none font-medium cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "ALL",
										children: "All Action Categories"
									}), availableActionTypes.map((action) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: action,
										children: [action, " events"]
									}, action))]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "Filter by User Name or ID...",
									value: logUserFilter,
									onChange: (e) => setLogUserFilter(e.target.value),
									className: "w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "Search log keywords & details...",
									value: logSearchQuery,
									onChange: (e) => setLogSearchQuery(e.target.value),
									className: "w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
								})]
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "divide-y divide-slate-100 font-mono text-xs max-h-[500px] overflow-y-auto",
					children: filteredLogs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-8 text-center text-slate-400 text-xs",
						children: "No audit log entries match the selected filters."
					}) : filteredLogs.slice(0, activeTab === "overview" ? 30 : 150).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 hover:bg-slate-50 transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-slate-400 text-[11px] shrink-0",
									children: [
										"[",
										new Date(l.timestamp).toLocaleTimeString(),
										"]"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${l.action.startsWith("ALERT") ? "bg-rose-100 text-rose-800" : l.action.startsWith("AUTH") ? "bg-blue-100 text-blue-800" : l.action.startsWith("ROOM") ? "bg-emerald-100 text-emerald-800" : l.action.startsWith("PRIVACY") ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700"}`,
									children: l.action
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-slate-800 break-all",
									children: l.details
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 shrink-0 self-end sm:self-auto text-slate-400 text-[11px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-slate-600",
								children: l.userName
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px]",
								children: [
									"(",
									l.userId.slice(0, 8),
									")"
								]
							})]
						})]
					}, l.id))
				})]
			})
		]
	});
};
export { AdminDashboard };
