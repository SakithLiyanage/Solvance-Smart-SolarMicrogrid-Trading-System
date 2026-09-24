// ============================================================================
// File: StationsMapActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Microgrid station geolocation interface featuring live Google Maps vector tiles, GPS clustering, and station telemetry cards.
// References & Citations:
//   - Google Play Services Maps SDK for Android:
//     https://developers.google.com/maps/documentation/android-sdk
//   - Android Runtime Permissions & Location Manager:
//     https://developer.android.com/training/permissions/requesting
//   - Android SQLite Database Session & Cache:
//     https://developer.android.com/training/data-storage/sqlite
// ============================================================================

package com.ead.solarmicrogrid.ui.prosumer;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
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
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

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
 */
public class StationsMapActivity extends AppCompatActivity implements OnMapReadyCallback, GoogleMap.OnMarkerClickListener {

    // Google Maps Components
    private GoogleMap googleMap;
    private SupportMapFragment googleMapFragment;

    // UI & State
    private TextView tvMapTitle, tvMapStationCountBadge;
    private MaterialButton btnCloseMap, btnNavigateMaps;
    private MaterialCardView cardStationDetails;
    private TextView tvMapStationName, tvMapStationAddress, tvMapCapacity, tvMapBatterySlots, tvMapHubStatusPill;

    private List<SolarStation> cachedStationList = new ArrayList<>();
    private SolarStation currentSelectedStation;
    private DatabaseHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_stations_map);

        dbHelper = new DatabaseHelper(this);

        initViews();
        setupGoogleMap();
        loadStationMarkers();
    }

    private void initViews() {
        tvMapTitle = findViewById(R.id.tvMapTitle);
        tvMapStationCountBadge = findViewById(R.id.tvMapStationCountBadge);
        btnCloseMap = findViewById(R.id.btnCloseMap);
        btnNavigateMaps = findViewById(R.id.btnNavigateMaps);

        cardStationDetails = findViewById(R.id.cardStationDetails);
        tvMapStationName = findViewById(R.id.tvMapStationName);
        tvMapStationAddress = findViewById(R.id.tvMapStationAddress);
        tvMapCapacity = findViewById(R.id.tvMapCapacity);
        tvMapBatterySlots = findViewById(R.id.tvMapBatterySlots);
        tvMapHubStatusPill = findViewById(R.id.tvMapHubStatusPill);

        btnCloseMap.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

        btnNavigateMaps.setOnClickListener(v -> {
            if (currentSelectedStation != null) {
                double lat = currentSelectedStation.getLatitude();
                double lng = currentSelectedStation.getLongitude();
                String label = currentSelectedStation.getName();
                Uri gmmIntentUri = Uri.parse("geo:" + lat + "," + lng + "?q=" + lat + "," + lng + "(" + Uri.encode(label) + ")");
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
                mapIntent.setPackage("com.google.android.apps.maps");
                if (mapIntent.resolveActivity(getPackageManager()) != null) {
                    startActivity(mapIntent);
                } else {
                    Uri webUri = Uri.parse("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng);
                    startActivity(new Intent(Intent.ACTION_VIEW, webUri));
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
    public boolean onMarkerClick(@NonNull Marker marker) {
        Object tag = marker.getTag();
        if (tag instanceof SolarStation) {
            showStationDetails((SolarStation) tag);
        }
        return false; // Show default info window and center
    }

    private void loadStationMarkers() {
        // 1. Load from local SQLite cache first (offline resilience)
        List<SolarStation> cached = dbHelper.getCachedStations();
        if (!cached.isEmpty()) {
            cachedStationList = cached;
            updateCountBadge(cachedStationList.size());
            plotGoogleMapStations(cachedStationList);
        }

        // 2. Fetch live station coordinates from API
        ApiClient.getService(this).getStations(true).enqueue(new Callback<List<SolarStation>>() {
            @Override
            public void onResponse(Call<List<SolarStation>> call, Response<List<SolarStation>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    cachedStationList = response.body();
                    updateCountBadge(cachedStationList.size());
                    dbHelper.cacheStations(cachedStationList);
                    plotGoogleMapStations(cachedStationList);
                }
            }

            @Override
            public void onFailure(Call<List<SolarStation>> call, Throwable t) {
                Toast.makeText(StationsMapActivity.this, "Displaying offline cached solar stations.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateCountBadge(int count) {
        if (tvMapStationCountBadge != null) {
            tvMapStationCountBadge.setText(count + " Active Hubs");
        }
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

            Marker marker = googleMap.addMarker(new MarkerOptions()
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

    private void showStationDetails(SolarStation station) {
        currentSelectedStation = station;
        tvMapStationName.setText(station.getName());
        tvMapStationAddress.setText(station.getAddress());
        tvMapCapacity.setText("Capacity: " + station.getCapacityKwh() + " kW/h");
        tvMapBatterySlots.setText(station.getAvailableBatterySlots() + " of " + station.getTotalBatterySlots() + " slots free");
        
        if (tvMapHubStatusPill != null) {
            tvMapHubStatusPill.setText(station.isActive() ? "Active Hub" : "Offline Node");
        }
        
        cardStationDetails.setVisibility(View.VISIBLE);
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
    }
}
