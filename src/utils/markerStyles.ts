/**
 * Marker styling system for user/family identification and location type customization
 */

export interface MarkerColorOption {
  id: string;
  label: string;
  hex: string;
  ringClass: string;
  bgClass: string;
  textClass: string;
}

export const MARKER_COLORS: MarkerColorOption[] = [
  { id: 'sky', label: 'Sky Blue', hex: '#0ea5e9', ringClass: 'ring-sky-500', bgClass: 'bg-sky-500', textClass: 'text-sky-400' },
  { id: 'rose', label: 'Rose Pink', hex: '#ec4899', ringClass: 'ring-pink-500', bgClass: 'bg-pink-500', textClass: 'text-pink-400' },
  { id: 'emerald', label: 'Emerald Green', hex: '#10b981', ringClass: 'ring-emerald-500', bgClass: 'bg-emerald-500', textClass: 'text-emerald-400' },
  { id: 'amber', label: 'Amber Gold', hex: '#f59e0b', ringClass: 'ring-amber-500', bgClass: 'bg-amber-500', textClass: 'text-amber-400' },
  { id: 'indigo', label: 'Indigo Royal', hex: '#6366f1', ringClass: 'ring-indigo-500', bgClass: 'bg-indigo-500', textClass: 'text-indigo-400' },
  { id: 'purple', label: 'Violet Purple', hex: '#a855f7', ringClass: 'ring-purple-500', bgClass: 'bg-purple-500', textClass: 'text-purple-400' },
  { id: 'orange', label: 'Sunset Orange', hex: '#f97316', ringClass: 'ring-orange-500', bgClass: 'bg-orange-500', textClass: 'text-orange-400' },
  { id: 'crimson', label: 'Crimson Red', hex: '#ef4444', ringClass: 'ring-red-500', bgClass: 'bg-red-500', textClass: 'text-red-400' },
  { id: 'cyan', label: 'Electric Cyan', hex: '#06b6d4', ringClass: 'ring-cyan-500', bgClass: 'bg-cyan-500', textClass: 'text-cyan-400' },
  { id: 'teal', label: 'Mint Teal', hex: '#14b8a6', ringClass: 'ring-teal-500', bgClass: 'bg-teal-500', textClass: 'text-teal-400' },
  { id: 'lime', label: 'Lime Green', hex: '#84cc16', ringClass: 'ring-lime-500', bgClass: 'bg-lime-500', textClass: 'text-lime-400' },
  { id: 'slate', label: 'Dark Slate', hex: '#475569', ringClass: 'ring-slate-500', bgClass: 'bg-slate-500', textClass: 'text-slate-400' },
];

export interface MemberIconOption {
  id: string;
  label: string;
  emoji: string;
  category: 'family' | 'identity' | 'vehicle' | 'status';
}

export const MEMBER_ICONS: MemberIconOption[] = [
  { id: 'person', label: 'Standard Member', emoji: '👤', category: 'identity' },
  { id: 'dad', label: 'Dad / Father', emoji: '👨', category: 'family' },
  { id: 'mom', label: 'Mom / Mother', emoji: '👩', category: 'family' },
  { id: 'kid', label: 'Kid / Child', emoji: '🧒', category: 'family' },
  { id: 'elder', label: 'Grandparent', emoji: '👴', category: 'family' },
  { id: 'pet', label: 'Pet / Dog', emoji: '🐾', category: 'family' },
  { id: 'car', label: 'Driver / Car', emoji: '🚗', category: 'vehicle' },
  { id: 'bike', label: 'Bicycle / Rider', emoji: '🚲', category: 'vehicle' },
  { id: 'shield', label: 'Guardian / Shield', emoji: '🛡️', category: 'status' },
  { id: 'star', label: 'VIP / Star', emoji: '⭐', category: 'status' },
  { id: 'heart', label: 'Loved One', emoji: '❤️', category: 'family' },
  { id: 'student', label: 'Student', emoji: '🎓', category: 'identity' },
];

export interface LocationTypeOption {
  id: string;
  label: string;
  emoji: string;
  defaultColor: string;
  description: string;
}

