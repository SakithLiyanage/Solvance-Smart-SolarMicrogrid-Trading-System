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

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
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
    private TextView tvBackToLogin, tvNicDemographic, tvDocStatus, tvDocBackStatus, tvUtilityStatus;
    private ProgressBar progressBar;

    // e-KYC Slot 1 (NIC Front Side)
    private FrameLayout layoutNicPreview;
    private ImageView ivNicPreview;
    private ImageButton btnRemoveDoc;
    private MaterialButton btnCameraNic, btnUploadNicDoc;

    // e-KYC Slot 2 (NIC Back Side)
    private FrameLayout layoutNicBackPreview;
    private ImageView ivNicBackPreview;
    private ImageButton btnRemoveNicBackDoc;
    private MaterialButton btnCameraNicBack, btnUploadNicBackDoc;

    // e-KYC Slot 3 (CEB / LECO Grid Utility Bill)
    private FrameLayout layoutUtilityPreview;
    private ImageView ivUtilityPreview;
    private ImageButton btnRemoveUtilityBill;
    private MaterialButton btnUploadUtilityBill;

    // Launchers & State
    private ActivityResultLauncher<String> requestCameraPermissionLauncher;
    private ActivityResultLauncher<Void> cameraLauncher;
    private ActivityResultLauncher<String> galleryNicFrontLauncher;
    private ActivityResultLauncher<String> galleryNicBackLauncher;
    private ActivityResultLauncher<String> galleryUtilityLauncher;

    private boolean isTargetingFrontCamera = true;
    private String attachedNicFrontBase64 = null;
    private String attachedNicBackBase64 = null;
    private String attachedUtilityBillBase64 = null;

    private Bitmap bitmapNicFront = null;
    private Bitmap bitmapNicBack = null;
    private Bitmap bitmapUtility = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        setupLaunchers();
        initViews();
        setupListeners();
    }

    private void setupLaunchers() {
        // Runtime Camera Permission Launcher
        requestCameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                isGranted -> {
                    if (isGranted) {
                        openCameraSafely();
                    } else {
                        Toast.makeText(this, "Camera permission is required to capture NIC document photo.", Toast.LENGTH_LONG).show();
                    }
                }
        );

        // Camera capture for physical NIC (Front or Back)
        cameraLauncher = registerForActivityResult(
                new ActivityResultContracts.TakePicturePreview(),
                bitmap -> {
                    if (bitmap != null) {
                        if (isTargetingFrontCamera) {
                            processBitmap(bitmap, 1);
                        } else {
                            processBitmap(bitmap, 2);
                        }
                    }
                }
        );

        // Gallery picker for NIC Front
        galleryNicFrontLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) {
                        processUriImage(uri, 1);
                    }
                }
        );

        // Gallery picker for NIC Back
        galleryNicBackLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) {
                        processUriImage(uri, 2);
                    }
                }
        );

        // Gallery picker for Utility Bill / Solar Agreement
        galleryUtilityLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) {
                        processUriImage(uri, 3);
                    }
                }
        );
    }

    private void openCameraSafely() {
        try {
            cameraLauncher.launch(null);
        } catch (Exception e) {
            Toast.makeText(this, "Unable to launch camera: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
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

        // NIC Front Slot
        layoutNicPreview = findViewById(R.id.layoutNicPreview);
        ivNicPreview = findViewById(R.id.ivNicPreview);
        btnRemoveDoc = findViewById(R.id.btnRemoveDoc);
        tvDocStatus = findViewById(R.id.tvDocStatus);
        btnCameraNic = findViewById(R.id.btnCameraNic);
        btnUploadNicDoc = findViewById(R.id.btnUploadNicDoc);

        // NIC Back Slot
        layoutNicBackPreview = findViewById(R.id.layoutNicBackPreview);
        ivNicBackPreview = findViewById(R.id.ivNicBackPreview);
        btnRemoveNicBackDoc = findViewById(R.id.btnRemoveNicBackDoc);
        tvDocBackStatus = findViewById(R.id.tvDocBackStatus);
        btnCameraNicBack = findViewById(R.id.btnCameraNicBack);
        btnUploadNicBackDoc = findViewById(R.id.btnUploadNicBackDoc);

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

        // NIC Front triggers
        btnCameraNic.setOnClickListener(v -> {
            isTargetingFrontCamera = true;
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                openCameraSafely();
            } else {
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA);
            }
        });
        btnUploadNicDoc.setOnClickListener(v -> galleryNicFrontLauncher.launch("image/*"));
        ivNicPreview.setOnClickListener(v -> showImagePreviewDialog("NIC Front Document", bitmapNicFront));
        btnRemoveDoc.setOnClickListener(v -> {
            attachedNicFrontBase64 = null;
            bitmapNicFront = null;
            layoutNicPreview.setVisibility(View.GONE);
            ivNicPreview.setImageDrawable(null);
            tvDocStatus.setText("No front ID attached");
            tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.text_muted));
        });

        // NIC Back triggers
        btnCameraNicBack.setOnClickListener(v -> {
            isTargetingFrontCamera = false;
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                openCameraSafely();
            } else {
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA);
            }
        });
        btnUploadNicBackDoc.setOnClickListener(v -> galleryNicBackLauncher.launch("image/*"));
        ivNicBackPreview.setOnClickListener(v -> showImagePreviewDialog("NIC Back Document", bitmapNicBack));
        btnRemoveNicBackDoc.setOnClickListener(v -> {
            attachedNicBackBase64 = null;
            bitmapNicBack = null;
            layoutNicBackPreview.setVisibility(View.GONE);
            ivNicBackPreview.setImageDrawable(null);
            tvDocBackStatus.setText("No back ID attached");
            tvDocBackStatus.setTextColor(ContextCompat.getColor(this, R.color.text_muted));
        });

        // Utility Bill triggers
        btnUploadUtilityBill.setOnClickListener(v -> galleryUtilityLauncher.launch("image/*"));
        ivUtilityPreview.setOnClickListener(v -> showImagePreviewDialog("Electricity / Grid Utility Bill", bitmapUtility));
        btnRemoveUtilityBill.setOnClickListener(v -> {
            attachedUtilityBillBase64 = null;
            bitmapUtility = null;
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

    private void showImagePreviewDialog(String title, Bitmap bitmap) {
        if (bitmap == null) return;
        ImageView iv = new ImageView(this);
        iv.setImageBitmap(bitmap);
        iv.setAdjustViewBounds(true);
        iv.setPadding(24, 24, 24, 24);

        new AlertDialog.Builder(this)
                .setTitle(title)
                .setView(iv)
                .setPositiveButton("Close", null)
                .show();
    }

    private void processBitmap(Bitmap original, int docType) {
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

            if (docType == 1) { // NIC Front
                attachedNicFrontBase64 = base64Data;
                bitmapNicFront = original;
                ivNicPreview.setImageBitmap(original);
                layoutNicPreview.setVisibility(View.VISIBLE);
                tvDocStatus.setText("✓ NIC Front Attached (" + (bytes.length / 1024) + " KB) • Tap to view");
                tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
            } else if (docType == 2) { // NIC Back
                attachedNicBackBase64 = base64Data;
                bitmapNicBack = original;
                ivNicBackPreview.setImageBitmap(original);
                layoutNicBackPreview.setVisibility(View.VISIBLE);
                tvDocBackStatus.setText("✓ NIC Back Attached (" + (bytes.length / 1024) + " KB) • Tap to view");
                tvDocBackStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
            } else { // Utility Bill
                attachedUtilityBillBase64 = base64Data;
                bitmapUtility = original;
                ivUtilityPreview.setImageBitmap(original);
                layoutUtilityPreview.setVisibility(View.VISIBLE);
                tvUtilityStatus.setText("✓ CEB/LECO Bill Attached (" + (bytes.length / 1024) + " KB) • Tap to view");
                tvUtilityStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error processing image: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void processUriImage(Uri uri, int docType) {
        try (InputStream inputStream = getContentResolver().openInputStream(uri)) {
            Bitmap original = BitmapFactory.decodeStream(inputStream);
            if (original == null) {
                Toast.makeText(this, "Unable to decode selected image file.", Toast.LENGTH_SHORT).show();
                return;
            }
            processBitmap(original, docType);
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

        // 1. Mandatory Field Validation
        if (nic.isEmpty()) {
            Toast.makeText(this, "National Identity Card (NIC) number is required.", Toast.LENGTH_SHORT).show();
            etNic.requestFocus();
            return;
        }

        // 2. Sri Lankan NIC Algorithm Check
        NicValidator.NicValidationResult nicResult = NicValidator.validate(nic);
        if (!nicResult.isValid) {
            Toast.makeText(this, nicResult.error, Toast.LENGTH_LONG).show();
            etNic.requestFocus();
            return;
        }

        // 3. Name Validation
        if (fullName.isEmpty()) {
            Toast.makeText(this, "Full Name is required.", Toast.LENGTH_SHORT).show();
            etFullName.requestFocus();
            return;
        }

        // 4. Email Validation
        if (email.isEmpty()) {
            Toast.makeText(this, "Email address is required.", Toast.LENGTH_SHORT).show();
            etEmail.requestFocus();
            return;
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            Toast.makeText(this, "Please enter a valid email address.", Toast.LENGTH_SHORT).show();
            etEmail.requestFocus();
            return;
        }

        // 5. Phone Validation (Sri Lankan standard format)
        if (phone.isEmpty()) {
            Toast.makeText(this, "Phone number is required.", Toast.LENGTH_SHORT).show();
            etPhone.requestFocus();
            return;
        }
        if (!phone.matches("^(?:\\+94|0)[0-9]{9}$")) {
            Toast.makeText(this, "Please enter a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567).", Toast.LENGTH_LONG).show();
            etPhone.requestFocus();
            return;
        }

        // 6. Address Validation
        if (address.isEmpty()) {
            Toast.makeText(this, "Physical / Property address is required.", Toast.LENGTH_SHORT).show();
            etAddress.requestFocus();
            return;
        }

        // 7. Solar Array Capacity Validation
        if (solarStr.isEmpty()) {
            Toast.makeText(this, "Solar array capacity is required.", Toast.LENGTH_SHORT).show();
            etSolarCapacity.requestFocus();
            return;
        }
        double parsedSolarKw;
        try {
            parsedSolarKw = Double.parseDouble(solarStr);
            if (parsedSolarKw <= 0 || parsedSolarKw > 500.0) {
                Toast.makeText(this, "Solar array capacity must be between 0.1 kW and 500.0 kW.", Toast.LENGTH_SHORT).show();
                etSolarCapacity.requestFocus();
                return;
            }
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Invalid solar array capacity value.", Toast.LENGTH_SHORT).show();
            etSolarCapacity.requestFocus();
            return;
        }
        final double solarKw = parsedSolarKw;

        // 8. Password Strength Validation
        if (password.length() < 6) {
            Toast.makeText(this, "Password must be at least 6 characters.", Toast.LENGTH_SHORT).show();
            etPassword.requestFocus();
            return;
        }

        // 9. Document attachments are optional at registration (processed if attached)


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
                attachedNicFrontBase64,
                attachedNicBackBase64,
                attachedUtilityBillBase64
        );

        ApiClient.getService(this).registerProsumer(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);

                if (response.isSuccessful()) {
                    String demographics = nicResult.gender + ", Age " + nicResult.age;
                    com.ead.solarmicrogrid.util.SolvanceDialog.showKycSuccess(
                            RegisterActivity.this,
                            fullName,
                            nic,
                            demographics,
                            String.valueOf(solarKw),
                            inverterSerial,
                            () -> finish()
                    );
                } else {
                    com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                            RegisterActivity.this,
                            "Registration Notice",
                            "ACCOUNT CONFLICT",
                            "A solar prosumer account with this National ID (NIC) or Email already exists in the Solvance network.",
                            "Review Details",
                            null
                    );
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);
                String currentUrl = ApiClient.getBaseUrl(RegisterActivity.this);
                com.ead.solarmicrogrid.util.SolvanceDialog.showError(
                        RegisterActivity.this,
                        "Connection Error",
                        "Unable to reach Solvance Web API at:\n" + currentUrl + "\n\nError: " + (t != null ? t.getMessage() : "Network timeout") + "\n\nPlease ensure the backend server is running and network is connected.",
                        "OK",
                        null
                );
            }
        });
    }
}



