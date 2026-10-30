import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { Bt as Check, Jt as Bell, Nt as Clock, R as Plus, en as require_react, nt as MapPin, p as Trash2 } from "./vendor-icons-PxteBMrr.js";
import { a as api, i as useAuth, j as isWithinRadius, n as useToast } from "./ToastContext-ziKLJ15f.js";
import { d as useRealtime, m as sound } from "./index-Beu_4vAP.js";
// src/components/Reminders/RemindersManager.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var RemindersManager = ({ savedPlaces = [], pendingReminder = null, onClearPendingReminder }) => {
	const { user } = useAuth();
	const { myLocation } = useRealtime();
	const toast = useToast();
	const [reminders, setReminders] = (0, import_react.useState)([]);
	const [showAddModal, setShowAddModal] = (0, import_react.useState)(false);
	const [title, setTitle] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [dueDateTime, setDueDateTime] = (0, import_react.useState)("");
	const [isGeofenced, setIsGeofenced] = (0, import_react.useState)(false);
	const [selectedPlaceId, setSelectedPlaceId] = (0, import_react.useState)("");
	const [customLocationCoords, setCustomLocationCoords] = (0, import_react.useState)(null);
	const [triggeredAlerts, setTriggeredAlerts] = (0, import_react.useState)([]);
	const loadReminders = async () => {
		try {
			const res = await api.get("/api/reminders");
			setReminders(res.reminders);
		} catch (err) {
			console.warn("Could not load reminders:", err);
		}
	};
	(0, import_react.useEffect)(() => {
		loadReminders();
	}, []);
	(0, import_react.useEffect)(() => {
		if (pendingReminder) {
			setTitle(pendingReminder.title ? `Reminder: ${pendingReminder.title}` : "Location Reminder");
			setDescription(`Geofence alert created from map marker`);
			setIsGeofenced(true);
			setSelectedPlaceId("");
			setCustomLocationCoords({
				lat: pendingReminder.lat,
				lng: pendingReminder.lng,
				radiusMeters: 150,
				name: pendingReminder.title || "Selected Map Location"
			});
			setShowAddModal(true);
			if (onClearPendingReminder) onClearPendingReminder();
		}
	}, [pendingReminder, onClearPendingReminder]);
	(0, import_react.useEffect)(() => {
		if (!myLocation || reminders.length === 0) return;
		reminders.forEach(async (rem) => {
			if (rem.isGeofenced && !rem.hasTriggered && rem.locationCoords) {
				if (isWithinRadius(myLocation.latitude, myLocation.longitude, rem.locationCoords.lat, rem.locationCoords.lng, rem.locationCoords.radiusMeters)) {
					sound.playChime();
					setTriggeredAlerts((prev) => [...prev, rem]);
					try {
						await api.put(`/api/reminders/${rem.id}/trigger`);
						setReminders((prev) => prev.map((r) => r.id === rem.id ? {
							...r,
							hasTriggered: true
						} : r));
					} catch (e) {
						console.error("Error triggering reminder on server:", e);
					}
				}
			}
		});
	}, [myLocation, reminders]);
	const handleCreateReminder = async (e) => {
		e.preventDefault();
		let locationCoords = void 0;
		let locationName = void 0;
		if (isGeofenced && selectedPlaceId) {
			const place = savedPlaces.find((p) => p.id === selectedPlaceId);
			if (place) {
				locationName = place.name;
				locationCoords = {
					lat: place.latitude,
					lng: place.longitude,
					radiusMeters: place.radiusMeters
				};
			}
		} else if (isGeofenced && customLocationCoords) {
			locationName = customLocationCoords.name || title || "Map Marker Point";
			locationCoords = {
				lat: customLocationCoords.lat,
				lng: customLocationCoords.lng,
				radiusMeters: customLocationCoords.radiusMeters
			};
		}
		try {
			const res = await api.post("/api/reminders", {
				title,
				description,
				dueDateTime: dueDateTime || new Date(Date.now() + 36e5).toISOString(),
				isGeofenced,
				locationId: selectedPlaceId || void 0,
				locationName,
				locationCoords,
				repeat: "never"
			});
			setReminders((prev) => [...prev, res.reminder]);
			setShowAddModal(false);
			setTitle("");
			setDescription("");
			setDueDateTime("");
			setIsGeofenced(false);
			setSelectedPlaceId("");
			setCustomLocationCoords(null);
			toast.success("Reminder scheduled");
		} catch (err) {
			toast.error(err.message || "Failed to create reminder");
		}
	};
	const handleDelete = async (id) => {
		try {
			await api.delete(`/api/reminders/${id}`);
			setReminders((prev) => prev.filter((r) => r.id !== id));
			toast.success("Reminder removed");
		} catch (err) {
			toast.error(err.message || "Failed to delete reminder");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-bold text-slate-900 text-lg",
					children: "Reminders & Geofences"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-slate-500",
					children: "Time-based tasks and «Remind me when I reach this location» triggers"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setShowAddModal(true),
					className: "px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" }), "Add Reminder"]
				})]
			}),
			triggeredAlerts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-emerald-600" }), "Location Geofence Reached!"]
				}), triggeredAlerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between text-xs text-emerald-900",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: a.title }),
						" at ",
						a.locationName
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setTriggeredAlerts((prev) => prev.filter((item) => item.id !== a.id)),
						className: "text-[10px] text-emerald-700 underline",
						children: "Dismiss"
					})]
				}, a.id))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: reminders.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-10 h-10 text-slate-300 mx-auto mb-2" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-700 text-sm",
							children: "No Active Reminders"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 mt-1",
							children: "Add reminders with custom dates or location triggers."
						})
					]
				}) : reminders.map((rem) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `p-4 bg-white rounded-2xl border shadow-sm flex items-start justify-between transition-colors ${rem.hasTriggered ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `p-2.5 rounded-xl ${rem.isGeofenced ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-700"}`,
							children: rem.isGeofenced ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-5 h-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-5 h-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "font-bold text-slate-900 text-sm",
									children: rem.title
								}), rem.hasTriggered && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold",
									children: "Triggered"
								})]
							}),
							rem.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-600 mt-0.5",
								children: rem.description
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex items-center gap-3 text-[11px] text-slate-500",
								children: [
									rem.isGeofenced && rem.locationName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-center gap-1 text-blue-600 font-medium",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3 h-3" }),
											" When entering ",
											rem.locationName
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(rem.dueDateTime).toLocaleString() })
								]
							})
						] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => handleDelete(rem.id),
						className: "p-2 text-rose-600 hover:bg-rose-50 rounded-xl",
						title: "Delete",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4" })
					})]
				}, rem.id))
			}),
			showAddModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: { colorScheme: "light" },
					className: "bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-lg text-slate-950 mb-1",
							children: "New Reminder"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-600 mb-4 font-medium",
							children: "Schedule time notifications or geofenced proximity triggers."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleCreateReminder,
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1",
									children: "Title"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									required: true,
									placeholder: "e.g. Check in with team / Call mom upon arrival",
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
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold text-slate-950 mb-1",
									children: "Description"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "Extra instructions or details",
									value: description,
									onChange: (e) => setDescription(e.target.value),
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
									children: "Date & Time"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "datetime-local",
									value: dueDateTime,
									onChange: (e) => setDueDateTime(e.target.value),
									style: {
										color: "#090d16",
										backgroundColor: "#ffffff",
										colorScheme: "light",
										WebkitTextFillColor: "#090d16"
									},
									className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex items-center gap-2 cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: isGeofenced,
											onChange: (e) => setIsGeofenced(e.target.checked),
											className: "w-4 h-4 rounded text-blue-600 accent-slate-900"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-bold text-slate-800",
											children: "«Remind me when I reach this location»"
										})]
									}), isGeofenced && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2",
										children: [customLocationCoords && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "p-2.5 bg-blue-100/70 border border-blue-300/80 rounded-xl flex items-center justify-between text-xs text-blue-900",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-blue-600 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold",
													children: customLocationCoords.name || "Pinned Location"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "block text-[10px] text-blue-700 font-mono",
													children: [
														customLocationCoords.lat.toFixed(5),
														", ",
														customLocationCoords.lng.toFixed(5),
														" (",
														customLocationCoords.radiusMeters,
														"m radius)"
													]
												})] })]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setCustomLocationCoords(null),
												className: "text-[10px] text-blue-700 hover:text-blue-950 font-semibold underline",
												children: "Change"
											})]
										}), !customLocationCoords && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "block text-xs font-semibold text-blue-900",
											children: "Choose Target Location"
										}), savedPlaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-amber-700",
											children: "No saved locations found. Please save a place in \"Saved Places\" first or set reminder from map markers."
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: selectedPlaceId,
											onChange: (e) => setSelectedPlaceId(e.target.value),
											required: isGeofenced && !customLocationCoords,
											className: "w-full px-3 py-2 bg-white rounded-xl border border-blue-200 text-xs text-slate-800",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "",
												children: "Select a saved location..."
											}), savedPlaces.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
												value: p.id,
												children: [
													p.name,
													" (",
													p.radiusMeters,
													"m radius)"
												]
											}, p.id))]
										})] })]
									})]
								}),
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
										children: "Set Reminder"
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
export { RemindersManager };
