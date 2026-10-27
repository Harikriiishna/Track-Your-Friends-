/**
 * Native Browser & Mobile Device Push Notification Dispatcher
 */

export class NotificationService {
  private static instance: NotificationService;
  private permissionRequested = false;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockPermission = () => {
        if (!this.permissionRequested && this.isSupported() && Notification.permission === 'default') {
          this.permissionRequested = true;
          this.requestPermission().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlockPermission, { once: true, passive: true });
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (Notification.permission === 'granted') return true;
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      return false;
    }
  }

  public send(title: string, options?: NotificationOptions): Notification | null {
    // Trigger mobile haptic vibration for urgent device alerts
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([400, 150, 400, 150, 600]);
      }
    } catch {}

    // Dispatch custom in-app device pop-up notification event so a native-style banner ALWAYS pops up on screen
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('beacon:device-popup-notification', {
            detail: {
              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              title,
              body: options?.body || '',
              tag: options?.tag || 'general',
              data: options?.data || null,
              timestamp: Date.now(),
            },
          })
        );
      }
    } catch {}

    if (!this.isSupported()) {
      return null;
    }

    if (Notification.permission === 'default') {
      this.requestPermission().then((granted) => {
        if (granted) {
          this.dispatchNativeNotification(title, options);
        }
      });
      return null;
    }

    if (Notification.permission !== 'granted') {
      return null;
    }

    return this.dispatchNativeNotification(title, options);
  }

  private dispatchNativeNotification(title: string, options?: NotificationOptions): Notification | null {
    const mergedOptions: NotificationOptions = {
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      ...options,
    };

    // 1. Prefer ServiceWorkerRegistration.showNotification on mobile/PWA (required on Android Chrome)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          reg.showNotification(title, mergedOptions).catch(() => {});
        }
      }).catch(() => {});
    }

    // 2. Also attempt standard desktop Notification constructor
    try {
      const n = new Notification(title, mergedOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return n;
    } catch {
      return null;
    }
  }

  public notifyEmergency(
    senderName: string,
    message: string,
    coords?: { latitude: number; longitude: number; accuracy?: number; distanceMeters?: number | null }
  ) {
    const distLabel =
      coords && typeof coords.distanceMeters === 'number'
        ? coords.distanceMeters < 1000
          ? `${Math.round(coords.distanceMeters)} m away`
          : `${(coords.distanceMeters / 1000).toFixed(1)} km away`
        : 'Within 5 km';

    const coordText =
      coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)
        ? ` · GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
        : '';

    this.send(`🚨 EMERGENCY SOS (${distLabel}): ${senderName}`, {
      body: `${message || 'Immediate help needed!'}${coordText}`,
      tag: `emergency-sos-${Date.now()}`,
      requireInteraction: true,
      icon: '/pwa-192x192.png',
      data: coords || null,
    });
  }

  public notifyMessage(senderName: string, text: string) {
    if (document.hidden) {
      this.send(`New message from ${senderName}`, {
        body: text,
        tag: `msg-${senderName}`,
        icon: '/pwa-192x192.png',
      });
    }
  }

  public notifyReminder(title: string, locationName: string) {
    this.send(`📍 Geofence Reminder: ${title}`, {
      body: `You arrived near ${locationName}. Don't forget your scheduled task!`,
      tag: `reminder-${title}`,
      requireInteraction: true,
      icon: '/pwa-192x192.png',
    });
  }

  public notifyMemberGeofence(
    memberName: string,
    action: 'entered' | 'left',
    placeName: string,
    distanceMeters?: number
  ) {
    const verb = action === 'entered' ? 'entered' : 'left';
    const distInfo =
      typeof distanceMeters === 'number' ? ` (${Math.round(distanceMeters)}m from center)` : '';
    this.send(`📍 Geofence Alert: ${memberName} ${verb} ${placeName}`, {
      body: `${memberName} has just ${verb} the "${placeName}" saved location geofence${distInfo}.`,
      tag: `geofence-${memberName}-${placeName}-${action}`,
      requireInteraction: false,
      icon: '/pwa-192x192.png',
    });
  }
}

export const notifications = NotificationService.getInstance();
