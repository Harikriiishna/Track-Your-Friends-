import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { formatAccuracy, formatTimeAgo } from '../../utils/geo.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { triggerHaptic } from '../../utils/audio.ts';
import {
  AlertTriangle,
  Siren,
  Phone,
  CheckCircle,
  MapPin,
  Clock,
  ShieldAlert,
  MessageSquare,
  X,
  Volume2,
  VolumeX,
  Trash2,
} from 'lucide-react';

interface EmergencyManagerProps {
  onViewLocationOnMap?: (lat: number, lng: number) => void;
  onSelectUserForChat?: (userId: string) => void;
}

export const EmergencyManager: React.FC<EmergencyManagerProps> = ({
  onViewLocationOnMap,
  onSelectUserForChat,
}) => {
  const { user } = useAuth();
  const {
    myLocation,
    activeAlerts,
    triggerEmergencySos,
    acknowledgeEmergency,
    deleteEmergencyAlert,
    latestAlert,
    dismissLatestAlert,
  } = useRealtime();

  const toast = useToast();
  const [sosMessage, setSosMessage] = useState('EMERGENCY: Immediate help needed!');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const handleSendSos = () => {
    setIsTriggering(true);
    triggerHaptic('sos');
    triggerEmergencySos(sosMessage);
    setShowConfirmModal(false);
    setIsTriggering(false);
    toast.success('Emergency SOS broadcast transmitted');
  };

  const handleResolve = async (alertId: string) => {
    try {
      await api.post(`/api/alerts/emergency/${alertId}/resolve`);
      dismissLatestAlert();
      toast.success('Distress alert resolved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve alert');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deleteEmergencyAlert(alertId);
      toast.success('Distress alert deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete alert');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-6">
      {/* Top Banner & SOS Trigger */}
      <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Siren className="w-4 h-4 animate-pulse" />
              Community Safety Mesh
            </div>
            <h2 className="text-2xl font-black tracking-tight">Emergency Broadcast Network</h2>
            <p className="text-xs text-rose-200 mt-1 max-w-lg">
              Instantly transmit high-priority distress alerts with your real GPS coordinates and device accuracy to your network.
            </p>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="w-full md:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-900/50 flex items-center justify-center gap-2 transition-all"
          >
            <AlertTriangle className="w-5 h-5 fill-current" />
            BROADCAST EMERGENCY SOS
          </button>
        </div>
      </div>

      {/* Floating Active Emergency Banner (If latest alert received) */}
      {latestAlert && latestAlert.status === 'active' && (
        <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-rose-600 flex items-center justify-center font-bold">
              <Siren className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <p className="font-bold text-sm">Active SOS: {latestAlert.senderName}</p>
              <p className="text-xs text-rose-100">{latestAlert.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onViewLocationOnMap) {
                  onViewLocationOnMap(latestAlert.latitude, latestAlert.longitude);
                }
              }}
              className="px-3 py-1.5 bg-white text-rose-700 font-bold text-xs rounded-xl shadow-sm"
            >
              View on Map
            </button>
            <button
              onClick={dismissLatestAlert}
              className="p-2 hover:bg-rose-700 rounded-xl"
              title="Silence siren"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Alerts List */}
      <div>
        <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          Active Distress Alerts ({activeAlerts.length})
        </h3>

        {activeAlerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="font-semibold text-slate-800 text-sm">No Active Emergency Alerts</h4>
            <p className="text-xs text-slate-500 mt-1">Your groups and community channels are currently secure.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlerts.map((alert) => {
              const isAcknowledgedByMe = alert.acknowledgedBy.some((a) => a.userId === user?.id);
              const isMyAlert = alert.senderId === user?.id;

              return (
                <div
                  key={alert.id}
                  className="bg-white rounded-2xl border-2 border-rose-300 p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={alert.senderAvatar}
                        alt={alert.senderName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-rose-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{alert.senderName}</h4>
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            SOS ACTIVE
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTimeAgo(alert.timestamp)}</span>
                          {alert.roomName && (
                            <>
                              <span>·</span>
                              <span>{alert.roomName}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMyAlert && alert.status === 'active' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        title="Delete Alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Alert
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100 text-sm font-semibold text-rose-950">
                    "{alert.message}"
                  </div>

                  {/* Geolocation Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block">Coordinates</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">GPS Accuracy</span>
                      <span className="font-semibold text-slate-800">
                        {formatAccuracy(alert.accuracy)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Phone Contact</span>
                      <span className="font-medium text-slate-800">
                        {alert.senderPhone || 'Hidden by privacy'}
                      </span>
                    </div>
                  </div>

                  {/* Action Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (onViewLocationOnMap) {
                          onViewLocationOnMap(alert.latitude, alert.longitude);
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <MapPin className="w-4 h-4" />
                      View Real Location on Map
                    </button>

                    {alert.senderPhone && (
                      <a
                        href={`tel:${alert.senderPhone}`}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        Call {alert.senderPhone}
                      </a>
                    )}

                    <button
                      onClick={() => {
                        if (onSelectUserForChat) {
                          onSelectUserForChat(alert.senderId);
                        }
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Message
                    </button>

                    <button
                      onClick={() => acknowledgeEmergency(alert.id)}
                      disabled={isAcknowledgedByMe}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 ml-auto ${
                        isAcknowledgedByMe
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isAcknowledgedByMe ? 'Acknowledged by You' : 'Acknowledge Alert'}
                    </button>
                  </div>

                  {/* Acknowledged by List */}
                  {alert.acknowledgedBy.length > 0 && (
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Responders: </span>
                      <span>{alert.acknowledgedBy.map((a) => a.name).join(', ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal to prevent accidental SOS broadcast */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Siren className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Broadcast Emergency SOS?</h3>
            <p className="text-xs text-slate-700 mt-1 mb-4 font-medium">
              This will immediately send your exact real GPS location (
              {myLocation
                ? `${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)} · ${formatAccuracy(myLocation.accuracy)}`
                : 'Acquiring GPS'}
              ) and sound an audible alarm to all members in your network.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-950 mb-1">Distress Message</label>
              <input
                type="text"
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
                placeholder="EMERGENCY: Immediate help needed!"
                style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-rose-300 bg-white text-slate-950 placeholder:text-slate-500 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-rose-600 shadow-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSos}
                disabled={isTriggering}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-900/30 flex items-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4 fill-current" />
                Confirm SOS Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
