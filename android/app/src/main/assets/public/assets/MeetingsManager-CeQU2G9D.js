import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { Bt as Check, Ft as CircleQuestionMark, R as Plus, Ut as Calendar, c as Users, en as require_react, n as X, nt as MapPin } from "./vendor-icons-PxteBMrr.js";
import { a as api, i as useAuth, n as useToast } from "./ToastContext-ziKLJ15f.js";
// src/components/Meetings/MeetingsManager.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var MeetingsManager = ({ rooms }) => {
	const { user } = useAuth();
	const toast = useToast();
	const [meetings, setMeetings] = (0, import_react.useState)([]);
	const [showAddModal, setShowAddModal] = (0, import_react.useState)(false);
	const [roomId, setRoomId] = (0, import_react.useState)(rooms[0]?.id || "");
	const [title, setTitle] = (0, import_react.useState)("");
	const [desc, setDesc] = (0, import_react.useState)("");
	const [date, setDate] = (0, import_react.useState)("");
	const [time, setTime] = (0, import_react.useState)("");
	const [locationName, setLocationName] = (0, import_react.useState)("");
	const loadMeetings = async () => {
		try {
			const res = await api.get("/api/meetings");
			setMeetings(res.meetings);
		} catch (err) {
			console.warn("Could not load meetings:", err);
		}
	};
	(0, import_react.useEffect)(() => {
		loadMeetings();
	}, []);
	const handleCreateMeeting = async (e) => {
		e.preventDefault();
		try {
			const res = await api.post("/api/meetings", {
				roomId,
				title,
				description: desc,
				date,
				time,
				locationName,
				attendees: [{
					userId: user?.id || "",
					status: "accepted"
				}]
			});
			setMeetings((prev) => [...prev, res.meeting]);
			setShowAddModal(false);
			setTitle("");
			setDesc("");
			setDate("");
			setTime("");
			setLocationName("");
			toast.success("Meeting scheduled");
		} catch (err) {
			toast.error(err.message || "Failed to schedule meeting");
		}
	};
	const handleRsvp = async (meetingId, status) => {
		try {
			const res = await api.post(`/api/meetings/${meetingId}/rsvp`, { status });
			setMeetings((prev) => prev.map((m) => m.id === meetingId ? res.meeting : m));
			toast.success(`RSVP updated: ${status}`);
		} catch (err) {
			toast.error(err.message || "RSVP failed");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-bold text-slate-900 text-lg",
					children: "Room Meetings"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-slate-500",
					children: "Plan meetups, check-ins and emergency rendezvous points"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setShowAddModal(true),
					className: "px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" }), "Schedule Meeting"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 md:grid-cols-2 gap-4",
				children: meetings.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "w-10 h-10 text-slate-300 mx-auto mb-2" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-700 text-sm",
							children: "No Scheduled Meetings"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 mt-1",
							children: "Create a meeting for your room to sync coordinates and timing."
						})
					]
				}) : meetings.map((m) => {
					const myRsvp = m.attendees?.find((a) => a.userId === user?.id)?.status;
					const acceptedCount = m.attendees?.filter((a) => a.status === "accepted").length || 0;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "font-bold text-slate-900 text-base",
								children: m.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-600 mt-0.5",
								children: m.description || "No description provided"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5 text-xs text-slate-600",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "w-4 h-4 text-blue-500 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											m.date,
											" at ",
											m.time
										] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-rose-500 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-slate-900",
											children: m.locationName
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4 text-slate-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Organized by ",
											m.creatorName,
											" · ",
											acceptedCount,
											" attending"
										] })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-3 border-t border-slate-100 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] font-semibold text-slate-500",
									children: "Your RSVP:"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => handleRsvp(m.id, "accepted"),
											className: `px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${myRsvp === "accepted" ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" }), "Accept"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => handleRsvp(m.id, "tentative"),
											className: `px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${myRsvp === "tentative" ? "bg-amber-600 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "w-3.5 h-3.5" }), "Maybe"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => handleRsvp(m.id, "declined"),
											className: `px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${myRsvp === "declined" ? "bg-rose-600 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" }), "Decline"]
										})
									]
								})]
							})
						]
					}, m.id);
				})
			}),
			showAddModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: { colorScheme: "light" },
					className: "bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-lg text-slate-950 mb-1",
							children: "Schedule Room Meeting"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-600 mb-4 font-medium",
							children: "Set a date, time, and physical meeting location for room members."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleCreateMeeting,
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1",
									children: "Room"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: roomId,
									onChange: (e) => setRoomId(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light"
									},
									className: "w-full px-3 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm",
									children: rooms.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: r.id,
										children: r.name
									}, r.id))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1",
									children: "Meeting Title"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									required: true,
									placeholder: "e.g. Weekly Family Dinner / Team Sync",
									value: title,
									onChange: (e) => setTitle(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-bold text-slate-950 mb-1",
										children: "Date"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "date",
										required: true,
										value: date,
										onChange: (e) => setDate(e.target.value),
										style: {
											color: "#090d16",
											backgroundColor: "#ffffff",
											colorScheme: "light",
											WebkitTextFillColor: "#090d16"
										},
										className: "w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-bold text-slate-950 mb-1",
										children: "Time"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "time",
										required: true,
										value: time,
										onChange: (e) => setTime(e.target.value),
										style: {
											color: "#090d16",
											backgroundColor: "#ffffff",
											colorScheme: "light",
											WebkitTextFillColor: "#090d16"
										},
										className: "w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1",
									children: "Location Name or Address"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									required: true,
									placeholder: "e.g. 124 Market St, Community Hall",
									value: locationName,
									onChange: (e) => setLocationName(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1",
									children: "Description"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									rows: 2,
									placeholder: "Meeting agenda or details",
									value: desc,
									onChange: (e) => setDesc(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-3 flex items-center justify-end gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setShowAddModal(false),
										className: "px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl",
										children: "Cancel"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm",
										children: "Create Meeting"
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
export { MeetingsManager };
