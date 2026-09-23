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

        if (activeHost != null && !activeHost.isEmpty()) {
            return "http://" + activeHost + ":" + activePort + "/api/";
        }

        // Default initial candidate:
        if (isEmulator()) {
            activeHost = "10.0.2.2";
        } else {
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
                    .connectTimeout(8, TimeUnit.SECONDS)
                    .readTimeout(10, TimeUnit.SECONDS)
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
     * Interceptor that transparently tries alternate localhost/emulator IP candidates if connection fails.
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
                    candidates.add("10.0.3.2");
                } else {
                    candidates.add("127.0.0.1"); // ADB reverse USB cable
                    candidates.add("10.0.2.2");
                    candidates.add("192.168.1.100");
                }

                String failedHost = request.url().host();

                for (String candidate : candidates) {
                    if (candidate.equalsIgnoreCase(failedHost)) continue;

                    HttpUrl newUrl = request.url().newBuilder()
                            .host(candidate)
                            .port(5000)
                            .build();

                    Request newRequest = request.newBuilder()
                            .url(newUrl)
                            .build();

                    try {
                        Response response = chain.proceed(newRequest);
                        if (response.isSuccessful() || response.code() < 500) {
                            Log.i(TAG, "Successfully auto-switched backend host to: " + candidate);
                            activeHost = candidate;
                            activePort = 5000;
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
