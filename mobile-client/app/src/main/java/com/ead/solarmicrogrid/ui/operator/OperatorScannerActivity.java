// ============================================================================
// File: OperatorScannerActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: H.N. Madubashini (IT23192300)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Grid Operator mobile terminal with camera QR scanner, server-side pass verification, and energy dispatch finalization.
// References & Citations:
//   - JourneyApps ZXing Android Embedded BarcodeView:
//     https://github.com/journeyapps/zxing-android-embedded
//   - Android Camera Permissions & CameraManager API:
//     https://developer.android.com/training/camera
//   - Square Retrofit 2 REST Client Integration:
//     https://square.github.io/retrofit/
// ============================================================================

package com.ead.solarmicrogrid.ui.operator;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.local.DatabaseHelper;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.models.EnergyReservation;
import com.ead.solarmicrogrid.data.models.SolarStation;
import com.ead.solarmicrogrid.data.models.User;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.ead.solarmicrogrid.ui.auth.LoginActivity;
import com.ead.solarmicrogrid.util.ThemeManager;
import com.google.android.material.card.MaterialCardView;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.ResultPoint;
import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.DefaultDecoderFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Grid Station Operator Barcode & QR Code Scanner.
 * Author: H.N. Madubashini (IT23192300)
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Third-Party SDKs:
 * - JourneyApps ZXing Android Embedded (Barcode Scanner):
 *   https://github.com/journeyapps/zxing-android-embedded
 * - Google ZXing Core Library:
 *   https://github.com/zxing/zxing
 * - Android Camera Permissions & Lifecycle Handling:
 *   https://developer.android.com/training/permissions/requesting
 */
