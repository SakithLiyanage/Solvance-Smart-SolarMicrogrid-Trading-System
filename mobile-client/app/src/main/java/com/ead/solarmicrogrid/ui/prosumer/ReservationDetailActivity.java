package com.ead.solarmicrogrid.ui.prosumer;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
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
    private MaterialCardView cardQr;
    private ImageView ivQrCode;
    private Button btnCancelReservation, btnDone;
    private ProgressBar progressBar;

    private String reservationId;
    private String resNumber;
    private String status;
    private String qrToken;

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
        ivQrCode = findViewById(R.id.ivQrCode);
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
        String scheduled = getIntent().getStringExtra("scheduled");
        double kwh = getIntent().getDoubleExtra("kwh", 0);
        String tradeType = getIntent().getStringExtra("tradeType");
        status = getIntent().getStringExtra("status");
        qrToken = getIntent().getStringExtra("qrToken");

        tvResNumberDetail.setText(resNumber != null ? resNumber : "Reservation Details");
        tvStatusDetail.setText(status != null ? status : "Pending");
        applyStatusBadgeStyle(tvStatusDetail, status);

        tvStationDetail.setText(stationName != null ? stationName : "Solar Station Hub");
        tvScheduledDetail.setText("Scheduled: " + (scheduled != null ? scheduled : "N/A"));

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

        // Disable cancel button if already cancelled or completed
        if ("Cancelled".equalsIgnoreCase(status) || "Completed".equalsIgnoreCase(status)) {
            btnCancelReservation.setEnabled(false);
            btnCancelReservation.setAlpha(0.4f);
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
        if (qrToken != null && !qrToken.isEmpty() && !"Cancelled".equalsIgnoreCase(status)) {
            try {
                BarcodeEncoder barcodeEncoder = new BarcodeEncoder();
                Bitmap bitmap = barcodeEncoder.encodeBitmap(qrToken, BarcodeFormat.QR_CODE, 400, 400);
                ivQrCode.setImageBitmap(bitmap);
                cardQr.setVisibility(View.VISIBLE);
            } catch (Exception e) {
                cardQr.setVisibility(View.GONE);
            }
        } else {
            cardQr.setVisibility(View.GONE);
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

        btnCancelReservation.setOnClickListener(v -> {
            new AlertDialog.Builder(this)
                    .setTitle("Cancel Reservation")
                    .setMessage("Are you sure you want to cancel this booking?\n\nPer Microgrid business rule: Cancellations require at least 12 hours' advance notice before the scheduled appointment.")
                    .setPositiveButton("Confirm Cancel", (dialog, which) -> executeCancel())
                    .setNegativeButton("Keep Booking", null)
                    .show();
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
