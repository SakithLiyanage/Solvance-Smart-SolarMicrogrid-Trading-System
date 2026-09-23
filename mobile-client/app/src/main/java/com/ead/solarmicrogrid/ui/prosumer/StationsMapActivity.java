// ============================================================================
// File: StationsMapActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Microgrid station geolocation interface featuring live Google Maps vector tiles, GPS clustering, and station telemetry cards.
// References & Citations:
//   - Google Play Services Maps SDK for Android:
//     https://developers.google.com/maps/documentation/android-sdk
//   - OpenStreetMap Android (osmdroid) Fallback Integration:
//     https://github.com/osmdroid/osmdroid
//   - Android Runtime Permissions & Location Manager:
//     https://developer.android.com/training/permissions/requesting
// ============================================================================

package com.ead.solarmicrogrid.ui.prosumer;

import android.os.Bundle;
import android.preference.PreferenceManager;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.local.DatabaseHelper;
import com.ead.solarmicrogrid.data.models.SolarStation;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.CustomZoomButtonsController;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Interactive Solar Microgrid Nodes Map.
 * Author: G.L.S. Chanlaka (IT23151260)
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Third-Party SDKs:
 * - Google Play Services Maps SDK (com.google.android.gms.maps):
 *   https://developers.google.com/maps/documentation/android-sdk
 * - Android SupportMapFragment & GoogleMap API:
 *   https://developers.google.com/android/reference/com/google/android/gms/maps/SupportMapFragment
 * - OpenStreetMap Android (org.osmdroid):
 *   https://github.com/osmdroid/osmdroid
 */
public class StationsMapActivity extends AppCompatActivity implements OnMapReadyCallback, GoogleMap.OnMarkerClickListener {

    // Google Maps Components
    private GoogleMap googleMap;
    private SupportMapFragment googleMapFragment;
    private View googleMapViewContainer;

    // OpenStreetMap Components
    private MapView osmMapView;
    private IMapController osmMapController;

    // UI & State
    private TextView tvMapTitle;
    private MaterialButton btnSwitchEngine, btnCloseMap, btnNavigateMaps;
    private MaterialCardView cardStationDetails;
    private TextView tvMapStationName, tvMapStationAddress, tvMapCapacity, tvMapBatterySlots;

    private boolean isGoogleMapActive = true;
    private List<SolarStation> cachedStationList = new ArrayList<>();
    private SolarStation currentSelectedStation;
    private DatabaseHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure osmdroid user agent and preferences
        Configuration.getInstance().load(this, PreferenceManager.getDefaultSharedPreferences(this));
        Configuration.getInstance().setUserAgentValue(getPackageName());

        setContentView(R.layout.activity_stations_map);

        dbHelper = new DatabaseHelper(this);