public class OperatorScannerActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQ = 101;
    private static final int TAB_SCANNER = 0;
    private static final int TAB_QUEUE = 1;
    private static final int TAB_STORAGE = 2;

    private int activeTab = TAB_SCANNER;
    private boolean isProcessingScan = false;
    private boolean isTorchOn = false;

    // Header & KPIs
    private TextView tvOperatorNic, tvOperatorStatusSub;
    private ImageButton btnOperatorRefresh, btnOperatorLogout, btnThemeToggle;
    private TextView tvKpiQueueCount, tvKpiVerifiedCount, tvKpiBatterySlots;

    // Segmented Navigation Tabs
    private TextView btnTabScanner, btnTabQueue, btnTabStorage;
    private View layoutSectionScanner, layoutSectionQueue, layoutSectionStorage;
    private ProgressBar progressBarOperator;

    // Tab 1: Scanner Views
    private DecoratedBarcodeView barcodeScannerView;
    private ImageButton btnToggleTorch;
    private MaterialCardView cardCameraPermission;
    private Button btnGrantCamera;
    private EditText etManualQr;
    private Button btnVerifyManual, btnScanNext;
    private MaterialCardView cardVerifiedResult;
    private TextView tvResultDetails;

    // Tab 2: Queue Views
    private EditText etQueueSearch;
    private TextView chipFilterAll, chipFilterPending, chipFilterApproved, chipFilterCompleted, chipFilterCancelled;
    private SwipeRefreshLayout swipeRefreshQueue;
    private RecyclerView rvOperatorQueue;
    private MaterialCardView cardEmptyQueue;
    private OperatorReservationAdapter queueAdapter;
    private List<EnergyReservation> allReservations = new ArrayList<>();
    private String currentStatusFilter = "All";

    // Tab 3: Storage Views
    private Spinner spinnerStations;
    private TextView tvStationSelectedName, tvStationSelectedCode, tvStationSelectedAddress, tvStationSelectedCapacity, tvStationNodeStatus;
    private TextView tvStorageRatio, tvSlotCount, tvOccupiedSlots;
    private ProgressBar pbBatteryGauge;
    private Button btnSlotMinus, btnSlotPlus, btnSyncBatteryStorage;
    private List<SolarStation> stationList = new ArrayList<>();
    private SolarStation selectedStation = null;
    private int currentAvailableSlots = 0;

    private DatabaseHelper dbHelper;
    private User currentUser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_operator_scanner);

        dbHelper = new DatabaseHelper(this);
        currentUser = dbHelper.getLoggedInUser();

        initViews();
        setupBarcodeScanner(savedInstanceState);
        setupTabs();
        setupQueueRecyclerView();
        setupFilterChips();
        setupStorageControls();
        setupListeners();

        checkCameraPermissionAndStart();
        fetchOperatorData();

        int startTab = getIntent().getIntExtra("tab", TAB_SCANNER);
        if (startTab != TAB_SCANNER) {
            switchTab(startTab);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        int targetTab = intent.getIntExtra("tab", activeTab);
        switchTab(targetTab);
    }

    private void initViews() {
        // Header
        tvOperatorNic = findViewById(R.id.tvOperatorNic);
        tvOperatorStatusSub = findViewById(R.id.tvOperatorStatusSub);
        btnOperatorRefresh = findViewById(R.id.btnOperatorRefresh);
        btnOperatorLogout = findViewById(R.id.btnOperatorLogout);
        btnThemeToggle = findViewById(R.id.btnThemeToggle);

        // KPIs
        tvKpiQueueCount = findViewById(R.id.tvKpiQueueCount);
        tvKpiVerifiedCount = findViewById(R.id.tvKpiVerifiedCount);
        tvKpiBatterySlots = findViewById(R.id.tvKpiBatterySlots);

        // Tabs
        btnTabScanner = findViewById(R.id.btnTabScanner);
        btnTabQueue = findViewById(R.id.btnTabQueue);
        btnTabStorage = findViewById(R.id.btnTabStorage);

        // Sections
        layoutSectionScanner = findViewById(R.id.layoutSectionScanner);
        layoutSectionQueue = findViewById(R.id.layoutSectionQueue);
        layoutSectionStorage = findViewById(R.id.layoutSectionStorage);
        progressBarOperator = findViewById(R.id.progressBarOperator);

        // Scanner Section
        barcodeScannerView = findViewById(R.id.barcodeScannerView);
        btnToggleTorch = findViewById(R.id.btnToggleTorch);
        cardCameraPermission = findViewById(R.id.cardCameraPermission);
        btnGrantCamera = findViewById(R.id.btnGrantCamera);
        etManualQr = findViewById(R.id.etManualQr);
        btnVerifyManual = findViewById(R.id.btnVerifyManual);
        btnScanNext = findViewById(R.id.btnScanNext);
        cardVerifiedResult = findViewById(R.id.cardVerifiedResult);
        tvResultDetails = findViewById(R.id.tvResultDetails);

        // Queue Section
        etQueueSearch = findViewById(R.id.etQueueSearch);
        chipFilterAll = findViewById(R.id.chipFilterAll);
        chipFilterPending = findViewById(R.id.chipFilterPending);
        chipFilterApproved = findViewById(R.id.chipFilterApproved);
        chipFilterCompleted = findViewById(R.id.chipFilterCompleted);
        chipFilterCancelled = findViewById(R.id.chipFilterCancelled);
        swipeRefreshQueue = findViewById(R.id.swipeRefreshQueue);
        rvOperatorQueue = findViewById(R.id.rvOperatorQueue);
        cardEmptyQueue = findViewById(R.id.cardEmptyQueue);

        // Storage Section
        spinnerStations = findViewById(R.id.spinnerStations);
        tvStationSelectedName = findViewById(R.id.tvStationSelectedName);
        tvStationSelectedCode = findViewById(R.id.tvStationSelectedCode);
        tvStationSelectedAddress = findViewById(R.id.tvStationSelectedAddress);
        tvStationSelectedCapacity = findViewById(R.id.tvStationSelectedCapacity);
        tvStationNodeStatus = findViewById(R.id.tvStationNodeStatus);
        tvStorageRatio = findViewById(R.id.tvStorageRatio);
        tvSlotCount = findViewById(R.id.tvSlotCount);
        tvOccupiedSlots = findViewById(R.id.tvOccupiedSlots);
        pbBatteryGauge = findViewById(R.id.pbBatteryGauge);
        btnSlotMinus = findViewById(R.id.btnSlotMinus);
        btnSlotPlus = findViewById(R.id.btnSlotPlus);
        btnSyncBatteryStorage = findViewById(R.id.btnSyncBatteryStorage);

        if (currentUser != null) {
            tvOperatorNic.setText(currentUser.getFullName() + " (" + currentUser.getNic() + ")");
        }
    }

    private void setupBarcodeScanner(Bundle savedInstanceState) {
        barcodeScannerView.initializeFromIntent(getIntent());
        barcodeScannerView.setStatusText("");
        barcodeScannerView.getBarcodeView().setDecoderFactory(
                new DefaultDecoderFactory(Collections.singletonList(BarcodeFormat.QR_CODE))
        );

        barcodeScannerView.decodeContinuous(new BarcodeCallback() {
            @Override
            public void barcodeResult(BarcodeResult result) {
                if (result.getText() != null && !isProcessingScan && activeTab == TAB_SCANNER) {
                    isProcessingScan = true;
                    runOnUiThread(() -> verifyQrCodeOnServer(result.getText()));
                }
            }

            @Override
            public void possibleResultPoints(List<ResultPoint> resultPoints) {}
        });
    }

    private void setupTabs() {
        btnTabScanner.setOnClickListener(v -> switchTab(TAB_SCANNER));
        btnTabQueue.setOnClickListener(v -> switchTab(TAB_QUEUE));
        btnTabStorage.setOnClickListener(v -> switchTab(TAB_STORAGE));
    }

    private void switchTab(int targetTab) {
        activeTab = targetTab;

        // Update Tab visual styles
        updateTabButton(btnTabScanner, targetTab == TAB_SCANNER, R.drawable.ic_qr_code);
        updateTabButton(btnTabQueue, targetTab == TAB_QUEUE, R.drawable.ic_clock);
        updateTabButton(btnTabStorage, targetTab == TAB_STORAGE, R.drawable.ic_battery_charging);

        // Section visibility & camera lifecycle
        if (targetTab == TAB_SCANNER) {
            layoutSectionScanner.setVisibility(View.VISIBLE);
            layoutSectionQueue.setVisibility(View.GONE);
            layoutSectionStorage.setVisibility(View.GONE);
            tvOperatorStatusSub.setText("QR Scanner Active");

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                barcodeScannerView.resume();
            }
        } else if (targetTab == TAB_QUEUE) {
            layoutSectionScanner.setVisibility(View.GONE);
            layoutSectionQueue.setVisibility(View.VISIBLE);
            layoutSectionStorage.setVisibility(View.GONE);
            tvOperatorStatusSub.setText("Live Station Queue");

            barcodeScannerView.pause();
        } else {
            layoutSectionScanner.setVisibility(View.GONE);
            layoutSectionQueue.setVisibility(View.GONE);
            layoutSectionStorage.setVisibility(View.VISIBLE);
            tvOperatorStatusSub.setText("Storage Hub Inventory");

            barcodeScannerView.pause();
        }
    }

    private void updateTabButton(TextView tabView, boolean isSelected, int iconRes) {
        if (isSelected) {
            tabView.setBackgroundResource(R.drawable.bg_tab_selected);
            tabView.setTextColor(ContextCompat.getColor(this, R.color.background_dark));
            tabView.setCompoundDrawablesWithIntrinsicBounds(iconRes, 0, 0, 0);
            tabView.getCompoundDrawables()[0].setTint(ContextCompat.getColor(this, R.color.background_dark));
        } else {
            tabView.setBackgroundResource(R.drawable.bg_tab_unselected);
            tabView.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
            tabView.setCompoundDrawablesWithIntrinsicBounds(iconRes, 0, 0, 0);
            tabView.getCompoundDrawables()[0].setTint(ContextCompat.getColor(this, R.color.text_secondary));
        }
    }

    private void setupQueueRecyclerView() {
        rvOperatorQueue.setLayoutManager(new LinearLayoutManager(this));
        queueAdapter = new OperatorReservationAdapter(this, new OperatorReservationAdapter.OnOperatorActionListener() {
            @Override
            public void onVerify(EnergyReservation reservation) {
                String token = reservation.getQrCodeToken();
                if (token != null && !token.isEmpty()) {
                    verifyQrCodeOnServer(token);
                } else {
                    Toast.makeText(OperatorScannerActivity.this, "This reservation has no QR token.", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onCancel(EnergyReservation reservation) {
                showCancelOverrideDialog(reservation);
            }
        });
        rvOperatorQueue.setAdapter(queueAdapter);

        swipeRefreshQueue.setColorSchemeColors(ContextCompat.getColor(this, R.color.accent));
        swipeRefreshQueue.setOnRefreshListener(this::fetchReservations);

        etQueueSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int count, int after) {
                queueAdapter.filter(s != null ? s.toString() : "", currentStatusFilter);
                updateEmptyQueueState();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void setupFilterChips() {
        View.OnClickListener chipListener = v -> {
            resetChipStyles();
            TextView selected = (TextView) v;
            selected.setBackgroundResource(R.drawable.bg_pill_chip_active);
            selected.setTextColor(ContextCompat.getColor(this, R.color.primary));

            currentStatusFilter = selected.getText().toString();
            String query = etQueueSearch.getText() != null ? etQueueSearch.getText().toString() : "";
            queueAdapter.filter(query, currentStatusFilter);
            updateEmptyQueueState();
        };

        chipFilterAll.setOnClickListener(chipListener);
        chipFilterPending.setOnClickListener(chipListener);
        chipFilterApproved.setOnClickListener(chipListener);
        chipFilterCompleted.setOnClickListener(chipListener);
        chipFilterCancelled.setOnClickListener(chipListener);
    }

    private void resetChipStyles() {
        int defaultColor = ContextCompat.getColor(this, R.color.text_secondary);
        chipFilterAll.setBackgroundResource(R.drawable.bg_pill_chip);
        chipFilterAll.setTextColor(defaultColor);
        chipFilterPending.setBackgroundResource(R.drawable.bg_pill_chip);
        chipFilterPending.setTextColor(defaultColor);
        chipFilterApproved.setBackgroundResource(R.drawable.bg_pill_chip);
        chipFilterApproved.setTextColor(defaultColor);
        chipFilterCompleted.setBackgroundResource(R.drawable.bg_pill_chip);
        chipFilterCompleted.setTextColor(defaultColor);
        chipFilterCancelled.setBackgroundResource(R.drawable.bg_pill_chip);
        chipFilterCancelled.setTextColor(defaultColor);
    }

    private void updateEmptyQueueState() {
        if (queueAdapter.getFilteredCount() == 0) {
            cardEmptyQueue.setVisibility(View.VISIBLE);
        } else {
            cardEmptyQueue.setVisibility(View.GONE);
        }
    }

    private void setupStorageControls() {
        btnSlotMinus.setOnClickListener(v -> {
            if (currentAvailableSlots > 0) {
                currentAvailableSlots--;
                updateStorageDisplay();
            }
        });

        btnSlotPlus.setOnClickListener(v -> {
            if (selectedStation != null && currentAvailableSlots < selectedStation.getTotalBatterySlots()) {
                currentAvailableSlots++;
                updateStorageDisplay();
            }
        });

        btnSyncBatteryStorage.setOnClickListener(v -> syncBatterySlots());
    }

    private void setupListeners() {
        if (btnThemeToggle != null) {
            btnThemeToggle.setImageResource(ThemeManager.isDarkMode(this) ? R.drawable.ic_sun : R.drawable.ic_moon);
            btnThemeToggle.setOnClickListener(v -> ThemeManager.toggleTheme(this));
        }

        btnOperatorRefresh.setOnClickListener(v -> {
            fetchOperatorData();
            Toast.makeText(this, "Refreshing grid data...", Toast.LENGTH_SHORT).show();
        });

        btnOperatorLogout.setOnClickListener(v -> {
            dbHelper.clearSession();
            startActivity(new Intent(OperatorScannerActivity.this, LoginActivity.class));
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
            finish();
        });

        if (btnGrantCamera != null) {
            btnGrantCamera.setOnClickListener(v -> {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQ);
            });
        }

        btnToggleTorch.setOnClickListener(v -> {
            isTorchOn = !isTorchOn;
            if (isTorchOn) {
                barcodeScannerView.setTorchOn();
                btnToggleTorch.setColorFilter(ContextCompat.getColor(this, R.color.accent));
            } else {
                barcodeScannerView.setTorchOff();
                btnToggleTorch.setColorFilter(ContextCompat.getColor(this, R.color.primary));
            }
        });

        btnVerifyManual.setOnClickListener(v -> {
            String token = etManualQr.getText() != null ? etManualQr.getText().toString().trim() : "";
            if (token.isEmpty()) {
                Toast.makeText(OperatorScannerActivity.this, "Enter QR token to verify.", Toast.LENGTH_SHORT).show();
                return;
            }
            if (!token.matches("SOLAR-TX:RES-[^:]+:[0-9A-Fa-f]{12}")) {
                Toast.makeText(OperatorScannerActivity.this, "Enter a valid QR token, not a reservation number.", Toast.LENGTH_SHORT).show();
                return;
            }
            verifyQrCodeOnServer(token);
        });

        btnScanNext.setOnClickListener(v -> {
            cardVerifiedResult.setVisibility(View.GONE);
            etManualQr.setText("");
            isProcessingScan = false;
        });
    }

    // =========================================================================
    // API OPERATIONS & DATA FETCHING
    // =========================================================================

    private void fetchOperatorData() {
        progressBarOperator.setVisibility(View.VISIBLE);
        fetchReservations();
        fetchStations();
    }

    private void fetchReservations() {
        ApiClient.getService(this).getAllReservations().enqueue(new Callback<List<EnergyReservation>>() {
            @Override
            public void onResponse(Call<List<EnergyReservation>> call, Response<List<EnergyReservation>> response) {
                progressBarOperator.setVisibility(View.GONE);
                swipeRefreshQueue.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    allReservations = response.body();
                    queueAdapter.setData(allReservations);
                    updateEmptyQueueState();

                    // Calculate KPIs
                    int queueCount = 0;
                    int verifiedCount = 0;

                    for (EnergyReservation item : allReservations) {
                        String status = item.getStatus();
                        if ("Pending".equalsIgnoreCase(status) || "Approved".equalsIgnoreCase(status)) {
                            queueCount++;
                        } else if ("Completed".equalsIgnoreCase(status)) {
                            verifiedCount++;
                        }
                    }

                    tvKpiQueueCount.setText(String.valueOf(queueCount));
                    tvKpiVerifiedCount.setText(String.valueOf(verifiedCount));
                }
            }

            @Override
            public void onFailure(Call<List<EnergyReservation>> call, Throwable t) {
                progressBarOperator.setVisibility(View.GONE);
                swipeRefreshQueue.setRefreshing(false);
            }
        });
    }

    private void fetchStations() {
        ApiClient.getService(this).getStations(false).enqueue(new Callback<List<SolarStation>>() {
            @Override
            public void onResponse(Call<List<SolarStation>> call, Response<List<SolarStation>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    stationList = response.body();

                    // Total available slots KPI
                    int totalAvailable = 0;
                    List<String> names = new ArrayList<>();
                    for (SolarStation station : stationList) {
                        totalAvailable += station.getAvailableBatterySlots();
                        names.add(station.getName() + " (" + station.getStationCode() + ")");
                    }
                    tvKpiBatterySlots.setText(String.valueOf(totalAvailable));

                    ArrayAdapter<String> spinnerAdapter = new ArrayAdapter<>(OperatorScannerActivity.this,
                            android.R.layout.simple_spinner_dropdown_item, names);
                    spinnerStations.setAdapter(spinnerAdapter);

                    spinnerStations.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                        @Override
                        public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                            if (position >= 0 && position < stationList.size()) {
                                selectedStation = stationList.get(position);
                                currentAvailableSlots = selectedStation.getAvailableBatterySlots();
                                displayStationDetails(selectedStation);
                            }
                        }

                        @Override
                        public void onNothingSelected(AdapterView<?> parent) {}
                    });

                    if (!stationList.isEmpty() && selectedStation == null) {
                        selectedStation = stationList.get(0);
                        currentAvailableSlots = selectedStation.getAvailableBatterySlots();
                        displayStationDetails(selectedStation);
                    }
                }
            }

            @Override
            public void onFailure(Call<List<SolarStation>> call, Throwable t) {}
        });
    }

    private void displayStationDetails(SolarStation station) {
        if (station == null) return;

        tvStationSelectedName.setText(station.getName());
        tvStationSelectedCode.setText("Station Code: " + station.getStationCode());
        tvStationSelectedAddress.setText(station.getAddress());
        tvStationSelectedCapacity.setText(station.getCapacityKwh() + " kWh Storage Capacity");

        if (station.isActive()) {
            tvStationNodeStatus.setText("Active Node");
            tvStationNodeStatus.setBackgroundResource(R.drawable.bg_badge_approved);
            tvStationNodeStatus.setTextColor(ContextCompat.getColor(this, R.color.badge_approved_text));
        } else {
            tvStationNodeStatus.setText("Offline / Maintenance");
            tvStationNodeStatus.setBackgroundResource(R.drawable.bg_badge_cancelled);
            tvStationNodeStatus.setTextColor(ContextCompat.getColor(this, R.color.badge_cancelled_text));
        }

        updateStorageDisplay();
    }

    private void updateStorageDisplay() {
        if (selectedStation == null) return;

        int total = selectedStation.getTotalBatterySlots();
        if (total <= 0) total = 10;

        tvSlotCount.setText(String.valueOf(currentAvailableSlots));
        int occupied = Math.max(0, total - currentAvailableSlots);
        tvOccupiedSlots.setText("Occupied / Reserved Slots: " + occupied);

        int percent = (int) (((double) currentAvailableSlots / total) * 100);
        tvStorageRatio.setText(currentAvailableSlots + " / " + total + " Slots (" + percent + "%)");
        pbBatteryGauge.setProgress(percent);
    }

    private void syncBatterySlots() {
        if (selectedStation == null) {
            Toast.makeText(this, "No station selected.", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBarOperator.setVisibility(View.VISIBLE);
        btnSyncBatteryStorage.setEnabled(false);

        AuthDtos.UpdateBatterySlotsRequest req = new AuthDtos.UpdateBatterySlotsRequest(currentAvailableSlots);

        ApiClient.getService(this).updateBatterySlots(selectedStation.getId(), req).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBarOperator.setVisibility(View.GONE);
                btnSyncBatteryStorage.setEnabled(true);

                if (response.isSuccessful()) {
                    selectedStation.setAvailableBatterySlots(currentAvailableSlots);
                    Toast.makeText(OperatorScannerActivity.this, "Station storage synchronized with Central Grid!", Toast.LENGTH_SHORT).show();
                    fetchStations();
                } else {
                    String errorMsg = "Failed to update storage slots (" + response.code() + ")";
                    try {
                        if (response.errorBody() != null) {
                            errorMsg += ": " + response.errorBody().string();
                        }
                    } catch (Exception ignored) {}
                    Toast.makeText(OperatorScannerActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                progressBarOperator.setVisibility(View.GONE);
                btnSyncBatteryStorage.setEnabled(true);
                Toast.makeText(OperatorScannerActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void verifyQrCodeOnServer(String qrToken) {
        progressBarOperator.setVisibility(View.VISIBLE);
        cardVerifiedResult.setVisibility(View.GONE);

        String stationId = selectedStation != null ? selectedStation.getId() : null;
        AuthDtos.VerifyQrRequest request = new AuthDtos.VerifyQrRequest(qrToken, stationId);

        ApiClient.getService(this).verifyQr(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBarOperator.setVisibility(View.GONE);

                if (response.isSuccessful()) {
                    cardVerifiedResult.setVisibility(View.VISIBLE);
                    tvResultDetails.setText("Verified Token: " + qrToken + "\nStatus: Completed & Grid Finalized");
                    Toast.makeText(OperatorScannerActivity.this, "Energy Transfer Completed & Verified!", Toast.LENGTH_SHORT).show();
                    fetchReservations();
                } else {
                    Toast.makeText(OperatorScannerActivity.this, "Invalid or already completed QR code.", Toast.LENGTH_LONG).show();
                }

                barcodeScannerView.postDelayed(() -> isProcessingScan = false, 3000);
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                progressBarOperator.setVisibility(View.GONE);
                Toast.makeText(OperatorScannerActivity.this, "API Connection error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                barcodeScannerView.postDelayed(() -> isProcessingScan = false, 3000);
            }
        });
    }

    private void showCancelOverrideDialog(EnergyReservation reservation) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Operator Cancellation Override");
        builder.setMessage("Cancel reservation " + reservation.getReservationNumber() + " for prosumer " + reservation.getProsumerNic() + "?");

        final EditText etReason = new EditText(this);
        etReason.setHint("Cancellation reason (e.g. Driver no-show / Grid imbalance)");
        etReason.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        etReason.setHintTextColor(ContextCompat.getColor(this, R.color.text_muted));
        etReason.setBackgroundResource(R.drawable.bg_search_input);
        etReason.setPadding(30, 24, 30, 24);
        builder.setView(etReason);

        builder.setPositiveButton("Confirm Cancellation", (dialog, which) -> {
            String reason = etReason.getText() != null ? etReason.getText().toString().trim() : "";
            if (reason.isEmpty()) reason = "Operator assistance override: Schedule elapsed.";

            progressBarOperator.setVisibility(View.VISIBLE);
            ApiClient.getService(this).cancelReservation(reservation.getId(), new AuthDtos.CancelRequest(reason))
                    .enqueue(new Callback<ResponseBody>() {
                        @Override
                        public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                            progressBarOperator.setVisibility(View.GONE);
                            if (response.isSuccessful()) {
                                Toast.makeText(OperatorScannerActivity.this, "Reservation cancelled successfully.", Toast.LENGTH_SHORT).show();
                                fetchReservations();
                            } else {
                                Toast.makeText(OperatorScannerActivity.this, "Failed to cancel reservation.", Toast.LENGTH_LONG).show();
                            }
                        }

                        @Override
                        public void onFailure(Call<ResponseBody> call, Throwable t) {
                            progressBarOperator.setVisibility(View.GONE);
                            Toast.makeText(OperatorScannerActivity.this, "Error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
        });

        builder.setNegativeButton("Dismiss", (dialog, which) -> dialog.dismiss());
        builder.show();
    }

    // =========================================================================
    // PERMISSIONS & LIFECYCLE
    // =========================================================================

    private void checkCameraPermissionAndStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            if (cardCameraPermission != null) cardCameraPermission.setVisibility(View.VISIBLE);
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQ);
        } else {
            if (cardCameraPermission != null) cardCameraPermission.setVisibility(View.GONE);
            if (activeTab == TAB_SCANNER) barcodeScannerView.resume();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQ) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (cardCameraPermission != null) cardCameraPermission.setVisibility(View.GONE);
                if (activeTab == TAB_SCANNER) barcodeScannerView.resume();
            } else {
                if (cardCameraPermission != null) cardCameraPermission.setVisibility(View.VISIBLE);
                Toast.makeText(this, "Camera permission needed to scan barcodes.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (activeTab == TAB_SCANNER && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            barcodeScannerView.resume();
            if (cardCameraPermission != null) cardCameraPermission.setVisibility(View.GONE);
        }
        isProcessingScan = false;
    }

    @Override
    protected void onPause() {
        super.onPause();
        barcodeScannerView.pause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            barcodeScannerView.getBarcodeView().stopDecoding();
        } catch (Exception ignored) {}
    }
}
