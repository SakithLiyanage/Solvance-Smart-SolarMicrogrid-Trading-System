// ============================================================================
// File: RegisterActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Prosumer onboarding activity with real-time Sri Lankan NIC demographic validation and dual-slot e-KYC document capture.
// References & Citations:
//   - Android Activity Result API:
//     https://developer.android.com/training/basics/intents/result
//   - Material Design Components:
//     https://material.io/components/text-fields/android
// ============================================================================

package com.ead.solarmicrogrid.ui.auth;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.ead.solarmicrogrid.util.NicValidator;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private TextInputEditText etNic, etFullName, etEmail, etPhone, etAddress, etSolarCapacity, etInverterSerial, etPassword;
    private Button btnRegister;
    private TextView tvBackToLogin, tvNicDemographic, tvDocStatus, tvUtilityStatus;
    private ProgressBar progressBar;

    // e-KYC Slot 1 (NIC / Government ID)
    private FrameLayout layoutNicPreview;
    private ImageView ivNicPreview;
    private ImageButton btnRemoveDoc;
    private MaterialButton btnCameraNic, btnUploadNicDoc;

    // e-KYC Slot 2 (CEB / LECO Grid Utility Bill)
    private FrameLayout layoutUtilityPreview;
    private ImageView ivUtilityPreview;
    private ImageButton btnRemoveUtilityBill;
    private MaterialButton btnUploadUtilityBill;

    // Launchers
    private ActivityResultLauncher<Void> cameraLauncher;
    private ActivityResultLauncher<String> galleryNicLauncher;
    private ActivityResultLauncher<String> galleryUtilityLauncher;

    private String attachedNicBase64 = null;
    private String attachedUtilityBillBase64 = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        setupLaunchers();
        initViews();
        setupListeners();
    }

    private void setupLaunchers() {
        // Camera capture for physical NIC
        cameraLauncher = registerForActivityResult(
                new ActivityResultContracts.TakePicturePreview(),
                bitmap -> {
                    if (bitmap != null) {
                        processBitmap(bitmap, true);
                    }
                }
        );

        // Gallery picker for NIC image
        galleryNicLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) {
                        processUriImage(uri, true);
                    }
                }
        );

        // Gallery picker for Utility Bill / Solar Agreement
        galleryUtilityLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) {
                        processUriImage(uri, false);
                    }
                }
        );
    }

    private void initViews() {
        etNic = findViewById(R.id.etNic);
        tvNicDemographic = findViewById(R.id.tvNicDemographic);
        etFullName = findViewById(R.id.etFullName);
        etEmail = findViewById(R.id.etEmail);
        etPhone = findViewById(R.id.etPhone);
        etAddress = findViewById(R.id.etAddress);
        etSolarCapacity = findViewById(R.id.etSolarCapacity);
        etInverterSerial = findViewById(R.id.etInverterSerial);
        etPassword = findViewById(R.id.etPassword);
        btnRegister = findViewById(R.id.btnRegister);
        tvBackToLogin = findViewById(R.id.tvBackToLogin);
        progressBar = findViewById(R.id.progressBar);

        // NIC Slot
        layoutNicPreview = findViewById(R.id.layoutNicPreview);
        ivNicPreview = findViewById(R.id.ivNicPreview);
        btnRemoveDoc = findViewById(R.id.btnRemoveDoc);
        tvDocStatus = findViewById(R.id.tvDocStatus);
        btnCameraNic = findViewById(R.id.btnCameraNic);
        btnUploadNicDoc = findViewById(R.id.btnUploadNicDoc);

        // Utility Slot
        layoutUtilityPreview = findViewById(R.id.layoutUtilityPreview);
        ivUtilityPreview = findViewById(R.id.ivUtilityPreview);
        btnRemoveUtilityBill = findViewById(R.id.btnRemoveUtilityBill);
        tvUtilityStatus = findViewById(R.id.tvUtilityStatus);
        btnUploadUtilityBill = findViewById(R.id.btnUploadUtilityBill);
    }

    private void setupListeners() {
        // Real-time Sri Lankan NIC demographic validation feedback
        etNic.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                String input = s != null ? s.toString().trim() : "";
                if (input.isEmpty()) {
                    tvNicDemographic.setVisibility(View.GONE);
                    return;
                }

                NicValidator.NicValidationResult result = NicValidator.validate(input);
                if (result.isValid) {
                    tvNicDemographic.setVisibility(View.VISIBLE);
                    tvNicDemographic.setText(result.summary);
                    tvNicDemographic.setTextColor(ContextCompat.getColor(RegisterActivity.this, R.color.accent));
                } else if (input.length() >= 9) {
                    tvNicDemographic.setVisibility(View.VISIBLE);
                    tvNicDemographic.setText("⚠️ " + result.error);
                    tvNicDemographic.setTextColor(ContextCompat.getColor(RegisterActivity.this, R.color.danger));
                } else {
                    tvNicDemographic.setVisibility(View.GONE);
                }
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        // NIC document triggers
        btnCameraNic.setOnClickListener(v -> cameraLauncher.launch(null));
        btnUploadNicDoc.setOnClickListener(v -> galleryNicLauncher.launch("image/*"));
        btnRemoveDoc.setOnClickListener(v -> {
            attachedNicBase64 = null;
            layoutNicPreview.setVisibility(View.GONE);
            ivNicPreview.setImageDrawable(null);
            tvDocStatus.setText("No ID document attached");
            tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.text_muted));
        });

        // Utility Bill document triggers
        btnUploadUtilityBill.setOnClickListener(v -> galleryUtilityLauncher.launch("image/*"));
        btnRemoveUtilityBill.setOnClickListener(v -> {
            attachedUtilityBillBase64 = null;
            layoutUtilityPreview.setVisibility(View.GONE);
            ivUtilityPreview.setImageDrawable(null);
            tvUtilityStatus.setText("Optional (Fast-tracks grid authorization)");
            tvUtilityStatus.setTextColor(ContextCompat.getColor(this, R.color.text_muted));
        });

        btnRegister.setOnClickListener(v -> performRegistration());

        tvBackToLogin.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });
    }

    private void processBitmap(Bitmap original, boolean isNicDoc) {
        if (original == null) return;
        try {
            int maxDim = 1024;
            int width = original.getWidth();
            int height = original.getHeight();
            if (width > maxDim || height > maxDim) {
                float ratio = Math.min((float) maxDim / width, (float) maxDim / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                original = Bitmap.createScaledBitmap(original, width, height, true);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            original.compress(Bitmap.CompressFormat.JPEG, 85, outputStream);
            byte[] bytes = outputStream.toByteArray();
            String base64Data = "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);

            if (isNicDoc) {
                attachedNicBase64 = base64Data;
                ivNicPreview.setImageBitmap(original);
                layoutNicPreview.setVisibility(View.VISIBLE);
                tvDocStatus.setText("✓ NIC Photo Captured (" + (bytes.length / 1024) + " KB)");
                tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
            } else {
                attachedUtilityBillBase64 = base64Data;
                ivUtilityPreview.setImageBitmap(original);
                layoutUtilityPreview.setVisibility(View.VISIBLE);
                tvUtilityStatus.setText("✓ CEB/LECO Bill Attached (" + (bytes.length / 1024) + " KB)");
                tvUtilityStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error processing image: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void processUriImage(Uri uri, boolean isNicDoc) {
        try (InputStream inputStream = getContentResolver().openInputStream(uri)) {
            Bitmap original = BitmapFactory.decodeStream(inputStream);
            if (original == null) {
                Toast.makeText(this, "Unable to decode selected image file.", Toast.LENGTH_SHORT).show();
                return;
            }
            processBitmap(original, isNicDoc);
        } catch (Exception e) {
            Toast.makeText(this, "Error reading image: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void performRegistration() {
        String nic = etNic.getText() != null ? etNic.getText().toString().trim().toUpperCase() : "";
        String fullName = etFullName.getText() != null ? etFullName.getText().toString().trim() : "";
        String email = etEmail.getText() != null ? etEmail.getText().toString().trim().toLowerCase() : "";
        String phone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        String address = etAddress.getText() != null ? etAddress.getText().toString().trim() : "";
        String solarStr = etSolarCapacity.getText() != null ? etSolarCapacity.getText().toString().trim() : "15.0";
        String inverterSerial = etInverterSerial.getText() != null ? etInverterSerial.getText().toString().trim() : "";
        String password = etPassword.getText() != null ? etPassword.getText().toString().trim() : "";

        if (nic.isEmpty() || fullName.isEmpty() || email.isEmpty() || phone.isEmpty() || address.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "All required fields must be completed.", Toast.LENGTH_SHORT).show();
            return;
        }

        NicValidator.NicValidationResult nicResult = NicValidator.validate(nic);
        if (!nicResult.isValid) {
            Toast.makeText(this, nicResult.error, Toast.LENGTH_LONG).show();
            etNic.requestFocus();
            return;
        }

        double parsedSolarKw = 15.0;
        try {
            parsedSolarKw = Double.parseDouble(solarStr);
        } catch (NumberFormatException ignored) {}
        final double solarKw = parsedSolarKw;

        if (password.length() < 6) {
            Toast.makeText(this, "Password must be at least 6 characters.", Toast.LENGTH_SHORT).show();
            return;
        }

        // e-KYC Proof of Identity requirement check
        if (attachedNicBase64 == null) {
            Toast.makeText(this, "Please capture or attach your National Identity Card (NIC) photo to complete e-KYC.", Toast.LENGTH_LONG).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnRegister.setEnabled(false);

        AuthDtos.RegisterRequest request = new AuthDtos.RegisterRequest(
                nic,
                fullName,
                email,
                phone,
                address,
                solarKw,
                inverterSerial,
                password,
                attachedNicBase64,
                attachedUtilityBillBase64
        );

        ApiClient.getService(this).registerProsumer(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);

                if (response.isSuccessful()) {
                    new AlertDialog.Builder(RegisterActivity.this)
                            .setTitle("e-KYC Prosumer Registered")
                            .setMessage("Your solar prosumer node registration has been submitted.\n\nNIC: " + nic + "\nDemographics: " + nicResult.gender + ", Age " + nicResult.age + "\nSolar Array: " + solarKw + " kW\nInverter: " + inverterSerial + "\n\nPer enterprise compliance, account status is 'Pending' awaiting Backoffice review.")
                            .setPositiveButton("Go to Login", (dialog, which) -> finish())
                            .setCancelable(false)
                            .show();
                } else {
                    Toast.makeText(RegisterActivity.this, "Registration failed: User with this NIC or Email may already exist.", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);
                Toast.makeText(RegisterActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}


