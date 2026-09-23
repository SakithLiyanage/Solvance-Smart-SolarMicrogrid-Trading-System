package com.ead.solarmicrogrid.util;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import androidx.appcompat.app.AppCompatDelegate;

/**
 * Manages dynamic Light & Dark mode switching across Solvance Android Client.
 * Synchronizes with user preference (default: light mode, matching web client).
 */
public class ThemeManager {

    private static final String PREF_NAME = "solvance_theme_prefs";
    private static final String KEY_THEME = "solar_theme"; // "light", "dark", "system"

    public static void applyTheme(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String theme = prefs.getString(KEY_THEME, "light");
        if ("dark".equalsIgnoreCase(theme)) {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
        } else if ("light".equalsIgnoreCase(theme)) {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        } else {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
        }
    }

    public static boolean isDarkMode(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String theme = prefs.getString(KEY_THEME, null);
        if ("dark".equalsIgnoreCase(theme)) return true;
        if ("light".equalsIgnoreCase(theme)) return false;

        int currentNightMode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return currentNightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    public static void toggleTheme(Context context) {
        boolean isDark = isDarkMode(context);
        setTheme(context, isDark ? "light" : "dark");
    }

    public static void setTheme(Context context, String theme) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_THEME, theme).apply();
        applyTheme(context);
    }
}