        initViews();
        setupGoogleMap();
        setupOsmMap();
        loadStationMarkers();
    }

    private void initViews() {
        tvMapTitle = findViewById(R.id.tvMapTitle);
        btnSwitchEngine = findViewById(R.id.btnSwitchEngine);
        btnCloseMap = findViewById(R.id.btnCloseMap);
        btnNavigateMaps = findViewById(R.id.btnNavigateMaps);

        googleMapViewContainer = findViewById(R.id.googleMapFragment);
        osmMapView = findViewById(R.id.osmMapView);
        cardStationDetails = findViewById(R.id.cardStationDetails);

        tvMapStationName = findViewById(R.id.tvMapStationName);
        tvMapStationAddress = findViewById(R.id.tvMapStationAddress);
        tvMapCapacity = findViewById(R.id.tvMapCapacity);
        tvMapBatterySlots = findViewById(R.id.tvMapBatterySlots);

        btnCloseMap.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

        // Toggle between official Google Maps API and OSM offline layer
        btnSwitchEngine.setOnClickListener(v -> toggleMapEngine());

        btnNavigateMaps.setOnClickListener(v -> {
            if (currentSelectedStation != null) {
                double lat = currentSelectedStation.getLatitude();
                double lng = currentSelectedStation.getLongitude();
                String label = currentSelectedStation.getName();
                android.net.Uri gmmIntentUri = android.net.Uri.parse("geo:" + lat + "," + lng + "?q=" + lat + "," + lng + "(" + android.net.Uri.encode(label) + ")");
                android.content.Intent mapIntent = new android.content.Intent(android.content.Intent.ACTION_VIEW, gmmIntentUri);
                mapIntent.setPackage("com.google.android.apps.maps");
                if (mapIntent.resolveActivity(getPackageManager()) != null) {
                    startActivity(mapIntent);
                } else {
                    android.net.Uri webUri = android.net.Uri.parse("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng);
                    startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, webUri));
                }
            }
        });
    }

    private void setupGoogleMap() {
        googleMapFragment = (SupportMapFragment) getSupportFragmentManager().findFragmentById(R.id.googleMapFragment);
        if (googleMapFragment != null) {
            googleMapFragment.getMapAsync(this);
        }
    }

    @Override
    public void onMapReady(@NonNull GoogleMap gMap) {
        this.googleMap = gMap;

        // Configure Google Maps UI settings
        googleMap.getUiSettings().setZoomControlsEnabled(true);
        googleMap.getUiSettings().setCompassEnabled(true);
        googleMap.getUiSettings().setMyLocationButtonEnabled(true);
        googleMap.getUiSettings().setMapToolbarEnabled(true);
        googleMap.setOnMarkerClickListener(this);

        // Plot any stations already loaded
        if (!cachedStationList.isEmpty()) {
            plotGoogleMapStations(cachedStationList);
        }
    }

    @Override
    public boolean onMarkerClick(@NonNull com.google.android.gms.maps.model.Marker marker) {
        Object tag = marker.getTag();
        if (tag instanceof SolarStation) {
            showStationDetails((SolarStation) tag);
        }
        return false; // Show default info window and center
    }

    private void setupOsmMap() {
        if (osmMapView == null) return;

        osmMapView.setTileSource(TileSourceFactory.MAPNIK);
        osmMapView.setMultiTouchControls(true);
        osmMapView.getZoomController().setVisibility(CustomZoomButtonsController.Visibility.ALWAYS);

        osmMapController = osmMapView.getController();
        osmMapController.setZoom(12.5);

        GeoPoint defaultPoint = new GeoPoint(6.9271, 79.8612);
        osmMapController.setCenter(defaultPoint);
    }

    private void toggleMapEngine() {
        isGoogleMapActive = !isGoogleMapActive;

        if (isGoogleMapActive) {
            if (googleMapViewContainer != null) googleMapViewContainer.setVisibility(View.VISIBLE);
            if (osmMapView != null) osmMapView.setVisibility(View.GONE);
            tvMapTitle.setText("Google Maps API");
            btnSwitchEngine.setText("OSM Tile");
            Toast.makeText(this, "Active Engine: Google Maps API", Toast.LENGTH_SHORT).show();
            if (googleMap != null && !cachedStationList.isEmpty()) {
                plotGoogleMapStations(cachedStationList);
            }
        } else {
            if (googleMapViewContainer != null) googleMapViewContainer.setVisibility(View.GONE);
            if (osmMapView != null) {
                osmMapView.setVisibility(View.VISIBLE);
                osmMapView.invalidate();
            }
            tvMapTitle.setText("OpenStreetMap Layer");
            btnSwitchEngine.setText("Google Map");
            Toast.makeText(this, "Active Engine: OpenStreetMap Layer", Toast.LENGTH_SHORT).show();
            if (!cachedStationList.isEmpty()) {
                plotOsmStations(cachedStationList);
            }
        }
    }

    private void loadStationMarkers() {
        // 1. Load from local SQLite cache first (offline resilience)
        List<SolarStation> cached = dbHelper.getCachedStations();
        if (!cached.isEmpty()) {
            cachedStationList = cached;
            plotGoogleMapStations(cachedStationList);
            plotOsmStations(cachedStationList);
        }

        // 2. Fetch live station coordinates from API
        ApiClient.getService(this).getStations(true).enqueue(new Callback<List<SolarStation>>() {
            @Override
            public void onResponse(Call<List<SolarStation>> call, Response<List<SolarStation>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    cachedStationList = response.body();
                    dbHelper.cacheStations(cachedStationList);
                    plotGoogleMapStations(cachedStationList);
                    plotOsmStations(cachedStationList);
                }
            }

            @Override
            public void onFailure(Call<List<SolarStation>> call, Throwable t) {
                Toast.makeText(StationsMapActivity.this, "Displaying offline cached solar stations.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void plotGoogleMapStations(List<SolarStation> stations) {
        if (googleMap == null || stations.isEmpty()) return;

        googleMap.clear();
        LatLng firstPos = null;

        for (SolarStation s : stations) {
            LatLng pos = new LatLng(s.getLatitude(), s.getLongitude());
            if (firstPos == null) {
                firstPos = pos;
            }

            com.google.android.gms.maps.model.Marker marker = googleMap.addMarker(new MarkerOptions()
                    .position(pos)
                    .title(s.getName())
                    .snippet(s.getAvailableBatterySlots() + " of " + s.getTotalBatterySlots() + " slots free | " + s.getCapacityKwh() + " kW/h")
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE)));

            if (marker != null) {
                marker.setTag(s);
            }
        }

        if (firstPos != null) {
            googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(firstPos, 12.0f));
            showStationDetails(stations.get(0));
        }
    }

    private void plotOsmStations(List<SolarStation> stations) {
        if (osmMapView == null || stations.isEmpty()) return;

        osmMapView.getOverlays().clear();
        GeoPoint firstPos = null;

        for (SolarStation s : stations) {
            GeoPoint pos = new GeoPoint(s.getLatitude(), s.getLongitude());
            if (firstPos == null) {
                firstPos = pos;
            }

            Marker marker = new Marker(osmMapView);
            marker.setPosition(pos);
            marker.setTitle(s.getName());
            marker.setSnippet(s.getAddress() + "\n" + s.getAvailableBatterySlots() + "/" + s.getTotalBatterySlots() + " slots free");
            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);

            marker.setOnMarkerClickListener((m, v) -> {
                showStationDetails(s);
                return true;
            });

            osmMapView.getOverlays().add(marker);
        }

        if (firstPos != null) {
            osmMapController.setCenter(firstPos);
            osmMapView.invalidate();
            showStationDetails(stations.get(0));
        }
    }

    private void showStationDetails(SolarStation station) {
        currentSelectedStation = station;
        tvMapStationName.setText(station.getName());
        tvMapStationAddress.setText(station.getAddress());
        tvMapCapacity.setText("Capacity: " + station.getCapacityKwh() + " kW/h");
        tvMapBatterySlots.setText(station.getAvailableBatterySlots() + " of " + station.getTotalBatterySlots() + " slots free");
        cardStationDetails.setVisibility(View.VISIBLE);
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (osmMapView != null) osmMapView.onResume();
    }

    @Override
    public void onPause() {
        super.onPause();
        if (osmMapView != null) osmMapView.onPause();
    }
}