export const LOCATION_TYPES: LocationTypeOption[] = [
  { id: 'home', label: 'Home Base', emoji: '🏠', defaultColor: '#10b981', description: 'Primary residence or family home' },
  { id: 'work', label: 'Work / Office', emoji: '💼', defaultColor: '#6366f1', description: 'Workplace or office building' },
  { id: 'school', label: 'School / University', emoji: '🎓', defaultColor: '#a855f7', description: 'School, kindergarten or college' },
  { id: 'family', label: 'Family House', emoji: '👨‍👩‍👧', defaultColor: '#ec4899', description: 'Relatives or grandparents home' },
  { id: 'favorite', label: 'Favorite Spot', emoji: '❤️', defaultColor: '#f59e0b', description: 'Favorite cafe, hangout or park' },
  { id: 'hospital', label: 'Hospital & Clinic', emoji: '🏥', defaultColor: '#ef4444', description: 'Medical center or pharmacy' },
  { id: 'groceries', label: 'Market & Groceries', emoji: '🛒', defaultColor: '#14b8a6', description: 'Supermarket or shopping spot' },
  { id: 'park', label: 'Park & Outdoors', emoji: '🌲', defaultColor: '#84cc16', description: 'Trail, playground or nature park' },
  { id: 'gym', label: 'Gym & Fitness', emoji: '🏋️', defaultColor: '#f97316', description: 'Workout center or sports field' },
  { id: 'emergency_point', label: 'Emergency Shelter', emoji: '🚨', defaultColor: '#dc2626', description: 'Disaster muster point or safe zone' },
];

/**
 * Returns SVG path or markup for a member icon
 */
export function getMemberIconEmoji(iconId?: string): string {
  const match = MEMBER_ICONS.find((i) => i.id === iconId);
  return match ? match.emoji : '👤';
}

/**
 * Returns emoji for a location type
 */
export function getLocationTypeEmoji(catOrIcon?: string): string {
  const match = LOCATION_TYPES.find((t) => t.id === catOrIcon);
  if (match) return match.emoji;
  if (catOrIcon === 'home') return '🏠';
  if (catOrIcon === 'work') return '💼';
  if (catOrIcon === 'school') return '🎓';
  if (catOrIcon === 'family') return '👨‍👩‍👧';
  if (catOrIcon === 'hospital') return '🏥';
  if (catOrIcon === 'emergency_point') return '🚨';
  return '📍';
}

/**
 * Returns SVG markup for place type
 */
export function getPlaceSvgIcon(iconName: string): string {
  switch (iconName) {
    case 'home':
      return `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`;
    case 'work':
      return `<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`;
    case 'school':
      return `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`;
    case 'family':
      return `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`;
    case 'hospital':
      return `<path d="M12 6v12m-6-6h12"/><rect width="18" height="18" x="3" y="3" rx="2"/>`;
    case 'groceries':
      return `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`;
    case 'park':
      return `<path d="m8 14 4-7 4 7H8z"/><path d="M12 14v7"/><path d="M5 21h14"/>`;
    case 'gym':
      return `<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1a3 3 0 0 0-4.24 0l-1.52 1.52"/><path d="m3 3 1 1a3 3 0 0 0 4.24 0l1.52-1.52"/>`;
    case 'emergency_point':
      return `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`;
    default:
      return `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`;
  }
}

/**
 * Local custom member marker overrides (lets user customize family on their personal map)
 */
export interface CustomMemberMarkerOverride {
  color?: string;
  icon?: string;
  nickname?: string;
}

const PEER_OVERRIDES_KEY = 'beacon_custom_member_markers';

export function getCustomMemberOverrides(): Record<string, CustomMemberMarkerOverride> {
  try {
    const raw = localStorage.getItem(PEER_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomMemberOverride(userId: string, override: CustomMemberMarkerOverride) {
  try {
    const all = getCustomMemberOverrides();
    all[userId] = { ...all[userId], ...override };
    localStorage.setItem(PEER_OVERRIDES_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save member marker override:', e);
  }
}

export function clearCustomMemberOverride(userId: string) {
  try {
    const all = getCustomMemberOverrides();
    delete all[userId];
    localStorage.setItem(PEER_OVERRIDES_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to clear member marker override:', e);
  }
}
