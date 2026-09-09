package com.ead.solarmicrogrid.ui.prosumer;

import android.os.Bundle;
import android.preference.PreferenceManager;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.local.DatabaseHelper;
import com.ead.solarmicrogrid.data.models.SolarStation;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.google.android.material.card.MaterialCardView;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.CustomZoomButtonsController;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StationsMapActivity extends AppCompatActivity {

    private MapView mapView;
    private IMapController mapController;
    private MaterialCardView cardStationDetails;
    private TextView tvMapStationName, tvMapStationAddress, tvMapCapacity, tvMapBatterySlots;
    private Button btnCloseMap, btnNavigateMaps;
    private SolarStation currentSelectedStation;

    private DatabaseHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure osmdroid user agent and preferences (100% free OpenStreetMap)
        Configuration.getInstance().load(this, PreferenceManager.getDefaultSharedPreferences(this));
        Configuration.getInstance().setUserAgentValue(getPackageName());

        setContentView(R.layout.activity_stations_map);

        dbHelper = new DatabaseHelper(this);

        initViews();
        setupOsmMap();
        loadStationMarkers();
    }

    private void initViews() {
        mapView = findViewById(R.id.osmMapView);
        cardStationDetails = findViewById(R.id.cardStationDetails);
        tvMapStationName = findViewById(R.id.tvMapStationName);
        tvMapStationAddress = findViewById(R.id.tvMapStationAddress);
        tvMapCapacity = findViewById(R.id.tvMapCapacity);
        tvMapBatterySlots = findViewById(R.id.tvMapBatterySlots);
        btnCloseMap = findViewById(R.id.btnCloseMap);
        btnNavigateMaps = findViewById(R.id.btnNavigateMaps);

        btnCloseMap.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

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

    private void setupOsmMap() {
        if (mapView == null) return;

        mapView.setTileSource(TileSourceFactory.MAPNIK);
        mapView.setMultiTouchControls(true);
        mapView.getZoomController().setVisibility(CustomZoomButtonsController.Visibility.ALWAYS);

        mapController = mapView.getController();
        mapController.setZoom(12.5);

        // Default to Colombo center until stations load
        GeoPoint defaultPoint = new GeoPoint(6.9271, 79.8612);
        mapController.setCenter(defaultPoint);
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (mapView != null) mapView.onResume();
    }

    @Override
    public void onPause() {
        super.onPause();
        if (mapView != null) mapView.onPause();
    }

    private void loadStationMarkers() {
        // Load from local SQLite cache first
        List<SolarStation> cachedStations = dbHelper.getCachedStations();
        if (!cachedStations.isEmpty()) {
            plotStations(cachedStations);
        }

        // Fetch live station coordinates from API
        ApiClient.getService(this).getStations(true).enqueue(new Callback<List<SolarStation>>() {
            @Override
            public void onResponse(Call<List<SolarStation>> call, Response<List<SolarStation>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    List<SolarStation> liveStations = response.body();
                    dbHelper.cacheStations(liveStations);
                    plotStations(liveStations);
                }
            }

            @Override
            public void onFailure(Call<List<SolarStation>> call, Throwable t) {
                Toast.makeText(StationsMapActivity.this, "Displaying offline cached solar stations.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void plotStations(List<SolarStation> stations) {
        if (mapView == null || stations.isEmpty()) return;

        mapView.getOverlays().clear();
        GeoPoint firstPos = null;

        for (SolarStation s : stations) {
            GeoPoint pos = new GeoPoint(s.getLatitude(), s.getLongitude());
            if (firstPos == null) {
                firstPos = pos;
            }

            Marker marker = new Marker(mapView);
            marker.setPosition(pos);
            marker.setTitle(s.getName());
            marker.setSnippet(s.getAddress() + "\n" + s.getAvailableBatterySlots() + "/" + s.getTotalBatterySlots() + " slots free");
            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);

            marker.setOnMarkerClickListener((m, v) -> {
                showStationDetails(s);
                return true;
            });

            mapView.getOverlays().add(marker);
        }

        if (firstPos != null) {
            mapController.setCenter(firstPos);
            mapView.invalidate();
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
}
