package com.ead.solarmicrogrid.data.remote;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.ead.solarmicrogrid.data.local.DatabaseHelper;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.HttpUrl;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/**
 * Smart Auto-Detecting REST API Client connecting Native Android to ASP.NET Core Backend.
 * Automatically fails over between Emulator host (10.0.2.2), ADB Reverse USB host (127.0.0.1),
 * and Genymotion (10.0.3.2) without requiring manual configuration.
 *
 * Authors:
 *   - M.L. Booso (IT23452916) - Auth Interceptors & Token Headers
 *   - G.L.S. Chanlaka (IT23151260) - Station & Geolocation Endpoints
 *   - L.T. Jayawardhana (IT23156760) - Reservation & Auto-Host Resilience
 *   - H.N. Madubashini (IT23192300) - Operator & QR Endpoints
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Third-Party SDKs:
 * - Square Retrofit 2 Type-Safe HTTP Client:
 *   https://square.github.io/retrofit/
 * - OkHttp 3 Dynamic Interceptors & Connection Pool:
 *   https://square.github.io/okhttp/
 */
public class ApiClient {

    private static final String TAG = "ApiClient";
    private static Retrofit retrofit = null;
    private static String activeHost = null;
    private static int activePort = 5000;
    private static String cachedBaseUrl = null;

    public static boolean isEmulator() {
        if (Build.BRAND != null && (
                Build.BRAND.equalsIgnoreCase("Xiaomi")
                || Build.BRAND.equalsIgnoreCase("Redmi")
                || Build.BRAND.equalsIgnoreCase("Samsung")
                || Build.BRAND.equalsIgnoreCase("OnePlus")
                || Build.BRAND.equalsIgnoreCase("Oppo")
                || Build.BRAND.equalsIgnoreCase("Vivo")
                || Build.BRAND.equalsIgnoreCase("Realme")
                || Build.BRAND.equalsIgnoreCase("Huawei")
                || Build.BRAND.equalsIgnoreCase("Honor")
                || Build.BRAND.equalsIgnoreCase("Motorola")
                || Build.BRAND.equalsIgnoreCase("Sony"))) {
            return false;
        }

        return (Build.FINGERPRINT != null && (Build.FINGERPRINT.startsWith("google/sdk_gphone") || Build.FINGERPRINT.startsWith("generic")))
                || (Build.MODEL != null && (Build.MODEL.contains("google_sdk") || Build.MODEL.contains("Emulator") || Build.MODEL.contains("Android SDK built for x86")))
                || (Build.HARDWARE != null && (Build.HARDWARE.equals("goldfish") || Build.HARDWARE.equals("ranchu")))
                || (Build.PRODUCT != null && (Build.PRODUCT.equals("sdk_gphone64_x86_64") || Build.PRODUCT.equals("sdk_gphone_x86") || Build.PRODUCT.equals("sdk_google")))
                || (Build.MANUFACTURER != null && Build.MANUFACTURER.contains("Genymotion"));
    }

    public static String getBaseUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("api_settings", Context.MODE_PRIVATE);
        String customUrl = prefs.getString("server_url", null);
        if (customUrl != null && !customUrl.trim().isEmpty()) {
            String url = customUrl.trim();
            return url.endsWith("/") ? url : url + "/";
        }

        if (activeHost != null && !activeHost.isEmpty()) {
            return "http://" + activeHost + ":" + activePort + "/api/";
        }

        String lastWorkingHost = prefs.getString("last_working_host", null);
        if (lastWorkingHost != null && !lastWorkingHost.isEmpty()) {
            activeHost = lastWorkingHost;
            return "http://" + activeHost + ":" + activePort + "/api/";
        }

        // Default initial candidate:
        if (isEmulator()) {
            activeHost = "10.0.2.2";
        } else {
            // Default to USB reverse, with Wi-Fi fallback
            activeHost = "127.0.0.1";
        }
        activePort = 5000;
        return "http://" + activeHost + ":" + activePort + "/api/";
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
        activeHost = null;
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
                    .connectTimeout(2500, TimeUnit.MILLISECONDS)
                    .readTimeout(8, TimeUnit.SECONDS)
                    .addInterceptor(logging)
                    .addInterceptor(new AutoDetectHostInterceptor(context.getApplicationContext()))
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

    /**
     * Interceptor that transparently tries alternate localhost/LAN/emulator IP candidates if connection fails.
     */
    private static class AutoDetectHostInterceptor implements Interceptor {
        private final Context context;

        public AutoDetectHostInterceptor(Context context) {
            this.context = context;
        }

        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            try {
                return chain.proceed(request);
            } catch (IOException originalException) {
                if (!(originalException instanceof ConnectException || originalException instanceof SocketTimeoutException)) {
                    throw originalException;
                }

                // If user specified custom URL manually, do not override
                SharedPreferences prefs = context.getSharedPreferences("api_settings", Context.MODE_PRIVATE);
                if (prefs.getString("server_url", null) != null) {
                    throw originalException;
                }

                List<String> candidates = new ArrayList<>();
                if (isEmulator()) {
                    candidates.add("10.0.2.2");
                    candidates.add("127.0.0.1");
                    candidates.add("192.168.1.105");
                    candidates.add("10.0.3.2");
                } else {
                    candidates.add("127.0.0.1"); // ADB reverse USB cable (instant 2ms)
                    candidates.add("192.168.1.105"); // Host PC Wi-Fi LAN
                    candidates.add("192.168.1.100");
                }

                // Dynamic Wi-Fi gateway subnet discovery
                try {
                    android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wm != null && wm.getDhcpInfo() != null) {
                        int gateway = wm.getDhcpInfo().gateway;
                        if (gateway != 0) {
                            String gatewayIp = String.format(java.util.Locale.US, "%d.%d.%d.%d",
                                    (gateway & 0xff),
                                    (gateway >> 8 & 0xff),
                                    (gateway >> 16 & 0xff),
                                    (gateway >> 24 & 0xff));
                            String prefix = gatewayIp.substring(0, gatewayIp.lastIndexOf('.') + 1);
                            String host105 = prefix + "105";
                            if (!candidates.contains(host105)) candidates.add(1, host105);
                            if (!candidates.contains(gatewayIp)) candidates.add(gatewayIp);
                        }
                    }
                } catch (Exception ignored) {}

                String failedHost = request.url().host();

                // Ultra-fast probe client with 800ms connect timeout
                OkHttpClient probeClient = new OkHttpClient.Builder()
                        .connectTimeout(800, TimeUnit.MILLISECONDS)
                        .readTimeout(1200, TimeUnit.MILLISECONDS)
                        .build();

                for (String candidate : candidates) {
                    if (candidate.equalsIgnoreCase(failedHost)) continue;

                    HttpUrl probeUrl = request.url().newBuilder()
                            .host(candidate)
                            .port(5000)
                            .build();

                    Request probeRequest = request.newBuilder()
                            .url(probeUrl)
                            .build();

                    try {
                        Response response = probeClient.newCall(probeRequest).execute();
                        if (response.isSuccessful() || response.code() < 500) {
                            Log.i(TAG, "Successfully auto-switched backend host to: " + candidate);
                            activeHost = candidate;
                            activePort = 5000;
                            prefs.edit().putString("last_working_host", candidate).apply();
                            return response;
                        }
                    } catch (IOException ignored) {
                        // Continue to next candidate
                    }
                }

                throw originalException;
            }
        }
    }
}
