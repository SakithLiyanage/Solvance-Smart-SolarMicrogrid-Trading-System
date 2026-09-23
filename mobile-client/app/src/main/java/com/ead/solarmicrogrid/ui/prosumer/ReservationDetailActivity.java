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
        } else if (scheduledDateTime != null && !scheduledDateTime.isEmpty()) {
            // Proactive 12-hour notice calculation for prosumer UI feedback
            try {
                java.text.SimpleDateFormat parseFormat = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
                parseFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                String clean = scheduledDateTime.replace("Z", "");
                java.util.Date parsed = parseFormat.parse(clean);
                if (parsed != null) {
                    long diffMs = parsed.getTime() - System.currentTimeMillis();
                    double hoursLeft = diffMs / (1000.0 * 3600.0);
                    if (hoursLeft < 12.0) {
                        btnCancelReservation.setEnabled(false);
                        btnCancelReservation.setAlpha(0.4f);
                        btnCancelReservation.setText("Cancel Locked (<12h)");
                        if (btnEditReservation != null) {
                            btnEditReservation.setEnabled(false);
                            btnEditReservation.setAlpha(0.4f);
                            btnEditReservation.setText("Modification Locked (<12h)");
                        }
                    }
                }
            } catch (Exception ignored) {}
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
            com.ead.solarmicrogrid.util.SolvanceDialog.showConfirm(
                    this,
                    "Cancel Reservation",
                    "12-HOUR CANCELLATION RULE",
                    "Are you sure you want to cancel this booking?\n\nPer Microgrid business rules, cancellations require at least 12 hours' advance notice before the scheduled appointment window.",
                    "Confirm Cancel",
                    "Keep Booking",
                    () -> executeCancel(),
                    null
            );
        });
    }

    private void showEditReservationDialog() {
        if ("Cancelled".equalsIgnoreCase(status) || "Completed".equalsIgnoreCase(status)) {
            Toast.makeText(this, "Finalized reservations cannot be modified.", Toast.LENGTH_SHORT).show();
            return;
        }

        final java.util.Calendar editCalendar = java.util.Calendar.getInstance();
        if (scheduledDateTime != null && !scheduledDateTime.isEmpty()) {
            try {
                java.text.SimpleDateFormat parseFormat = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
                parseFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                String clean = scheduledDateTime.replace("Z", "");
                java.util.Date parsed = parseFormat.parse(clean);
                if (parsed != null) editCalendar.setTime(parsed);
            } catch (Exception ignored) {}
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

        TextView tvDatePrompt = new TextView(this);
        tvDatePrompt.setText("\nScheduled Slot (Within 7 Days):");
        tvDatePrompt.setTextSize(13);
        tvDatePrompt.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        layout.addView(tvDatePrompt);

        final TextView tvCurrentSchedule = new TextView(this);
        java.text.SimpleDateFormat displaySdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm (EEE)", java.util.Locale.getDefault());
        tvCurrentSchedule.setText(displaySdf.format(editCalendar.getTime()));
        tvCurrentSchedule.setTextSize(13);
        tvCurrentSchedule.setTextColor(ContextCompat.getColor(this, R.color.primary));
        tvCurrentSchedule.setPadding(0, 8, 0, 12);
        layout.addView(tvCurrentSchedule);

        Button btnChangeSchedule = new Button(this);
        btnChangeSchedule.setText("Reschedule Date & Time");
        btnChangeSchedule.setTextSize(12);
        layout.addView(btnChangeSchedule);

        final java.util.Calendar nowCal = java.util.Calendar.getInstance();
        final java.util.Calendar maxCal = java.util.Calendar.getInstance();
        maxCal.add(java.util.Calendar.DAY_OF_YEAR, 7);

        btnChangeSchedule.setOnClickListener(v -> {
            android.app.DatePickerDialog dateDialog = new android.app.DatePickerDialog(
                    this,
                    (view, year, month, dayOfMonth) -> {
                        editCalendar.set(java.util.Calendar.YEAR, year);
                        editCalendar.set(java.util.Calendar.MONTH, month);
                        editCalendar.set(java.util.Calendar.DAY_OF_MONTH, dayOfMonth);

                        android.app.TimePickerDialog timeDialog = new android.app.TimePickerDialog(
                                this,
                                (tView, hourOfDay, minute) -> {
                                    editCalendar.set(java.util.Calendar.HOUR_OF_DAY, hourOfDay);
                                    editCalendar.set(java.util.Calendar.MINUTE, minute);
                                    editCalendar.set(java.util.Calendar.SECOND, 0);
                                    tvCurrentSchedule.setText(displaySdf.format(editCalendar.getTime()));
                                },
                                editCalendar.get(java.util.Calendar.HOUR_OF_DAY),
                                editCalendar.get(java.util.Calendar.MINUTE),
                                true
                        );
                        timeDialog.show();
                    },
                    editCalendar.get(java.util.Calendar.YEAR),
                    editCalendar.get(java.util.Calendar.MONTH),
                    editCalendar.get(java.util.Calendar.DAY_OF_MONTH)
            );
            dateDialog.getDatePicker().setMinDate(nowCal.getTimeInMillis());
            dateDialog.getDatePicker().setMaxDate(maxCal.getTimeInMillis());
            dateDialog.show();
        });

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

                        java.text.SimpleDateFormat isoFormat = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
                        isoFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                        String newScheduleIso = isoFormat.format(editCalendar.getTime());

                        executeEditReservation(newKwh, newTrade, newScheduleIso);
                    } catch (Exception ex) {
                        Toast.makeText(this, "Invalid energy amount entered.", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void executeEditReservation(double newKwh, String newTrade, String scheduleTimeToSend) {
        if (reservationId == null || reservationId.isEmpty()) {
            reservationId = resNumber;
        }
        if (reservationId == null || reservationId.isEmpty()) {
            Toast.makeText(this, "Reservation identifier not found.", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        if (btnEditReservation != null) btnEditReservation.setEnabled(false);

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
                    scheduledDateTime = scheduleTimeToSend;
                    updateEnergyDisplay(currentKwh, currentTradeType);
                    tvScheduledDetail.setText("Scheduled: " + scheduleTimeToSend);

                    java.util.List<com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem> details = new java.util.ArrayList<>();
                    details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("New Schedule", scheduleTimeToSend));
                    details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("Energy Quota", newKwh + " kWh"));
                    details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("Trade Mode", newTrade));

                    com.ead.solarmicrogrid.util.SolvanceDialog.showSuccess(
                            ReservationDetailActivity.this,
                            "Modification Saved",
                            "RESERVATION UPDATED",
                            "Your reservation schedule and energy quota have been successfully updated.",
                            details,
                            "OK",
                            null
                    );
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

                    com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                            ReservationDetailActivity.this,
                            "Modification Blocked",
                            "POLICY RULE ENFORCEMENT",
                            errorMsg + "\n\nNotice: Schedule updates strictly require at least 12 hours' notice per Microgrid policy.",
                            "Understood",
                            null
                    );
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

                    com.ead.solarmicrogrid.util.SolvanceDialog.showSuccess(
                            ReservationDetailActivity.this,
                            "Cancellation Completed",
                            "BOOKING CANCELLED",
                            "Your reservation slot has been released back to the microgrid capacity pool.\n\n12-hour cancellation notice policy was satisfied.",
                            null,
                            "Back to Reservations",
                            () -> {
                                finish();
                                overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
                            }
                    );
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

                    com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                            ReservationDetailActivity.this,
                            "Cancellation Blocked",
                            "POLICY RESTRICTION",
                            errorMsg + "\n\nModifications and cancellations require at least 12 hours' advance notice per Microgrid policy. Please contact your Grid Operator for assistance if needed.",
                            "Understood",
                            null
                    );
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
