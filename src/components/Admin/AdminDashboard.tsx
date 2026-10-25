import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import type { UserProfile, Room, ReportItem, AuditLog } from '../../types.ts';
import { api } from '../../utils/api.ts';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  AlertTriangle,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  RotateCcw,
} from 'lucide-react';

import { useToast } from '../../context/ToastContext.tsx';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState<{
    totalUsers: number;
    onlineUsers: number;
    totalRooms: number;
    totalMessages: number;
    activeAlerts: number;
    pendingReports: number;
  } | null>(null);

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [reportsList, setReportsList] = useState<ReportItem[]>([]);
  const [logsList, setLogsList] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rooms' | 'reports' | 'logs'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL');
  const [logUserFilter, setLogUserFilter] = useState<string>('');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'online'>('all');

  const [roomSearchQuery, setRoomSearchQuery] = useState<string>('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<'all' | 'protected' | 'open'>('all');

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{
        stats: any;
        users: UserProfile[];
        rooms: Room[];
        reports: ReportItem[];
        logs: AuditLog[];
      }>('/api/admin/stats');

      setStats(res.stats);
      setUsersList(res.users);
      setRoomsList(res.rooms);
      setReportsList(res.reports);
      setLogsList(res.logs);
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleResolveReport = async (id: string, status: 'reviewed' | 'dismissed') => {
    try {
      await api.post(`/api/admin/reports/${id}/resolve`, { status });
      setReportsList((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(`Report ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  // Distinct action types in audit logs
  const availableActionTypes = useMemo(() => {
    const set = new Set<string>();
    logsList.forEach((l) => {
      // Split prefix e.g. AUTH:LOGIN -> AUTH
      const prefix = l.action.split(':')[0] || l.action;
      set.add(prefix);
    });
    return Array.from(set).sort();
  }, [logsList]);

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return logsList.filter((log) => {
      if (logActionFilter !== 'ALL') {
        if (!log.action.startsWith(logActionFilter)) return false;
      }
      if (logUserFilter.trim()) {
        const uQuery = logUserFilter.toLowerCase().trim();
        const matchesUser =
          log.userName.toLowerCase().includes(uQuery) ||
          log.userId.toLowerCase().includes(uQuery);
        if (!matchesUser) return false;
      }
      if (logSearchQuery.trim()) {
        const sQuery = logSearchQuery.toLowerCase().trim();
        const matchesDetail =
          log.details.toLowerCase().includes(sQuery) ||
          log.action.toLowerCase().includes(sQuery);
        if (!matchesDetail) return false;
      }
      return true;
    });
  }, [logsList, logActionFilter, logUserFilter, logSearchQuery]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (userRoleFilter === 'admin' && !u.isAdmin) return false;
      if (userRoleFilter === 'online' && !u.isOnline) return false;
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase().trim();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [usersList, userRoleFilter, userSearchQuery]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return roomsList.filter((r) => {
      if (roomTypeFilter === 'protected' && !r.hasPassword) return false;
      if (roomTypeFilter === 'open' && r.hasPassword) return false;
      if (roomSearchQuery.trim()) {
        const q = roomSearchQuery.toLowerCase().trim();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          r.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [roomsList, roomTypeFilter, roomSearchQuery]);

  // Export filtered logs as JSON file
  const exportLogsAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `beacon-audit-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!user?.isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="font-bold text-slate-900 text-lg">Administrator Access Required</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          This system console is restricted to platform administrators with authenticated clearance.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            System Administration & Audit
          </h2>
          <p className="text-xs text-slate-500">
            Real-time platform oversight, room moderation, abuse reports and immutable audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAdminData}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Users</span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{stats.totalUsers}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-emerald-600 block">Online Now</span>
            <span className="text-2xl font-black text-emerald-600 tabular-nums">{stats.onlineUsers}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 block">Private Rooms</span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{stats.totalRooms}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 block">Messages Sent</span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{stats.totalMessages}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-rose-600 block">Active SOS</span>
            <span className="text-2xl font-black text-rose-600 tabular-nums">{stats.activeAlerts}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-amber-600 block">Pending Reports</span>
            <span className="text-2xl font-black text-amber-600 tabular-nums">{stats.pendingReports}</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {(['overview', 'users', 'rooms', 'reports', 'logs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors shrink-0 ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab}
            {tab === 'logs' && ` (${logsList.length})`}
            {tab === 'reports' && reportsList.length > 0 && ` (${reportsList.length})`}
          </button>
        ))}
      </div>

      {/* Tab Panels */}

      {/* Users Tab with search and filters */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-bold text-sm text-slate-900">
              Registered Users ({filteredUsers.length} of {usersList.length})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user, @username, email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-56"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-700 focus:outline-none font-semibold"
              >
                <option value="all">All Status</option>
                <option value="online">Online Only</option>
                <option value="admin">Admins Only</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No users match your filter query.</div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{u.fullName}</span>
                        {u.isAdmin && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">
                            ADMIN
                          </span>
                        )}
                        <span
                          className={`w-2 h-2 rounded-full ${
                            u.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-mono">@{u.username} · {u.email}</span>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">ID: {u.id}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <span className={`block font-medium ${u.isOnline ? 'text-emerald-600 font-bold' : ''}`}>
                      {u.isOnline ? 'Active Now' : 'Offline'}
                    </span>
                    <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Rooms Tab with search and filters */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-bold text-sm text-slate-900">
              Active Rooms ({filteredRooms.length} of {roomsList.length})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search room name or ID..."
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-52"
                />
              </div>
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-700 focus:outline-none font-semibold"
              >
                <option value="all">All Rooms</option>
                <option value="protected">Password Protected</option>
                <option value="open">Open Rooms</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No rooms found.</div>
            ) : (
              filteredRooms.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{r.name}</h4>
                    <p className="text-xs text-slate-500">{r.description || 'No description provided'}</p>
                    <span className="text-[11px] text-slate-400 font-mono mt-1 block">ID: {r.id}</span>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <span className="font-bold block text-slate-900">{r.memberCount} members</span>
                    <span className={`text-[11px] ${r.hasPassword ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      {r.hasPassword ? '🔒 Protected' : '🌐 Open'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm">
            Abuse & Spam Moderation Queue ({reportsList.length})
          </div>
          {reportsList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No pending moderation reports.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reportsList.map((rep) => (
                <div key={rep.id} className="p-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        Reported {rep.targetType}: {rep.targetId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800">
                        {rep.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Reason: "{rep.reason}"</p>
                    <span className="text-[11px] text-slate-400 block mt-1">
                      Reported by {rep.reporterName} on {new Date(rep.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {rep.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleResolveReport(rep.id, 'reviewed')}
                        className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                      >
                        Mark Reviewed
                      </button>
                      <button
                        onClick={() => handleResolveReport(rep.id, 'dismissed')}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Log Tab with ADVANCED FILTERING */}
      {(activeTab === 'overview' || activeTab === 'logs') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header & Controls */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Security & System Audit Log
                <span className="text-xs font-normal text-slate-500 font-mono">
                  ({filteredLogs.length} / {logsList.length} events)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportLogsAsJson}
                  title="Export filtered logs to JSON"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                {(logActionFilter !== 'ALL' || logUserFilter || logSearchQuery) && (
                  <button
                    onClick={() => {
                      setLogActionFilter('ALL');
                      setLogUserFilter('');
                      setLogSearchQuery('');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Action Filter */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 w-full focus:outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All Action Categories</option>
                  {availableActionTypes.map((action) => (
                    <option key={action} value={action}>
                      {action} events
                    </option>
                  ))}
                </select>
              </div>

              {/* User / ID Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by User Name or ID..."
                  value={logUserFilter}
                  onChange={(e) => setLogUserFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {/* Keyword Detail Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search log keywords & details..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Log Stream */}
          <div className="divide-y divide-slate-100 font-mono text-xs max-h-[500px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No audit log entries match the selected filters.
              </div>
            ) : (
              filteredLogs.slice(0, activeTab === 'overview' ? 30 : 150).map((l) => (
                <div key={l.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-400 text-[11px] shrink-0">
                      [{new Date(l.timestamp).toLocaleTimeString()}]
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                        l.action.startsWith('ALERT')
                          ? 'bg-rose-100 text-rose-800'
                          : l.action.startsWith('AUTH')
                          ? 'bg-blue-100 text-blue-800'
                          : l.action.startsWith('ROOM')
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.action.startsWith('PRIVACY')
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {l.action}
                    </span>
                    <span className="text-slate-800 break-all">{l.details}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-slate-400 text-[11px]">
                    <span className="font-semibold text-slate-600">{l.userName}</span>
                    <span className="text-[10px]">({l.userId.slice(0, 8)})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
