package com.ead.solarmicrogrid.data.remote;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.ead.solarmicrogrid.data.local.DatabaseHelper;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.net.ConnectException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

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
        String savedUrl = prefs.getString("server_url", null);
        if (savedUrl != null && !savedUrl.trim().isEmpty()) {
            return savedUrl.trim();
        }

        if (activeHost != null && !activeHost.isEmpty()) {
            return "http://" + activeHost + ":" + activePort + "/api/";
        }

        String lastWorkingHost = prefs.getString("last_working_host", null);
        if (lastWorkingHost != null && !lastWorkingHost.isEmpty()) {
            activeHost = lastWorkingHost;
            return "http://" + activeHost + ":" + activePort + "/api/";
        }

        // Standard Universal Configuration:
        if (isEmulator()) {
            activeHost = "10.0.2.2";
        } else {
            // Default directly to hosted API on Wi-Fi LAN
            activeHost = "192.168.1.105";
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

        try {
            android.net.Uri uri = android.net.Uri.parse(url);
            if (uri.getHost() != null) {
                activeHost = uri.getHost();
                if (uri.getPort() > 0) activePort = uri.getPort();
                prefs.edit().putString("last_working_host", activeHost).apply();
            }
        } catch (Exception ignored) {}

        retrofit = null;
        cachedBaseUrl = null;
    }

    public static void setServerIp(Context context, String input) {
        if (input == null || input.trim().isEmpty()) return;
        String raw = input.trim();
        String host = raw;
        int port = 5000;

        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            setBaseUrl(context, raw);
            return;
        }

        if (raw.contains(":")) {
            String[] parts = raw.split(":");
            host = parts[0];
            try {
                port = Integer.parseInt(parts[1]);
            } catch (Exception ignored) {}
        }

        activeHost = host;
        activePort = port;
        String url = "http://" + host + ":" + port + "/api/";
        setBaseUrl(context, url);
    }

    /**
     * Fast TCP ping to verify if a remote host has port open within timeoutMs.
     */
    public static boolean isPortReachable(String host, int port, int timeoutMs) {
        if (host == null || host.isEmpty()) return false;
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Concurrently scans a /24 subnet for any host listening on port 5000.
     * Uses 48 lightweight TCP socket workers with 200ms connect timeout.
     */
    public static String scanSubnetForPort5000(String prefix, int port) {
        if (prefix == null || prefix.isEmpty()) return null;
        int threads = 48;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        final AtomicReference<String> foundIp = new AtomicReference<>(null);
        final CountDownLatch latch = new CountDownLatch(254);

        for (int i = 1; i <= 254; i++) {
            final String targetIp = prefix + i;
            executor.execute(() -> {
                if (foundIp.get() != null) {
                    latch.countDown();
                    return;
                }
                try (Socket socket = new Socket()) {
                    socket.connect(new InetSocketAddress(targetIp, port), 200);
                    if (foundIp.compareAndSet(null, targetIp)) {
                        Log.i(TAG, "Subnet scan found active Solvance host on: " + targetIp);
                    }
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            });
        }

        try {
            latch.await(2000, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ignored) {}
        executor.shutdownNow();

        return foundIp.get();
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
                    .connectTimeout(3000, TimeUnit.MILLISECONDS)
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
     * Universal Host Interceptor that transparently auto-discovers and connects
     * to the Solvance backend host without requiring manual configuration.
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

                SharedPreferences prefs = context.getSharedPreferences("api_settings", Context.MODE_PRIVATE);

                List<String> candidates = new ArrayList<>();
                List<String> detectedPrefixes = new ArrayList<>();

                if (isEmulator()) {
                    candidates.add("10.0.2.2");
                    candidates.add("192.168.1.105");
                    candidates.add("127.0.0.1");
                    candidates.add("10.0.3.2");
                } else {
                    candidates.add("192.168.1.105"); // Host PC Wi-Fi LAN (Primary)
                    candidates.add("127.0.0.1");     // ADB reverse USB cable fallback
                    candidates.add("10.0.2.2");      // Emulator fallback
                }

                // 1. If phone runs a Wi-Fi Hotspot, parse connected PC IP directly from Linux ARP table
                try {
                    BufferedReader br = new BufferedReader(new FileReader("/proc/net/arp"));
                    String line;
                    while ((line = br.readLine()) != null) {
                        String[] tokens = line.split("\\s+");
                        if (tokens.length >= 4 && tokens[0].matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
                            String arpIp = tokens[0];
                            if (!candidates.contains(arpIp) && !arpIp.endsWith(".255")) {
                                candidates.add(0, arpIp); // Direct connected hotspot device tested first
                            }
                        }
                    }
                    br.close();
                } catch (Exception ignored) {}

                // 2. Discover local subnet from all active network interfaces (Wi-Fi, Hotspot, USB Tethering)
                try {
                    Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
                    while (ifaces != null && ifaces.hasMoreElements()) {
                        NetworkInterface iface = ifaces.nextElement();
                        if (iface.isLoopback() || !iface.isUp()) continue;
                        Enumeration<InetAddress> addrs = iface.getInetAddresses();
                        while (addrs.hasMoreElements()) {
                            InetAddress addr = addrs.nextElement();
                            if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                                String hostIp = addr.getHostAddress();
                                if (hostIp != null && hostIp.contains(".")) {
                                    String prefix = hostIp.substring(0, hostIp.lastIndexOf('.') + 1);
                                    if (!detectedPrefixes.contains(prefix)) detectedPrefixes.add(prefix);
                                    if (!candidates.contains(prefix + "1")) candidates.add(prefix + "1");
                                    if (!candidates.contains(prefix + "105")) candidates.add(prefix + "105");
                                    if (!candidates.contains(prefix + "100")) candidates.add(prefix + "100");
                                    if (!candidates.contains(prefix + "2")) candidates.add(prefix + "2");
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}

                // 3. Dynamic Wi-Fi gateway subnet discovery via WifiManager
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
                            if (!detectedPrefixes.contains(prefix)) detectedPrefixes.add(prefix);
                            String host105 = prefix + "105";
                            if (!candidates.contains(host105)) candidates.add(0, host105);
                            if (!candidates.contains(gatewayIp)) candidates.add(gatewayIp);
                        }
                    }
                } catch (Exception ignored) {}

                String failedHost = request.url().host();

                // Lightweight non-blocking probe client for health checking
                OkHttpClient probeClient = new OkHttpClient.Builder()
                        .connectTimeout(1500, TimeUnit.MILLISECONDS)
                        .readTimeout(1500, TimeUnit.MILLISECONDS)
                        .build();

                for (String candidate : candidates) {
                    if (candidate.equalsIgnoreCase(failedHost)) continue;

                    // Fast TCP reachability check (200ms) before attempting HTTP call
                    if (!isPortReachable(candidate, activePort, 200)) {
                        continue;
                    }

                    HttpUrl probeUrl = new HttpUrl.Builder()
                            .scheme("http")
                            .host(candidate)
                            .port(activePort)
                            .addPathSegment("api")
                            .addPathSegment("stations")
                            .build();

                    Request probeRequest = new Request.Builder()
                            .url(probeUrl)
                            .get()
                            .build();

                    try (Response probeResponse = probeClient.newCall(probeRequest).execute()) {
                        if (probeResponse.isSuccessful() || probeResponse.code() < 500) {
                            Log.i(TAG, "Successfully auto-detected Solvance backend host: " + candidate);
                            activeHost = candidate;
                            prefs.edit().putString("last_working_host", candidate)
                                    .putString("server_url", "http://" + candidate + ":" + activePort + "/api/")
                                    .apply();

                            // Seamlessly rewrite original request and proceed
                            HttpUrl newUrl = request.url().newBuilder()
                                    .host(candidate)
                                    .port(activePort)
                                    .build();

                            Request redirectedRequest = request.newBuilder()
                                    .url(newUrl)
                                    .build();

                            return chain.proceed(redirectedRequest);
                        }
                    } catch (IOException ignored) {
                        // Continue to next candidate
                    }
                }

                // 4. If direct candidates did not respond, perform concurrent subnet scan on active network prefixes
                for (String prefix : detectedPrefixes) {
                    String discoveredHost = scanSubnetForPort5000(prefix, activePort);
                    if (discoveredHost != null) {
                        Log.i(TAG, "Subnet scan successfully connected to Solvance host: " + discoveredHost);
                        activeHost = discoveredHost;
                        prefs.edit().putString("last_working_host", discoveredHost)
                                .putString("server_url", "http://" + discoveredHost + ":" + activePort + "/api/")
                                .apply();

                        HttpUrl newUrl = request.url().newBuilder()
                                .host(discoveredHost)
                                .port(activePort)
                                .build();

                        Request redirectedRequest = request.newBuilder()
                                .url(newUrl)
                                .build();

                        return chain.proceed(redirectedRequest);
                    }
                }

                throw originalException;
            }
        }
    }
}
