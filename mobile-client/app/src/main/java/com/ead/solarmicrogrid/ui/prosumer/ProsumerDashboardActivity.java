// ============================================================================
// File: ProsumerDashboardActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors: M.L. Booso (IT23452916) & G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Central prosumer dashboard with live energy metrics, bookings list, filter chips, and executive account bottom sheet.
// References & Citations:
//   - Material Design 3 BottomSheetDialog & Cards:
//     https://material.io/components/bottom-sheets/android
//   - Android SwipeRefreshLayout & RecyclerView:
//     https://developer.android.com/develop/ui/views/touch-and-input/swipe/add-swipe-interface
//   - Android SQLite Database Session & Cache:
//     https://developer.android.com/training/data-storage/sqlite
// ============================================================================

package com.ead.solarmicrogrid.ui.prosumer;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.local.DatabaseHelper;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.models.EnergyReservation;
import com.ead.solarmicrogrid.data.models.User;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.ead.solarmicrogrid.ui.auth.LoginActivity;
import com.ead.solarmicrogrid.util.ThemeManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProsumerDashboardActivity extends AppCompatActivity {

    private SwipeRefreshLayout swipeRefresh;
    private androidx.core.widget.NestedScrollView nestedScrollView;
    private TextView tvWelcomeName, tvNicBadge;
    private TextView tvTotalKwhTraded, tvActiveCount, tvPendingCount, tvCompletedCount;
    private LinearLayout btnBookSlot, btnOpenMaps, btnActivePass, btnGridPolicy;
    private View navTabGrid, navTabTrade, navTabSwap, navTabVault;
    private ImageButton btnSyncLive, btnThemeToggle;
    private View btnEditProfile, btnDeactivateAccount, btnLogout;

    // Filter Chips
    private TextView chipFilterAll, chipFilterActive, chipFilterPending, chipFilterCompleted, chipFilterCancelled;
    private TextView tvFilterCountBadge;
    private String currentFilter = "ALL";

    private EditText etSearchBookings;
    private RecyclerView rvReservations;
    private ReservationAdapter adapter;

    private LinearLayout layoutEmptyState;
    private TextView tvEmptyTitle, tvEmptyMessage;
    private Button btnEmptyBook;

    private DatabaseHelper dbHelper;
    private User currentUser;
    private List<EnergyReservation> allReservations = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_prosumer_dashboard);

        dbHelper = new DatabaseHelper(this);
        currentUser = dbHelper.getLoggedInUser();

        if (currentUser == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupListeners();
        loadOfflineData();
        refreshLiveData();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshLiveData();
    }

    private void initViews() {
        swipeRefresh = findViewById(R.id.swipeRefresh);
        nestedScrollView = findViewById(R.id.nestedScrollView);
        tvWelcomeName = findViewById(R.id.tvWelcomeName);
        tvNicBadge = findViewById(R.id.tvNicBadge);

        tvTotalKwhTraded = findViewById(R.id.tvTotalKwhTraded);
        tvActiveCount = findViewById(R.id.tvActiveCount);
        tvPendingCount = findViewById(R.id.tvPendingCount);
        tvCompletedCount = findViewById(R.id.tvCompletedCount);

        btnBookSlot = findViewById(R.id.btnBookSlot);
        btnOpenMaps = findViewById(R.id.btnOpenMaps);
        btnActivePass = findViewById(R.id.btnActivePass);
        btnGridPolicy = findViewById(R.id.btnGridPolicy);

        navTabGrid = findViewById(R.id.navTabGrid);
        navTabTrade = findViewById(R.id.navTabTrade);
        navTabSwap = findViewById(R.id.navTabSwap);
        navTabVault = findViewById(R.id.navTabVault);

        btnThemeToggle = findViewById(R.id.btnThemeToggle);
        btnSyncLive = findViewById(R.id.btnSyncLive);
        btnEditProfile = findViewById(R.id.btnEditProfile);
        btnDeactivateAccount = findViewById(R.id.btnDeactivateAccount);
        btnLogout = findViewById(R.id.btnLogout);

        chipFilterAll = findViewById(R.id.chipFilterAll);
        chipFilterActive = findViewById(R.id.chipFilterActive);
        chipFilterPending = findViewById(R.id.chipFilterPending);
        chipFilterCompleted = findViewById(R.id.chipFilterCompleted);
        chipFilterCancelled = findViewById(R.id.chipFilterCancelled);
        tvFilterCountBadge = findViewById(R.id.tvFilterCountBadge);

        etSearchBookings = findViewById(R.id.etSearchBookings);
        rvReservations = findViewById(R.id.rvReservations);

        layoutEmptyState = findViewById(R.id.layoutEmptyState);
        tvEmptyTitle = findViewById(R.id.tvEmptyTitle);
        tvEmptyMessage = findViewById(R.id.tvEmptyMessage);
        btnEmptyBook = findViewById(R.id.btnEmptyBook);

        tvWelcomeName.setText(currentUser.getFullName());
        tvNicBadge.setText("NIC: " + currentUser.getNic());

        TextView tvInitials = findViewById(R.id.tvProsumerInitials);
        if (tvInitials != null) {
            String name = currentUser.getFullName() != null ? currentUser.getFullName().trim() : "SP";
            String[] parts = name.split("\\s+");
            String initials = parts.length >= 2 
                    ? ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase() 
                    : ("" + name.charAt(0)).toUpperCase();
            tvInitials.setText(initials);
        }

        rvReservations.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ReservationAdapter(this, new ArrayList<>());
        rvReservations.setAdapter(adapter);
    }

    private void setupListeners() {
        if (btnThemeToggle != null) {
            btnThemeToggle.setImageResource(ThemeManager.isDarkMode(this) ? R.drawable.ic_sun : R.drawable.ic_moon);
            btnThemeToggle.setOnClickListener(v -> ThemeManager.toggleTheme(this));
        }

        swipeRefresh.setOnRefreshListener(this::refreshLiveData);

        btnSyncLive.setOnClickListener(v -> refreshLiveData());

        if (btnEditProfile != null) {
            btnEditProfile.setOnClickListener(v -> showEditProfileDialog());
        }

        btnBookSlot.setOnClickListener(v -> openBookSlot());

        btnEmptyBook.setOnClickListener(v -> openBookSlot());

        btnOpenMaps.setOnClickListener(v -> {
            startActivity(new Intent(ProsumerDashboardActivity.this, StationsMapActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        btnActivePass.setOnClickListener(v -> openActivePass());

        btnGridPolicy.setOnClickListener(v -> showGridPolicyDialog());

        // Bottom Navigation Bar Quick Action Hub
        if (navTabGrid != null) {
            navTabGrid.setOnClickListener(v -> {
                if (nestedScrollView != null) {
                    nestedScrollView.smoothScrollTo(0, 0);
                }
                refreshLiveData();
            });
        }

        if (navTabTrade != null) {
            navTabTrade.setOnClickListener(v -> openBookSlot());
        }

        if (navTabSwap != null) {
            navTabSwap.setOnClickListener(v -> {
                startActivity(new Intent(ProsumerDashboardActivity.this, StationsMapActivity.class));
                overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
            });
        }

        if (navTabVault != null) {
            navTabVault.setOnClickListener(v -> showAccountBottomSheet());
        }

        btnLogout.setOnClickListener(v -> {
            dbHelper.clearSession();
            startActivity(new Intent(ProsumerDashboardActivity.this, LoginActivity.class));
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
            finish();
        });

        btnDeactivateAccount.setOnClickListener(v -> confirmDeactivateAccount());

        View avatarContainer = findViewById(R.id.layoutAvatarContainer);
        if (avatarContainer != null) {
            avatarContainer.setOnClickListener(v -> showAccountBottomSheet());
        }

        // Setup filter chips
        chipFilterAll.setOnClickListener(v -> setFilter("ALL"));
        chipFilterActive.setOnClickListener(v -> setFilter("ACTIVE"));
        chipFilterPending.setOnClickListener(v -> setFilter("PENDING"));
        chipFilterCompleted.setOnClickListener(v -> setFilter("COMPLETED"));
        chipFilterCancelled.setOnClickListener(v -> setFilter("CANCELLED"));

        etSearchBookings.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                applyFilters();
            }
            @Override public void afterTextChanged(Editable s) {}
        });
    }

    private void openBookSlot() {
        startActivity(new Intent(ProsumerDashboardActivity.this, CreateReservationActivity.class));
        overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
    }

    private void openActivePass() {
        EnergyReservation activeRes = null;
        for (EnergyReservation r : allReservations) {
            String st = r.getStatus() != null ? r.getStatus() : "";
            if ("Approved".equalsIgnoreCase(st) || "Pending".equalsIgnoreCase(st)) {
                activeRes = r;
                break;
            }
        }

        if (activeRes != null) {
            Intent intent = new Intent(this, ReservationDetailActivity.class);
            intent.putExtra("id", activeRes.getId());
            intent.putExtra("resNumber", activeRes.getReservationNumber());
            intent.putExtra("stationName", activeRes.getStationName());
            intent.putExtra("scheduled", activeRes.getScheduledDateTime());
            intent.putExtra("kwh", activeRes.getEnergyAmountKwh());
            intent.putExtra("tradeType", activeRes.getTradeType());
            intent.putExtra("status", activeRes.getStatus());
            intent.putExtra("qrToken", activeRes.getQrCodeToken());
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        } else {
            Toast.makeText(this, "No active pass scheduled. Tap 'Book Energy Slot' to create one.", Toast.LENGTH_LONG).show();
        }
    }

    private void showGridPolicyDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Solar Microgrid Rules & Tariff")
                .setMessage("1. 7-Day Scheduling Window:\nBook battery drop-off or vehicle charging slots up to 7 days in advance.\n\n"
                        + "2. 12-Hour Cancellation Rule:\nCancellations and modifications strictly require at least 12 hours notice prior to appointment time.\n\n"
                        + "3. Verification Pass:\nShow your generated QR pass to the Station Grid Operator upon arrival to unlock the assigned battery slot.")
                .setPositiveButton("Got It", null)
                .show();
    }

    private void setFilter(String filter) {
        currentFilter = filter;
        updateChipStyles();
        applyFilters();
    }

    private void updateChipStyles() {
        resetChip(chipFilterAll);
        resetChip(chipFilterActive);
        resetChip(chipFilterPending);
        resetChip(chipFilterCompleted);
        resetChip(chipFilterCancelled);

        switch (currentFilter) {
            case "ALL":
                highlightChip(chipFilterAll);
                break;
            case "ACTIVE":
                highlightChip(chipFilterActive);
                break;
            case "PENDING":
                highlightChip(chipFilterPending);
                break;
            case "COMPLETED":
                highlightChip(chipFilterCompleted);
                break;
            case "CANCELLED":
                highlightChip(chipFilterCancelled);
                break;
        }
    }

    private void resetChip(TextView chip) {
        chip.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip));
        chip.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
    }

    private void highlightChip(TextView chip) {
        chip.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip_active));
        chip.setTextColor(ContextCompat.getColor(this, R.color.primary));
    }

    private void loadOfflineData() {
        List<EnergyReservation> cached = dbHelper.getCachedReservations();
        if (!cached.isEmpty()) {
            allReservations = cached;
            calculateHeroMetrics();
            applyFilters();
        }
    }

    private void refreshLiveData() {
        swipeRefresh.setRefreshing(true);

        // Fetch live prosumer reservations
        ApiClient.getService(this).getProsumerReservations(currentUser.getNic()).enqueue(new Callback<List<EnergyReservation>>() {
            @Override
            public void onResponse(Call<List<EnergyReservation>> call, Response<List<EnergyReservation>> response) {
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    allReservations = response.body();
                    calculateHeroMetrics();
                    applyFilters();

                    // Cache locally in SQLite
                    dbHelper.cacheReservations(allReservations);
                }
            }

            @Override
            public void onFailure(Call<List<EnergyReservation>> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(ProsumerDashboardActivity.this, "Offline mode: Showing cached energy bookings.", Toast.LENGTH_SHORT).show();
            }
        });

        // Also fetch live aggregated dashboard metrics
        ApiClient.getService(this).getDashboardStats(currentUser.getNic()).enqueue(new Callback<AuthDtos.DashboardStats>() {
            @Override
            public void onResponse(Call<AuthDtos.DashboardStats> call, Response<AuthDtos.DashboardStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    AuthDtos.DashboardStats stats = response.body();
                    tvActiveCount.setText(String.valueOf(stats.approvedFutureBookingsCount));
                    tvPendingCount.setText(String.valueOf(stats.pendingBookingsCount));
                }
            }

            @Override
            public void onFailure(Call<AuthDtos.DashboardStats> call, Throwable t) {
                // Keep local calculations on failure
            }
        });
    }

    private void calculateHeroMetrics() {
        double totalKwh = 0.0;
        int active = 0;
        int pending = 0;
        int completed = 0;

        for (EnergyReservation r : allReservations) {
            totalKwh += r.getEnergyAmountKwh();
            String st = r.getStatus() != null ? r.getStatus() : "";
            if ("Approved".equalsIgnoreCase(st)) {
                active++;
            } else if ("Pending".equalsIgnoreCase(st)) {
                pending++;
            } else if ("Completed".equalsIgnoreCase(st)) {
                completed++;
            }
        }

        tvTotalKwhTraded.setText(String.format(Locale.US, "%.1f", totalKwh));
        tvActiveCount.setText(String.valueOf(active));
        tvPendingCount.setText(String.valueOf(pending));
        tvCompletedCount.setText(String.valueOf(completed));
    }

    private void applyFilters() {
        String query = etSearchBookings.getText() != null ? etSearchBookings.getText().toString().trim().toLowerCase() : "";

        List<EnergyReservation> filtered = new ArrayList<>();
        for (EnergyReservation r : allReservations) {
            String status = r.getStatus() != null ? r.getStatus() : "";
            boolean matchesStatus = false;

            switch (currentFilter) {
                case "ALL":
                    matchesStatus = true;
                    break;
                case "ACTIVE":
                    matchesStatus = "Approved".equalsIgnoreCase(status);
                    break;
                case "PENDING":
                    matchesStatus = "Pending".equalsIgnoreCase(status);
                    break;
                case "COMPLETED":
                    matchesStatus = "Completed".equalsIgnoreCase(status);
                    break;
                case "CANCELLED":
                    matchesStatus = "Cancelled".equalsIgnoreCase(status);
                    break;
            }

            if (!matchesStatus) continue;

            if (query.isEmpty()) {
                filtered.add(r);
            } else {
                String station = r.getStationName() != null ? r.getStationName().toLowerCase() : "";
                String resNum = r.getReservationNumber() != null ? r.getReservationNumber().toLowerCase() : "";
                if (station.contains(query) || resNum.contains(query)) {
                    filtered.add(r);
                }
            }
        }

        adapter.updateData(filtered);
        tvFilterCountBadge.setText(String.format(Locale.US, "Showing %s (%d)", currentFilter.toLowerCase(), filtered.size()));

        if (filtered.isEmpty()) {
            layoutEmptyState.setVisibility(View.VISIBLE);
            if (!query.isEmpty()) {
                tvEmptyTitle.setText("No Matches Found");
                tvEmptyMessage.setText("No bookings found matching \"" + query + "\" in current view.");
            } else {
                tvEmptyTitle.setText("No " + currentFilter.toLowerCase() + " bookings");
                tvEmptyMessage.setText("You have no reservations currently under the " + currentFilter.toLowerCase() + " status filter.");
            }
        } else {
            layoutEmptyState.setVisibility(View.GONE);
        }
    }

    private void confirmDeactivateAccount() {
        new AlertDialog.Builder(this)
                .setTitle("Deactivate Account")
                .setMessage("Are you sure you want to deactivate your prosumer profile?\n\nPer system specification, a deactivated account can ONLY be reactivated by a Backoffice officer.")
                .setPositiveButton("Deactivate", (dialog, which) -> {
                    ApiClient.getService(ProsumerDashboardActivity.this).deactivateSelf().enqueue(new Callback<ResponseBody>() {
                        @Override
                        public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                            if (response.isSuccessful()) {
                                Toast.makeText(ProsumerDashboardActivity.this, "Your account has been deactivated.", Toast.LENGTH_LONG).show();
                                dbHelper.clearSession();
                                startActivity(new Intent(ProsumerDashboardActivity.this, LoginActivity.class));
                                finish();
                            } else {
                                String errorMsg = "Unable to deactivate account.";
                                try {
                                    if (response.errorBody() != null) {
                                        String raw = response.errorBody().string();
                                        org.json.JSONObject obj = new org.json.JSONObject(raw);
                                        if (obj.has("message")) errorMsg = obj.getString("message");
                                    }
                                } catch (Exception ignored) {}

                                new AlertDialog.Builder(ProsumerDashboardActivity.this)
                                        .setTitle("Deactivation Locked")
                                        .setMessage(errorMsg)
                                        .setPositiveButton("Understood", null)
                                        .show();
                            }
                        }
                        @Override
                        public void onFailure(Call<ResponseBody> call, Throwable t) {
                            Toast.makeText(ProsumerDashboardActivity.this, "Action failed: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void showEditProfileDialog() {
        android.app.Dialog dialog = new android.app.Dialog(this);
        dialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_edit_profile);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
            dialog.getWindow().setLayout(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        EditText etName = dialog.findViewById(R.id.etEditFullName);
        EditText etEmail = dialog.findViewById(R.id.etEditEmail);
        EditText etPhone = dialog.findViewById(R.id.etEditPhone);
        EditText etAddress = dialog.findViewById(R.id.etEditAddress);
        EditText etCapacity = dialog.findViewById(R.id.etEditCapacity);
        EditText etInverter = dialog.findViewById(R.id.etEditInverterSerial);

        Button btnCancel = dialog.findViewById(R.id.btnCancelEdit);
        Button btnSave = dialog.findViewById(R.id.btnSaveEditProfile);

        if (currentUser != null) {
            etName.setText(currentUser.getFullName());
            etEmail.setText(currentUser.getEmail());
            etPhone.setText(currentUser.getPhone());
            etAddress.setText(currentUser.getAddress());
            etCapacity.setText(currentUser.getSolarCapacityKw() > 0 ? String.format(Locale.US, "%.1f", currentUser.getSolarCapacityKw()) : "18.5");
            etInverter.setText(currentUser.getInverterSerial() != null && !currentUser.getInverterSerial().isEmpty() ? currentUser.getInverterSerial() : "INV-SL-9042A");
        }

        btnCancel.setOnClickListener(v -> dialog.dismiss());

        btnSave.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String email = etEmail.getText().toString().trim();
            String phone = etPhone.getText().toString().trim();
            String address = etAddress.getText().toString().trim();
            String capStr = etCapacity.getText().toString().trim();
            String inverter = etInverter.getText().toString().trim();

            if (name.isEmpty() || email.isEmpty()) {
                Toast.makeText(this, "Full name and email are required.", Toast.LENGTH_SHORT).show();
                return;
            }

            double capacity = 18.5;
            try {
                if (!capStr.isEmpty()) capacity = Double.parseDouble(capStr);
            } catch (Exception ignored) {}

            dialog.dismiss();
            executeEditProfile(name, email, phone, address, capacity, inverter);
        });

        dialog.show();
    }

    private void executeEditProfile(String name, String email, String phone, String address, double solarCapacityKw, String inverterSerial) {
        AuthDtos.UpdateProfileRequest request = new AuthDtos.UpdateProfileRequest(name, email, phone, address, solarCapacityKw, inverterSerial);
        ApiClient.getService(this).updateProfile(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                if (response.isSuccessful()) {
                    currentUser.setFullName(name);
                    currentUser.setEmail(email);
                    currentUser.setPhone(phone);
                    currentUser.setAddress(address);
                    currentUser.setSolarCapacityKw(solarCapacityKw);
                    currentUser.setInverterSerial(inverterSerial);
                    dbHelper.updateUserProfile(currentUser.getNic(), name, email, phone, address, solarCapacityKw, inverterSerial);

                    tvWelcomeName.setText(name);
                    TextView tvInitials = findViewById(R.id.tvProsumerInitials);
                    if (tvInitials != null) {
                        String[] parts = name.split("\\s+");
                        String initials = parts.length >= 2 
                                ? ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase() 
                                : ("" + name.charAt(0)).toUpperCase();
                        tvInitials.setText(initials);
                    }

                    TextView tvSolarGen = findViewById(R.id.tvSolarGenKw);
                    if (tvSolarGen != null && solarCapacityKw > 0) {
                        tvSolarGen.setText(String.format(Locale.US, "%.1f", solarCapacityKw));
                    }

                    Toast.makeText(ProsumerDashboardActivity.this, "Solar Profile updated successfully!", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(ProsumerDashboardActivity.this, "Failed to update profile on central server.", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                Toast.makeText(ProsumerDashboardActivity.this, "Network error updating profile: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showAccountBottomSheet() {
        com.google.android.material.bottomsheet.BottomSheetDialog sheetDialog = 
                new com.google.android.material.bottomsheet.BottomSheetDialog(this);
        View sheetView = getLayoutInflater().inflate(R.layout.bottom_sheet_prosumer_account, null);
        sheetDialog.setContentView(sheetView);

        TextView tvSheetInitials = sheetView.findViewById(R.id.tvSheetInitials);
        TextView tvSheetFullName = sheetView.findViewById(R.id.tvSheetFullName);
        TextView tvSheetNic = sheetView.findViewById(R.id.tvSheetNic);
        TextView tvSheetCapacity = sheetView.findViewById(R.id.tvSheetCapacity);
        TextView tvSheetInverter = sheetView.findViewById(R.id.tvSheetInverter);

        if (currentUser != null) {
            String name = currentUser.getFullName() != null ? currentUser.getFullName().trim() : "Prosumer";
            tvSheetFullName.setText(name);
            tvSheetNic.setText("NIC: " + currentUser.getNic());

            String[] parts = name.split("\\s+");
            String initials = parts.length >= 2 
                    ? ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase() 
                    : ("" + name.charAt(0)).toUpperCase();
            if (tvSheetInitials != null) {
                tvSheetInitials.setText(initials);
            }

            if (tvSheetCapacity != null) {
                double cap = currentUser.getSolarCapacityKw() > 0 ? currentUser.getSolarCapacityKw() : 18.5;
                tvSheetCapacity.setText(String.format(Locale.US, "%.1f kWp", cap));
            }

            if (tvSheetInverter != null) {
                String inv = currentUser.getInverterSerial() != null && !currentUser.getInverterSerial().isEmpty()
                        ? currentUser.getInverterSerial()
                        : "INV-SL-9042A";
                tvSheetInverter.setText(inv);
            }
        }

        View itemEdit = sheetView.findViewById(R.id.sheetItemEditProfile);
        if (itemEdit != null) {
            itemEdit.setOnClickListener(v -> {
                sheetDialog.dismiss();
                showEditProfileDialog();
            });
        }

        View itemRules = sheetView.findViewById(R.id.sheetItemGridRules);
        if (itemRules != null) {
            itemRules.setOnClickListener(v -> {
                sheetDialog.dismiss();
                showGridPolicyDialog();
            });
        }

        View itemDeactivate = sheetView.findViewById(R.id.sheetItemDeactivate);
        if (itemDeactivate != null) {
            itemDeactivate.setOnClickListener(v -> {
                sheetDialog.dismiss();
                confirmDeactivateAccount();
            });
        }

        View itemLogout = sheetView.findViewById(R.id.sheetItemLogout);
        if (itemLogout != null) {
            itemLogout.setOnClickListener(v -> {
                sheetDialog.dismiss();
                dbHelper.clearSession();
                startActivity(new Intent(ProsumerDashboardActivity.this, LoginActivity.class));
                overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
                finish();
            });
        }

        sheetDialog.show();
    }
}
