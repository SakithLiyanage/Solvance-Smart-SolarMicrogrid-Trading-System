// ============================================================================
// File: ReservationDetailActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Authors: L.T. Jayawardhana (IT23156760) & H.N. Madubashini (IT23192300)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Reservation lifecycle detail view rendering secure ZXing QR digital energy pass, 12-hour cancellation check, and modification dialog.
// References & Citations:
//   - ZXing (Zebra Crossing) Barcode Scanning & Encoding:
//     https://github.com/zxing/zxing
//   - JourneyApps ZXing Android Embedded:
//     https://github.com/journeyapps/zxing-android-embedded
//   - Android AlertDialog & Material Theming:
//     https://material.io/components/dialogs/android
// ============================================================================

package com.ead.solarmicrogrid.ui.prosumer;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.google.android.material.card.MaterialCardView;
import com.google.zxing.BarcodeFormat;
import com.journeyapps.barcodescanner.BarcodeEncoder;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ReservationDetailActivity extends AppCompatActivity {

    private TextView tvResNumberDetail, tvStatusDetail, tvStationDetail, tvScheduledDetail, tvEnergyDetail;
    private ImageView ivEnergyIconDetail;
    private LinearLayout layoutCopyResNumber;
    private MaterialCardView cardQr, cardPendingNotice;
    private ImageView ivQrCode;
    private Button btnCancelReservation, btnDone, btnEditReservation;
    private ProgressBar progressBar;

    private String reservationId;
    private String resNumber;
    private String status;
    private String qrToken;
    private String scheduledDateTime;
    private double currentKwh;
    private String currentTradeType;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reservation_detail);

        initViews();
        loadIntentData();
        renderQrCode();
        setupListeners();
    }

    private void initViews() {
        tvResNumberDetail = findViewById(R.id.tvResNumberDetail);
        tvStatusDetail = findViewById(R.id.tvStatusDetail);
        tvStationDetail = findViewById(R.id.tvStationDetail);
        tvScheduledDetail = findViewById(R.id.tvScheduledDetail);
        tvEnergyDetail = findViewById(R.id.tvEnergyDetail);
        ivEnergyIconDetail = findViewById(R.id.ivEnergyIconDetail);
        layoutCopyResNumber = findViewById(R.id.layoutCopyResNumber);
        cardQr = findViewById(R.id.cardQr);
        cardPendingNotice = findViewById(R.id.cardPendingNotice);
        ivQrCode = findViewById(R.id.ivQrCode);
        btnEditReservation = findViewById(R.id.btnEditReservation);
        btnCancelReservation = findViewById(R.id.btnCancelReservation);
        btnDone = findViewById(R.id.btnDone);
        progressBar = findViewById(R.id.progressBar);
    }

    private void loadIntentData() {
        reservationId = getIntent().getStringExtra("id");
        resNumber = getIntent().getStringExtra("resNumber");
        if (reservationId == null || reservationId.isEmpty()) {
            reservationId = resNumber;
        }
        String stationName = getIntent().getStringExtra("stationName");
        scheduledDateTime = getIntent().getStringExtra("scheduled");
        currentKwh = getIntent().getDoubleExtra("kwh", 0);
        currentTradeType = getIntent().getStringExtra("tradeType");
        status = getIntent().getStringExtra("status");
        qrToken = getIntent().getStringExtra("qrToken");

        tvResNumberDetail.setText(resNumber != null ? resNumber : "Reservation Details");
        tvStatusDetail.setText(status != null ? status : "Pending");
        applyStatusBadgeStyle(tvStatusDetail, status);

        tvStationDetail.setText(stationName != null ? stationName : "Solar Station Hub");
        tvScheduledDetail.setText("Scheduled: " + (scheduledDateTime != null ? scheduledDateTime : "N/A"));

        updateEnergyDisplay(currentKwh, currentTradeType);

        // Disable cancel/edit buttons if already cancelled or completed
        if ("Cancelled".equalsIgnoreCase(status) || "Completed".equalsIgnoreCase(status)) {
            btnCancelReservation.setEnabled(false);
            btnCancelReservation.setAlpha(0.4f);
            if (btnEditReservation != null) {
                btnEditReservation.setEnabled(false);
                btnEditReservation.setAlpha(0.4f);
            }
        }
    }

    private void updateEnergyDisplay(double kwh, String tradeType) {
        boolean isDropOff = tradeType == null || tradeType.equalsIgnoreCase("DropOff") || tradeType.toLowerCase().contains("sell");
        if (isDropOff) {
            tvEnergyDetail.setText(kwh + " kWh (Drop-Off / Sell)");
            tvEnergyDetail.setTextColor(ContextCompat.getColor(this, R.color.primary));
            ivEnergyIconDetail.setImageResource(R.drawable.ic_zap);
            ivEnergyIconDetail.setColorFilter(ContextCompat.getColor(this, R.color.primary));
        } else {
            tvEnergyDetail.setText(kwh + " kWh (Charging / Buy)");
            tvEnergyDetail.setTextColor(ContextCompat.getColor(this, R.color.accent));
            ivEnergyIconDetail.setImageResource(R.drawable.ic_battery_charging);
            ivEnergyIconDetail.setColorFilter(ContextCompat.getColor(this, R.color.accent));
        }
    }

    private void applyStatusBadgeStyle(TextView tvBadge, String status) {
        if ("Approved".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_badge_approved));
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.badge_approved_text));
        } else if ("Pending".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_badge_pending));
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.badge_pending_text));
        } else if ("Completed".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_badge_completed));
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.badge_completed_text));
        } else if ("Cancelled".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_badge_cancelled));
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.badge_cancelled_text));
        } else {
            tvBadge.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_badge_pending));
            tvBadge.setTextColor(ContextCompat.getColor(this, R.color.badge_pending_text));
        }
    }

    private void renderQrCode() {
        if ("Approved".equalsIgnoreCase(status) && qrToken != null && !qrToken.isEmpty()) {
            try {
                BarcodeEncoder barcodeEncoder = new BarcodeEncoder();
                Bitmap bitmap = barcodeEncoder.encodeBitmap(qrToken, BarcodeFormat.QR_CODE, 400, 400);
                ivQrCode.setImageBitmap(bitmap);
                cardQr.setVisibility(View.VISIBLE);
                if (cardPendingNotice != null) cardPendingNotice.setVisibility(View.GONE);
            } catch (Exception e) {
                cardQr.setVisibility(View.GONE);
            }
        } else if ("Pending".equalsIgnoreCase(status)) {
            cardQr.setVisibility(View.GONE);
            if (cardPendingNotice != null) cardPendingNotice.setVisibility(View.VISIBLE);
        } else {
            cardQr.setVisibility(View.GONE);
            if (cardPendingNotice != null) cardPendingNotice.setVisibility(View.GONE);
        }
    }

    private void setupListeners() {
        btnDone.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

        if (layoutCopyResNumber != null) {
            layoutCopyResNumber.setOnClickListener(v -> {
                if (resNumber != null && !resNumber.isEmpty()) {
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    ClipData clip = ClipData.newPlainText("Reservation Number", resNumber);
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(clip);
                        Toast.makeText(this, "Copied " + resNumber + " to clipboard", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        if (btnEditReservation != null) {
            btnEditReservation.setOnClickListener(v -> showEditReservationDialog());
        }

        btnCancelReservation.setOnClickListener(v -> {
            new AlertDialog.Builder(this)
                    .setTitle("Cancel Reservation")
                    .setMessage("Are you sure you want to cancel this booking?\n\nPer Microgrid business rule: Cancellations require at least 12 hours' advance notice before the scheduled appointment.")
                    .setPositiveButton("Confirm Cancel", (dialog, which) -> executeCancel())
                    .setNegativeButton("Keep Booking", null)
                    .show();
        });
    }

    private void showEditReservationDialog() {
        if ("Cancelled".equalsIgnoreCase(status) || "Completed".equalsIgnoreCase(status)) {
            Toast.makeText(this, "Finalized reservations cannot be modified.", Toast.LENGTH_SHORT).show();
            return;
        }

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 20);

        TextView tvPrompt = new TextView(this);
        tvPrompt.setText("Energy Amount Quota (kWh):");
        tvPrompt.setTextSize(13);
        tvPrompt.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        layout.addView(tvPrompt);

        final EditText etEnergy = new EditText(this);
        etEnergy.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
        etEnergy.setText(String.valueOf(currentKwh > 0 ? currentKwh : 15.0));
        etEnergy.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        layout.addView(etEnergy);

        TextView tvTrade = new TextView(this);
        tvTrade.setText("\nTrade Type (DropOff / PickUp):");
        tvTrade.setTextSize(13);
        tvTrade.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        layout.addView(tvTrade);

        final Spinner spTrade = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this, android.R.layout.simple_spinner_dropdown_item, new String[]{"DropOff", "PickUp"}
        );
        spTrade.setAdapter(adapter);
        if ("PickUp".equalsIgnoreCase(currentTradeType)) {
            spTrade.setSelection(1);
        }
        layout.addView(spTrade);

        new AlertDialog.Builder(this)
                .setTitle("Modify Reservation")
                .setMessage("Modifications require at least 12 hours' advance notice before the scheduled appointment window.")
                .setView(layout)
                .setPositiveButton("Save Changes", (dialog, which) -> {
                    String energyStr = etEnergy.getText().toString().trim();
                    if (energyStr.isEmpty()) return;
                    try {
                        double newKwh = Double.parseDouble(energyStr);
                        String newTrade = spTrade.getSelectedItem().toString();
                        executeEditReservation(newKwh, newTrade);
                    } catch (Exception ex) {
                        Toast.makeText(this, "Invalid energy amount entered.", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void executeEditReservation(double newKwh, String newTrade) {
        if (reservationId == null || reservationId.isEmpty()) {
            reservationId = resNumber;
        }
        if (reservationId == null || reservationId.isEmpty()) {
            Toast.makeText(this, "Reservation identifier not found.", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        if (btnEditReservation != null) btnEditReservation.setEnabled(false);

        String scheduleTimeToSend = scheduledDateTime != null && !scheduledDateTime.isEmpty() 
                ? scheduledDateTime 
                : new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(new java.util.Date(System.currentTimeMillis() + 86400000));

        AuthDtos.UpdateReservationRequest request = new AuthDtos.UpdateReservationRequest(
                scheduleTimeToSend, newKwh, newTrade
        );

        ApiClient.getService(this).updateReservation(reservationId, request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBar.setVisibility(View.GONE);
                if (btnEditReservation != null) btnEditReservation.setEnabled(true);

                if (response.isSuccessful()) {
                    currentKwh = newKwh;
                    currentTradeType = newTrade;
                    updateEnergyDisplay(currentKwh, currentTradeType);

                    new AlertDialog.Builder(ReservationDetailActivity.this)
                            .setTitle("Modification Saved")
                            .setMessage("Your reservation quota has been updated successfully!\n\nNew Energy Quota: " + newKwh + " kWh\nTrade Direction: " + newTrade)
                            .setPositiveButton("OK", null)
                            .show();
                } else {
                    String errorMsg = "Modifications require at least 12 hours' notice before scheduled appointment.";
                    try {
                        if (response.errorBody() != null) {
                            String raw = response.errorBody().string();
                            try {
                                org.json.JSONObject obj = new org.json.JSONObject(raw);
                                if (obj.has("message")) errorMsg = obj.getString("message");
                                else errorMsg = raw;
                            } catch (Exception ex) {
                                if (!raw.isEmpty()) errorMsg = raw;
                            }
                        }
                    } catch (Exception ignored) {}

                    new AlertDialog.Builder(ReservationDetailActivity.this)
                            .setTitle("Modification Blocked")
                            .setMessage("Modification could not be completed.\n\nReason: " + errorMsg + "\n\nNotice: Modifications strictly require at least 12 hours' notice per Microgrid policy.")
                            .setPositiveButton("Understood", null)
                            .show();
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                if (btnEditReservation != null) btnEditReservation.setEnabled(true);
                Toast.makeText(ReservationDetailActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void executeCancel() {
        if (reservationId == null || reservationId.isEmpty()) {
            reservationId = resNumber;
        }
        if (reservationId == null || reservationId.isEmpty()) {
            Toast.makeText(this, "Reservation identifier not found.", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnCancelReservation.setEnabled(false);

        AuthDtos.CancelRequest request = new AuthDtos.CancelRequest("Prosumer self-cancelled via mobile app");
        ApiClient.getService(this).cancelReservation(reservationId, request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBar.setVisibility(View.GONE);

                if (response.isSuccessful()) {
                    btnCancelReservation.setEnabled(false);
                    btnCancelReservation.setAlpha(0.4f);
                    status = "Cancelled";
                    tvStatusDetail.setText("Cancelled");
                    applyStatusBadgeStyle(tvStatusDetail, "Cancelled");
                    cardQr.setVisibility(View.GONE);

                    new AlertDialog.Builder(ReservationDetailActivity.this)
                            .setTitle("Cancellation Summary")
                            .setMessage("Your reservation has been cancelled successfully.\n\nStatus: Cancelled\nNotice Requirement: 12-hour rule satisfied.")
                            .setPositiveButton("OK", (dialog, which) -> {
                                finish();
                                overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
                            })
                            .setCancelable(false)
                            .show();
                } else {
                    btnCancelReservation.setEnabled(true);
                    String errorMsg = "Cancellations require at least 12 hours' notice before scheduled appointment.";
                    try {
                        if (response.errorBody() != null) {
                            String raw = response.errorBody().string();
                            try {
                                org.json.JSONObject obj = new org.json.JSONObject(raw);
                                if (obj.has("message")) {
                                    errorMsg = obj.getString("message");
                                } else {
                                    errorMsg = raw;
                                }
                            } catch (Exception ex) {
                                if (!raw.isEmpty()) errorMsg = raw;
                            }
                        }
                    } catch (Exception ignored) {}

                    new AlertDialog.Builder(ReservationDetailActivity.this)
                            .setTitle("Cancellation Blocked")
                            .setMessage("Cancellation could not be completed.\n\nReason: " + errorMsg + "\n\nNotice: Modifications and cancellations require at least 12 hours' advance notice per Microgrid policy. Please contact your Grid Operator for assistance if needed.")
                            .setPositiveButton("Understood", null)
                            .show();
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnCancelReservation.setEnabled(true);
                Toast.makeText(ReservationDetailActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
    }
}
