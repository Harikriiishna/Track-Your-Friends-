/**
 * Native Browser Notifications and Push Alert Dispatcher
 */

export class NotificationService {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
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
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      return false;
    }
  }

  public send(title: string, options?: NotificationOptions): Notification | null {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const n = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        ...options,
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };

      return n;
    } catch (err) {
      console.warn('Failed to send browser notification:', err);
      return null;
    }
  }

  public notifyEmergency(senderName: string, message: string) {
    this.send(`🚨 EMERGENCY SOS: ${senderName}`, {
      body: message || 'An emergency beacon has been activated in your network.',
      tag: 'emergency-sos',
      requireInteraction: true,
      icon: '/pwa-192x192.png',
    });
  }

  public notifyMessage(senderName: string, text: string) {
    // Only notify if window is hidden or document has no focus
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
}

export const notifications = NotificationService.getInstance();
