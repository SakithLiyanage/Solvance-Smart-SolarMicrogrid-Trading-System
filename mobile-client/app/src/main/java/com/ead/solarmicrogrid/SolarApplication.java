package com.ead.solarmicrogrid;

import android.app.Application;

import com.ead.solarmicrogrid.util.ThemeManager;

public class SolarApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        // Initialize user-selected theme (Light / Dark mode)
        ThemeManager.applyTheme(this);
    }
}
