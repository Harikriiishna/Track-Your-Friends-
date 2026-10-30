import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { Bt as Check, R as Plus, en as require_react, ht as Heart, jt as Compass, p as Trash2 } from "./vendor-icons-PxteBMrr.js";
import { a as api, i as useAuth, n as useToast } from "./ToastContext-ziKLJ15f.js";
import { a as getLocationTypeEmoji, d as useRealtime, n as LOCATION_TYPES, r as MARKER_COLORS } from "./index-Beu_4vAP.js";
// src/components/SavedPlaces/SavedPlacesManager.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var SavedPlacesManager = ({ savedPlaces, onRefreshSavedPlaces, onFocusMapLocation, pendingCoords, onClearPendingCoords }) => {
	const { user } = useAuth();
	const { myLocation } = useRealtime();
	const toast = useToast();
	const [places, setPlaces] = (0, import_react.useState)(savedPlaces || []);
	const [showAddModal, setShowAddModal] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [desc, setDesc] = (0, import_react.useState)("");
	const [latitude, setLatitude] = (0, import_react.useState)("");
	const [longitude, setLongitude] = (0, import_react.useState)("");
	const [radiusMeters, setRadiusMeters] = (0, import_react.useState)(150);
	const [category, setCategory] = (0, import_react.useState)("home");
	const [visibility, setVisibility] = (0, import_react.useState)("private");
	const [markerColor, setMarkerColor] = (0, import_react.useState)("#10b981");
	const [markerIcon, setMarkerIcon] = (0, import_react.useState)("home");
	(0, import_react.useEffect)(() => {
		if (savedPlaces) setPlaces(savedPlaces);
	}, [savedPlaces]);
	const loadPlaces = async () => {
		if (!user || !api.getToken()) return;
		try {
			const res = await api.get("/api/saved-places");
			setPlaces(res.places || []);
		} catch (err) {
			console.warn("Could not load saved places:", err);
		}
	};
	(0, import_react.useEffect)(() => {
		loadPlaces();
	}, [user?.id]);
	(0, import_react.useEffect)(() => {
		if (pendingCoords) {
			setLatitude(pendingCoords.lat.toFixed(6));
			setLongitude(pendingCoords.lng.toFixed(6));
			setShowAddModal(true);
			if (onClearPendingCoords) onClearPendingCoords();
		}
	}, [pendingCoords]);
	const handleUseCurrentLocation = () => {
		if (myLocation) {
			setLatitude(myLocation.latitude.toFixed(6));
			setLongitude(myLocation.longitude.toFixed(6));
		}
	};
	const handleCategoryChange = (cat) => {
		setCategory(cat);
		setMarkerIcon(cat);
		const locConfig = LOCATION_TYPES.find((t) => t.id === cat);
		if (locConfig) setMarkerColor(locConfig.defaultColor);
	};
	const handleCreatePlace = async (e) => {
		e.preventDefault();
		try {
			const res = await api.post("/api/saved-places", {
				name,
				description: desc,
				latitude: Number(latitude),
				longitude: Number(longitude),
				radiusMeters,
				category,
				visibility,
				markerColor,
				markerIcon
			});
			setPlaces((prev) => [...prev, res.place]);
			onRefreshSavedPlaces?.();
			setShowAddModal(false);
			setName("");
			setDesc("");
			toast.success(`Saved place "${res.place.name}" with custom marker!`);
		} catch (err) {
			toast.error(err.message || "Failed to save place");
		}
	};
	const handleDelete = async (id, placeName) => {
		try {
			await api.delete(`/api/saved-places/${id}`);
			setPlaces((prev) => prev.filter((p) => p.id !== id));
			onRefreshSavedPlaces?.();
			toast.success(placeName ? `Removed "${placeName}" from Wishlist & Saved Places` : "Saved place removed");
		} catch (err) {
			toast.error(err.message || "Failed to delete");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2 flex-wrap",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-bold text-slate-900 text-lg",
					children: "Wishlist, Saved Locations & Geofences"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-slate-500",
					children: "Manage your bookmarked wishlist places, family houses, work, schools, and emergency safe zones."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => {
						handleUseCurrentLocation();
						setShowAddModal(true);
					},
					className: "px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer active:scale-95",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save Place" })]
				})]
			}),
			places.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "w-10 h-10 text-slate-300 mx-auto mb-2" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold text-slate-700 text-sm",
						children: "No Wishlist or Saved Places Yet"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500 mt-1",
						children: "Add locations here or bookmark places from Google Places on the Live Map."
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 md:grid-cols-2 gap-3",
				children: places.map((place) => {
					const colorHex = place.markerColor || "#f59e0b";
					const iconEmoji = getLocationTypeEmoji(place.markerIcon || place.category);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between gap-3 hover:border-slate-300 transition-all",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white shadow-md border-2 border-white shrink-0",
								style: { backgroundColor: colorHex },
								children: iconEmoji
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 flex-wrap",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "font-bold text-slate-900 text-sm truncate",
											children: place.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase font-mono shadow-xs",
											style: { backgroundColor: colorHex },
											children: place.category === "favorite" ? "Wishlist" : place.category
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500 mt-0.5 line-clamp-2",
										children: place.description || "Custom map location"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
												"Radius: ",
												place.radiusMeters,
												"m"
											] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
												place.latitude.toFixed(4),
												", ",
												place.longitude.toFixed(4)
											] })
										]
									})
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 shrink-0",
							children: [onFocusMapLocation && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => onFocusMapLocation(place.latitude, place.longitude),
								className: "p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors",
								title: "Show on Map",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-4 h-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => handleDelete(place.id, place.name),
								className: "px-2.5 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all",
								title: "Remove from Wishlist / Saved Places",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Remove" })]
							})]
						})]
					}, place.id);
				})
			}),
			showAddModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between pb-2 mb-3 border-b border-slate-100",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-base text-slate-900",
							children: "Save Location & Style Marker"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500",
							children: "Select a distinctive icon and color to identify this location type on your map."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "p-2 rounded-xl bg-slate-100 text-slate-600 text-base",
							children: getLocationTypeEmoji(markerIcon || category)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleCreatePlace,
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 rounded-2xl bg-slate-950 text-white flex items-center justify-between gap-4 border border-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-10 h-10 rounded-2xl text-white flex items-center justify-center text-xl shadow-lg border-2 border-white shrink-0",
										style: { backgroundColor: markerColor },
										children: getLocationTypeEmoji(markerIcon || category)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] uppercase font-mono text-slate-400 block font-bold",
											children: "Map Marker Preview"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-sm text-white block",
											children: name.trim() || "Location Name"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[11px] text-slate-400 block",
											children: [
												"Category: ",
												category,
												" · Radius: ",
												radiusMeters,
												"m"
											]
										})
									] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "px-2.5 py-1 rounded-xl text-xs font-bold text-white shrink-0 font-mono shadow",
									style: { backgroundColor: markerColor },
									children: "Custom Style"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-950 mb-1",
								children: "Place Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								required: true,
								placeholder: "e.g. Grandma's House / Downtown Office / Central Park",
								value: name,
								onChange: (e) => setName(e.target.value),
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
								placeholder: "Notes or details",
								value: desc,
								onChange: (e) => setDesc(e.target.value),
								style: {
									color: "#090d16",
									backgroundColor: "#ffffff",
									colorScheme: "light",
									WebkitTextFillColor: "#090d16"
								},
								className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold text-slate-700 mb-1.5",
								children: "Location Type & Icon"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-200 rounded-xl",
								children: LOCATION_TYPES.map((t) => {
									const isSelected = category === t.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => handleCategoryChange(t.id),
										className: `p-2 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer text-xs ${isSelected ? "bg-slate-900 text-white font-bold shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-base",
											children: t.emoji
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate",
											children: t.label
										})]
									}, t.id);
								})
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold text-slate-700 mb-1.5",
								children: "Marker Map Color"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-4 sm:grid-cols-6 gap-1.5",
								children: MARKER_COLORS.map((c) => {
									const isSelected = markerColor.toLowerCase() === c.hex.toLowerCase();
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setMarkerColor(c.hex),
										className: `p-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all cursor-pointer ${isSelected ? "border-slate-900 ring-2 ring-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`,
										title: c.label,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-4 h-4 rounded-full border border-white shadow-xs flex items-center justify-center shrink-0",
											style: { backgroundColor: c.hex },
											children: isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-2.5 h-2.5 text-white stroke-[3]" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-semibold text-slate-700 truncate hidden sm:inline",
											children: c.label.split(" ")[0]
										})]
									}, c.id);
								})
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-semibold text-slate-700 mb-1",
									children: "Latitude"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									step: "any",
									required: true,
									value: latitude,
									onChange: (e) => setLatitude(e.target.value),
									className: "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-semibold text-slate-700 mb-1",
									children: "Longitude"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									step: "any",
									required: true,
									value: longitude,
									onChange: (e) => setLongitude(e.target.value),
									className: "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
								})] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs font-semibold text-slate-700 mb-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Geofence Detection Radius" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-bold text-sky-600",
									children: [radiusMeters, " meters"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: "25",
								max: "500",
								step: "25",
								value: radiusMeters,
								onChange: (e) => setRadiusMeters(Number(e.target.value)),
								className: "w-full accent-slate-900"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold text-slate-700 mb-1",
								children: "Visibility"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: visibility,
								onChange: (e) => setVisibility(e.target.value),
								className: "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "private",
										children: "Private (Only Me)"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "room",
										children: "Room Members"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "public",
										children: "Public"
									})
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-3 flex items-center justify-end gap-2 border-t border-slate-100",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowAddModal(false),
									className: "px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									className: "px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm cursor-pointer",
									children: "Save Place"
								})]
							})
						]
					})]
				})
			})
		]
	});
};
export { SavedPlacesManager };
