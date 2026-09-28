// ============================================================================
// File: NotificationPreferenceManager.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Description: Manages prosumer notification preferences, dismissals, and read statuses.
// ============================================================================

package com.ead.solarmicrogrid.util;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Set;

public class NotificationPreferenceManager {

    private static final String PREF_NAME = "solvance_notif_prefs";
    private static final String KEY_TRADE_PASS = "pref_notif_trade_pass";
    private static final String KEY_SURGE = "pref_notif_surge";
    private static final String KEY_BATTERY_HUB = "pref_notif_battery_hub";
    private static final String KEY_TELEMETRY = "pref_notif_telemetry";
    private static final String KEY_ALL_READ = "pref_notif_all_read";
    private static final String KEY_DISMISSED_SET = "pref_notif_dismissed_set";

    public static boolean isTradePassEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_TRADE_PASS, true);
    }

    public static void setTradePassEnabled(Context context, boolean enabled) {
        getPrefs(context).edit().putBoolean(KEY_TRADE_PASS, enabled).apply();
    }

    public static boolean isSurgeEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_SURGE, true);
    }

    public static void setSurgeEnabled(Context context, boolean enabled) {
        getPrefs(context).edit().putBoolean(KEY_SURGE, enabled).apply();
    }

    public static boolean isBatteryHubEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_BATTERY_HUB, true);
    }

    public static void setBatteryHubEnabled(Context context, boolean enabled) {
        getPrefs(context).edit().putBoolean(KEY_BATTERY_HUB, enabled).apply();
    }

    public static boolean isTelemetryEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_TELEMETRY, true);
    }

    public static void setTelemetryEnabled(Context context, boolean enabled) {
        getPrefs(context).edit().putBoolean(KEY_TELEMETRY, enabled).apply();
    }

    public static boolean isAllRead(Context context) {
        return getPrefs(context).getBoolean(KEY_ALL_READ, false);
    }

    public static void setAllRead(Context context, boolean read) {
        getPrefs(context).edit().putBoolean(KEY_ALL_READ, read).apply();
    }

    public static boolean isDismissed(Context context, String notifKey) {
        Set<String> dismissed = getPrefs(context).getStringSet(KEY_DISMISSED_SET, new HashSet<>());
        return dismissed.contains(notifKey);
    }

    public static void dismissNotification(Context context, String notifKey) {
        SharedPreferences prefs = getPrefs(context);
        Set<String> dismissed = new HashSet<>(prefs.getStringSet(KEY_DISMISSED_SET, new HashSet<>()));
        dismissed.add(notifKey);
        prefs.edit().putStringSet(KEY_DISMISSED_SET, dismissed).apply();
    }

    public static void resetAllNotifications(Context context) {
        getPrefs(context).edit()
                .putBoolean(KEY_TRADE_PASS, true)
                .putBoolean(KEY_SURGE, true)
                .putBoolean(KEY_BATTERY_HUB, true)
                .putBoolean(KEY_TELEMETRY, true)
                .putBoolean(KEY_ALL_READ, false)
                .putStringSet(KEY_DISMISSED_SET, new HashSet<>())
                .apply();
    }

    public static int getActiveNotificationCount(Context context) {
        int count = 0;
        if (isTradePassEnabled(context) && !isDismissed(context, "trade_pass")) count++;
        if (isSurgeEnabled(context) && !isDismissed(context, "surge")) count++;
        if (isBatteryHubEnabled(context) && !isDismissed(context, "battery_hub")) count++;
        if (isTelemetryEnabled(context) && !isDismissed(context, "telemetry")) count++;
        return count;
    }

    public static boolean hasUnreadBadge(Context context) {
        return !isAllRead(context) && getActiveNotificationCount(context) > 0;
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }
}
