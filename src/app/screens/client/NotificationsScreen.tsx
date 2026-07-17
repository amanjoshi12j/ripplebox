import { useEffect, useState } from "react";
import { Bell, Gift, Users, Calendar, Info, Check, Loader2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../context/AuthContext";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationEntry,
} from "../../lib/apiClient";

export function NotificationsScreen() {
  const auth = useAuth();
  const [notificationList, setNotificationList] = useState<NotificationEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    getNotifications(auth.idToken)
      .then(setNotificationList)
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const getIcon = (type: string) => {
    switch (type) {
      case "reward":
        return <Gift size={20} className="text-[#d4af37]" />;
      case "referral":
        return <Users size={20} className="text-[#e6d7f5]" />;
      case "appointment":
        return <Calendar size={20} className="text-[#f5d7e3]" />;
      case "alert":
        return <Bell size={20} className="text-orange-400" />;
      default:
        return <Info size={20} className="text-gray-400" />;
    }
  };

  const markAsRead = async (id: string) => {
    if (!auth.idToken) return;
    setNotificationList((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? null);
    try {
      await markNotificationRead(auth.idToken, id);
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!auth.idToken) return;
    setNotificationList((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null);
    try {
      await markAllNotificationsRead(auth.idToken);
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  };

  const unreadCount = notificationList?.filter((n) => !n.isRead).length ?? 0;

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load notifications right now. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-900 dark:to-gray-800 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Notifications</h1>
          {unreadCount > 0 && (
            <Badge className="bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] text-[#2d2d2d]">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Stay updated with your rewards</p>
      </div>

      <div className="px-6 mt-6">
        {/* Mark all as read */}
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 text-sm text-[#e6d7f5] dark:text-purple-400 hover:underline mb-4"
          >
            <Check size={16} />
            Mark all as read
          </button>
        )}

        {/* Notifications list */}
        {notificationList === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {notificationList.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Bell size={40} className="text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
                <p className="text-sm text-gray-400 mt-2">We'll notify you when something happens</p>
              </div>
            ) : (
              notificationList.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    notification.isRead
                      ? "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                      : "bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-purple-900/30 dark:to-pink-900/30 border-[#e6d7f5]/30 dark:border-purple-700/30 shadow-sm"
                  }`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.isRead ? "bg-gray-100 dark:bg-gray-700" : "bg-white dark:bg-gray-800"
                      }`}
                    >
                      {getIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm text-[#2d2d2d] dark:text-gray-100">{notification.title}</h4>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-[#e6d7f5] dark:bg-purple-400 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
