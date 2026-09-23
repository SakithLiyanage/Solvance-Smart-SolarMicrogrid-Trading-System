package com.ead.solarmicrogrid.data.local;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.ead.solarmicrogrid.data.models.EnergyReservation;
import com.ead.solarmicrogrid.data.models.SolarStation;
import com.ead.solarmicrogrid.data.models.User;

import java.util.ArrayList;
import java.util.List;

/**
 * Pure SQLite Database Helper for local persistence on Android.
 * Authors:
 *   - M.L. Booso (IT23452916) - User Session & Auth Store
 *   - G.L.S. Chanlaka (IT23151260) - Station & Geolocation Cache
 *   - L.T. Jayawardhana (IT23156760) - Offline Reservation Store
 *   - H.N. Madubashini (IT23192300) - Operator Sync Cache
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Technical Citations:
 * - Android SQLiteOpenHelper & Database Architecture:
 *   https://developer.android.com/reference/android/database/sqlite/SQLiteOpenHelper
 * - Cache-Aside Architectural Pattern:
 *   https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
 */
public class DatabaseHelper extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "SolarMicrogridLocal.db";
    private static final int DATABASE_VERSION = 2;

    // Table: User Session
    private static final String TABLE_USER = "user_session";
    private static final String COL_NIC = "nic";
    private static final String COL_NAME = "full_name";
    private static final String COL_EMAIL = "email";
    private static final String COL_PHONE = "phone";
    private static final String COL_ADDRESS = "address";
    private static final String COL_ROLE = "role";
    private static final String COL_STATUS = "status";
    private static final String COL_SOLAR_CAPACITY = "solar_capacity";
    private static final String COL_INVERTER_SERIAL = "inverter_serial";
    private static final String COL_TOKEN = "jwt_token";

    // Table: Cached Stations
    private static final String TABLE_STATIONS = "cached_stations";
    private static final String COL_STATION_ID = "id";
    private static final String COL_STATION_CODE = "station_code";
    private static final String COL_STATION_NAME = "name";
    private static final String COL_LATITUDE = "latitude";
    private static final String COL_LONGITUDE = "longitude";
    private static final String COL_STATION_ADDRESS = "address";
    private static final String COL_CAPACITY = "capacity_kwh";
    private static final String COL_TOTAL_SLOTS = "total_slots";
    private static final String COL_AVAILABLE_SLOTS = "available_slots";

    // Table: Cached Reservations
    private static final String TABLE_RESERVATIONS = "cached_reservations";
    private static final String COL_RES_ID = "id";
    private static final String COL_RES_NUMBER = "reservation_number";
    private static final String COL_RES_NIC = "prosumer_nic";
    private static final String COL_RES_STATION_NAME = "station_name";
    private static final String COL_RES_DATETIME = "scheduled_datetime";
    private static final String COL_RES_KWH = "energy_kwh";
    private static final String COL_RES_TYPE = "trade_type";
    private static final String COL_RES_STATUS = "status";
    private static final String COL_RES_QR = "qr_token";

    public DatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // Create user session table
        db.execSQL("CREATE TABLE " + TABLE_USER + " (" +
                COL_NIC + " TEXT PRIMARY KEY, " +
                COL_NAME + " TEXT, " +
                COL_EMAIL + " TEXT, " +
                COL_PHONE + " TEXT, " +
                COL_ADDRESS + " TEXT, " +
                COL_ROLE + " TEXT, " +
                COL_STATUS + " TEXT, " +
                COL_SOLAR_CAPACITY + " REAL, " +
                COL_INVERTER_SERIAL + " TEXT, " +
                COL_TOKEN + " TEXT)");

        // Create cached stations table
        db.execSQL("CREATE TABLE " + TABLE_STATIONS + " (" +
                COL_STATION_ID + " TEXT PRIMARY KEY, " +
                COL_STATION_CODE + " TEXT, " +
                COL_STATION_NAME + " TEXT, " +
                COL_LATITUDE + " REAL, " +
                COL_LONGITUDE + " REAL, " +
                COL_STATION_ADDRESS + " TEXT, " +
                COL_CAPACITY + " REAL, " +
                COL_TOTAL_SLOTS + " INTEGER, " +
                COL_AVAILABLE_SLOTS + " INTEGER)");

        // Create cached reservations table
        db.execSQL("CREATE TABLE " + TABLE_RESERVATIONS + " (" +
                COL_RES_ID + " TEXT PRIMARY KEY, " +
                COL_RES_NUMBER + " TEXT, " +
                COL_RES_NIC + " TEXT, " +
                COL_RES_STATION_NAME + " TEXT, " +
                COL_RES_DATETIME + " TEXT, " +
                COL_RES_KWH + " REAL, " +
                COL_RES_TYPE + " TEXT, " +
                COL_RES_STATUS + " TEXT, " +
                COL_RES_QR + " TEXT)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_USER);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_STATIONS);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_RESERVATIONS);
        onCreate(db);
    }

    // --- USER SESSION OPERATIONS ---

    public void saveUserSession(User user, String token) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.delete(TABLE_USER, null, null); // Keep single active user session

        ContentValues values = new ContentValues();
        values.put(COL_NIC, user.getNic());
        values.put(COL_NAME, user.getFullName());
        values.put(COL_EMAIL, user.getEmail());
        values.put(COL_PHONE, user.getPhone());
        values.put(COL_ADDRESS, user.getAddress());
        values.put(COL_ROLE, user.getRole());
        values.put(COL_STATUS, user.getStatus());
        values.put(COL_SOLAR_CAPACITY, user.getSolarCapacityKw());
        values.put(COL_INVERTER_SERIAL, user.getInverterSerial());
        values.put(COL_TOKEN, token);

        db.insert(TABLE_USER, null, values);
    }

    public User getLoggedInUser() {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery("SELECT * FROM " + TABLE_USER + " LIMIT 1", null);
        if (cursor != null && cursor.moveToFirst()) {
            User user = new User();
            user.setNic(cursor.getString(cursor.getColumnIndexOrThrow(COL_NIC)));
            user.setFullName(cursor.getString(cursor.getColumnIndexOrThrow(COL_NAME)));
            user.setEmail(cursor.getString(cursor.getColumnIndexOrThrow(COL_EMAIL)));
            user.setPhone(cursor.getString(cursor.getColumnIndexOrThrow(COL_PHONE)));
            user.setAddress(cursor.getString(cursor.getColumnIndexOrThrow(COL_ADDRESS)));
            user.setRole(cursor.getString(cursor.getColumnIndexOrThrow(COL_ROLE)));
            user.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_STATUS)));
            user.setSolarCapacityKw(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_SOLAR_CAPACITY)));
            user.setInverterSerial(cursor.getString(cursor.getColumnIndexOrThrow(COL_INVERTER_SERIAL)));
            cursor.close();
            return user;
        }
        if (cursor != null) cursor.close();
        return null;
    }

    public String getAuthToken() {
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery("SELECT " + COL_TOKEN + " FROM " + TABLE_USER + " LIMIT 1", null);
        if (cursor != null && cursor.moveToFirst()) {
            String token = cursor.getString(0);
            cursor.close();
            return token;
        }
        if (cursor != null) cursor.close();
        return "";
    }

    public void clearSession() {
        SQLiteDatabase db = this.getWritableDatabase();
        db.delete(TABLE_USER, null, null);
    }

    public void updateUserProfile(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COL_NAME, fullName);
        values.put(COL_EMAIL, email);
        values.put(COL_PHONE, phone);
        if (address != null) {
            values.put(COL_ADDRESS, address);
        }
        values.put(COL_SOLAR_CAPACITY, solarCapacityKw);
        if (inverterSerial != null) {
            values.put(COL_INVERTER_SERIAL, inverterSerial);
        }
        db.update(TABLE_USER, values, COL_NIC + " = ?", new String[]{nic});
    }

    public void updateUserProfile(String nic, String fullName, String email, String phone, String address) {
        updateUserProfile(nic, fullName, email, phone, address, 15.0, "INV-SL-2026-DEFAULT");
    }

    public void updateUserProfile(String nic, String fullName, String email, String phone) {
        updateUserProfile(nic, fullName, email, phone, null, 15.0, "INV-SL-2026-DEFAULT");
    }

    // --- CACHED STATIONS OPERATIONS ---

    public void cacheStations(List<SolarStation> stations) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(TABLE_STATIONS, null, null);
            for (SolarStation s : stations) {
                ContentValues cv = new ContentValues();
                cv.put(COL_STATION_ID, s.getId());
                cv.put(COL_STATION_CODE, s.getStationCode());
                cv.put(COL_STATION_NAME, s.getName());
                cv.put(COL_LATITUDE, s.getLatitude());
                cv.put(COL_LONGITUDE, s.getLongitude());
                cv.put(COL_ADDRESS, s.getAddress());
                cv.put(COL_CAPACITY, s.getCapacityKwh());
                cv.put(COL_TOTAL_SLOTS, s.getTotalBatterySlots());
                cv.put(COL_AVAILABLE_SLOTS, s.getAvailableBatterySlots());
                db.insertWithOnConflict(TABLE_STATIONS, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public List<SolarStation> getCachedStations() {
        List<SolarStation> list = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery("SELECT * FROM " + TABLE_STATIONS, null);
        if (cursor != null && cursor.moveToFirst()) {
            do {
                SolarStation s = new SolarStation();
                s.setId(cursor.getString(cursor.getColumnIndexOrThrow(COL_STATION_ID)));
                s.setStationCode(cursor.getString(cursor.getColumnIndexOrThrow(COL_STATION_CODE)));
                s.setName(cursor.getString(cursor.getColumnIndexOrThrow(COL_STATION_NAME)));
                s.setLatitude(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_LATITUDE)));
                s.setLongitude(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_LONGITUDE)));
                s.setAddress(cursor.getString(cursor.getColumnIndexOrThrow(COL_ADDRESS)));
                s.setCapacityKwh(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_CAPACITY)));
                s.setTotalBatterySlots(cursor.getInt(cursor.getColumnIndexOrThrow(COL_TOTAL_SLOTS)));
                s.setAvailableBatterySlots(cursor.getInt(cursor.getColumnIndexOrThrow(COL_AVAILABLE_SLOTS)));
                s.setActive(true);
                list.add(s);
            } while (cursor.moveToNext());
            cursor.close();
        }
        return list;
    }

    // --- CACHED RESERVATIONS OPERATIONS ---

    public void cacheReservations(List<EnergyReservation> reservations) {
        SQLiteDatabase db = this.getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(TABLE_RESERVATIONS, null, null);
            for (EnergyReservation r : reservations) {
                ContentValues cv = new ContentValues();
                cv.put(COL_RES_ID, r.getId());
                cv.put(COL_RES_NUMBER, r.getReservationNumber());
                cv.put(COL_RES_NIC, r.getProsumerNic());
                cv.put(COL_RES_STATION_NAME, r.getStationName());
                cv.put(COL_RES_DATETIME, r.getScheduledDateTime());
                cv.put(COL_RES_KWH, r.getEnergyAmountKwh());
                cv.put(COL_RES_TYPE, r.getTradeType());
                cv.put(COL_RES_STATUS, r.getStatus());
                cv.put(COL_RES_QR, r.getQrCodeToken());
                db.insertWithOnConflict(TABLE_RESERVATIONS, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public List<EnergyReservation> getCachedReservations() {
        List<EnergyReservation> list = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.rawQuery("SELECT * FROM " + TABLE_RESERVATIONS + " ORDER BY " + COL_RES_DATETIME + " DESC", null);
        if (cursor != null && cursor.moveToFirst()) {
            do {
                EnergyReservation r = new EnergyReservation();
                r.setId(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_ID)));
                r.setReservationNumber(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_NUMBER)));
                r.setProsumerNic(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_NIC)));
                r.setStationName(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_STATION_NAME)));
                r.setScheduledDateTime(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_DATETIME)));
                r.setEnergyAmountKwh(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_RES_KWH)));
                r.setTradeType(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_TYPE)));
                r.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_STATUS)));
                r.setQrCodeToken(cursor.getString(cursor.getColumnIndexOrThrow(COL_RES_QR)));
                list.add(r);
            } while (cursor.moveToNext());
            cursor.close();
        }
        return list;
    }
}
