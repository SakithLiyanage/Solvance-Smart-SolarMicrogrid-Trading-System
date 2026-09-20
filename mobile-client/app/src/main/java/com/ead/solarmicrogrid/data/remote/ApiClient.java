package com.ead.solarmicrogrid.data.remote;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.ead.solarmicrogrid.data.local.DatabaseHelper;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/**
 * REST API Client connecting Native Android to ASP.NET Core FAT Backend.
 * Authors:
 *   - M.L. Booso (IT23452916) - Auth Interceptors & Token Headers
 *   - G.L.S. Chanlaka (IT23151260) - Station & Geolocation Endpoints
 *   - L.T. Jayawardhana (IT23156760) - Reservation Endpoints
 *   - H.N. Madubashini (IT23192300) - Operator & QR Endpoints
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Third-Party SDKs:
 * - Square Retrofit 2 Type-Safe HTTP Client:
 *   https://square.github.io/retrofit/
 * - OkHttp 3 Interceptor & Connection Pool:
 *   https://square.github.io/okhttp/
 */
public class ApiClient {

    private static Retrofit retrofit = null;
    private static String cachedBaseUrl = null;

    public static boolean isEmulator() {
        return (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
                || Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.HARDWARE.contains("goldfish")
                || Build.HARDWARE.contains("ranchu")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || Build.PRODUCT.contains("sdk_google")
                || Build.PRODUCT.contains("google_sdk")
                || Build.PRODUCT.contains("sdk")
                || Build.PRODUCT.contains("sdk_x86")
                || Build.PRODUCT.contains("vbox86p")
                || Build.PRODUCT.contains("emulator")
                || Build.PRODUCT.contains("simulator");
    }

    public static String getBaseUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("api_settings", Context.MODE_PRIVATE);
        String customUrl = prefs.getString("server_url", null);
        if (customUrl != null && !customUrl.trim().isEmpty()) {
            String url = customUrl.trim();
            return url.endsWith("/") ? url : url + "/";
        }

        // Auto-detect environment:
        // On Android Studio emulators, 10.0.2.2 connects to host machine.
        // On physical devices (like Xiaomi Redmi Note 13), 127.0.0.1 connects via adb reverse tcp:5000 tcp:5000.
        if (isEmulator()) {
            return "http://10.0.2.2:5000/api/";
        } else {
            return "http://127.0.0.1:5000/api/";
        }
    }

    public static void setBaseUrl(Context context, String newUrl) {
        if (newUrl == null || newUrl.trim().isEmpty()) return;
        String url = newUrl.trim();
        if (!url.endsWith("/")) {
            url += "/";
        }
        SharedPreferences prefs = context.getSharedPreferences("api_settings", Context.MODE_PRIVATE);
        prefs.edit().putString("server_url", url).apply();
        retrofit = null;
        cachedBaseUrl = null;
    }

    public static SolarApiService getService(Context context) {
        String currentUrl = getBaseUrl(context);
        if (retrofit == null || !currentUrl.equals(cachedBaseUrl)) {
            cachedBaseUrl = currentUrl;
            final DatabaseHelper dbHelper = new DatabaseHelper(context.getApplicationContext());

            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(com.ead.solarmicrogrid.BuildConfig.DEBUG 
                    ? HttpLoggingInterceptor.Level.BODY 
                    : HttpLoggingInterceptor.Level.BASIC);

            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(12, TimeUnit.SECONDS)
                    .readTimeout(12, TimeUnit.SECONDS)
                    .addInterceptor(logging)
                    .addInterceptor(chain -> {
                        Request original = chain.request();
                        String token = dbHelper.getAuthToken();

                        Request.Builder requestBuilder = original.newBuilder()
                                .header("Content-Type", "application/json");

                        if (token != null && !token.isEmpty()) {
                            requestBuilder.header("Authorization", "Bearer " + token);
                        }

                        Request request = requestBuilder.build();
                        return chain.proceed(request);
                    })
                    .build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(currentUrl)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return retrofit.create(SolarApiService.class);
    }
}
