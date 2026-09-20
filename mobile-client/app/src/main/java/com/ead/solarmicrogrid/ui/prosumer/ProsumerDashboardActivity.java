package com.ead.solarmicrogrid.ui.prosumer;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProsumerDashboardActivity extends AppCompatActivity {

    private SwipeRefreshLayout swipeRefresh;
    private TextView tvWelcomeName, tvNicBadge;
    private TextView tvTotalKwhTraded, tvActiveCount, tvPendingCount, tvCompletedCount;
    private LinearLayout btnBookSlot, btnOpenMaps, btnActivePass, btnGridPolicy;
    private ImageButton btnSyncLive, btnDeactivateAccount, btnLogout;

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

        btnSyncLive = findViewById(R.id.btnSyncLive);
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

        tvWelcomeName.setText("Welcome, " + currentUser.getFullName());
        tvNicBadge.setText("NIC: " + currentUser.getNic());

        rvReservations.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ReservationAdapter(this, new ArrayList<>());
        rvReservations.setAdapter(adapter);
    }

    private void setupListeners() {
        swipeRefresh.setOnRefreshListener(this::refreshLiveData);

        btnSyncLive.setOnClickListener(v -> refreshLiveData());

        btnBookSlot.setOnClickListener(v -> openBookSlot());

        btnEmptyBook.setOnClickListener(v -> openBookSlot());

        btnOpenMaps.setOnClickListener(v -> {
            startActivity(new Intent(ProsumerDashboardActivity.this, StationsMapActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        btnActivePass.setOnClickListener(v -> openActivePass());

        btnGridPolicy.setOnClickListener(v -> showGridPolicyDialog());

        btnLogout.setOnClickListener(v -> {
            dbHelper.clearSession();
            startActivity(new Intent(ProsumerDashboardActivity.this, LoginActivity.class));
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
            finish();
        });

        btnDeactivateAccount.setOnClickListener(v -> confirmDeactivateAccount());

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
                            Toast.makeText(ProsumerDashboardActivity.this, "Your account has been deactivated.", Toast.LENGTH_LONG).show();
                            dbHelper.clearSession();
                            startActivity(new Intent(ProsumerDashboardActivity.this, LoginActivity.class));
                            finish();
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
}
