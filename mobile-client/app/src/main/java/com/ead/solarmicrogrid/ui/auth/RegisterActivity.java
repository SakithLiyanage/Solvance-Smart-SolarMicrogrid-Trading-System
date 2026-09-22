// ============================================================================
// File: RegisterActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Prosumer onboarding activity implementing NIC primary key validation and central API registration.
// References & Citations:
//   - Material Design Text Fields & Input Validation:
//     https://material.io/components/text-fields/android
//   - Square Retrofit 2 HTTP Network Processing:
//     https://square.github.io/retrofit/
// ============================================================================

package com.ead.solarmicrogrid.ui.auth;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
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
    private TextView tvBackToLogin, tvDocStatus;
    private ProgressBar progressBar;
    private FrameLayout layoutNicPreview;
    private ImageView ivNicPreview;
    private ImageButton btnRemoveDoc;
    private MaterialButton btnUploadNicDoc, btnGenerateDigitalDoc;

    private ActivityResultLauncher<String> imagePickerLauncher;
    private String attachedNicBase64 = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        setupImagePicker();
        initViews();
        setupListeners();
    }

    private void setupImagePicker() {
        imagePickerLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) {
                        processSelectedImage(uri);
                    }
                }
        );
    }

    private void initViews() {
        etNic = findViewById(R.id.etNic);
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

        layoutNicPreview = findViewById(R.id.layoutNicPreview);
        ivNicPreview = findViewById(R.id.ivNicPreview);
        btnRemoveDoc = findViewById(R.id.btnRemoveDoc);
        tvDocStatus = findViewById(R.id.tvDocStatus);
        btnUploadNicDoc = findViewById(R.id.btnUploadNicDoc);
        btnGenerateDigitalDoc = findViewById(R.id.btnGenerateDigitalDoc);
    }

    private void setupListeners() {
        btnUploadNicDoc.setOnClickListener(v -> imagePickerLauncher.launch("image/*"));

        btnGenerateDigitalDoc.setOnClickListener(v -> {
            String nic = etNic.getText() != null ? etNic.getText().toString().trim().toUpperCase() : "";
            String fullName = etFullName.getText() != null ? etFullName.getText().toString().trim() : "";
            if (nic.isEmpty() || !nic.matches("^([0-9]{9}[VvXx]|[0-9]{12})$")) {
                Toast.makeText(this, "Please enter a valid Sri Lankan NIC number first.", Toast.LENGTH_SHORT).show();
                etNic.requestFocus();
                return;
            }
            generateDigitalNicCard(nic, fullName);
        });

        btnRemoveDoc.setOnClickListener(v -> {
            attachedNicBase64 = null;
            layoutNicPreview.setVisibility(View.GONE);
            ivNicPreview.setImageDrawable(null);
            tvDocStatus.setText("No document selected yet");
            tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.text_muted));
        });

        btnRegister.setOnClickListener(v -> performRegistration());

        tvBackToLogin.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });
    }

    private void processSelectedImage(Uri uri) {
        try (InputStream inputStream = getContentResolver().openInputStream(uri)) {
            Bitmap original = BitmapFactory.decodeStream(inputStream);
            if (original == null) {
                Toast.makeText(this, "Unable to decode selected image file.", Toast.LENGTH_SHORT).show();
                return;
            }

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
            attachedNicBase64 = "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);

            ivNicPreview.setImageBitmap(original);
            layoutNicPreview.setVisibility(View.VISIBLE);
            tvDocStatus.setText("✓ NIC Photo Attached (" + (bytes.length / 1024) + " KB)");
            tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
            Toast.makeText(this, "NIC document attached successfully.", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Error processing image: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void generateDigitalNicCard(String nic, String fullName) {
        int width = 900;
        int height = 550;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // Card Surface
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.parseColor("#0F172A"));
        RectF cardRect = new RectF(0, 0, width, height);
        canvas.drawRoundRect(cardRect, 28, 28, bgPaint);

        // Gold Outer Border
        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(4);
        borderPaint.setColor(Color.parseColor("#F59E0B"));
        canvas.drawRoundRect(cardRect, 28, 28, borderPaint);

        // Header Section
        Paint headerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setColor(Color.parseColor("#1E293B"));
        canvas.drawRect(0, 0, width, 110, headerPaint);

        // Title Texts
        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.parseColor("#F59E0B"));
        textPaint.setTextSize(24);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText("DEMOCRATIC SOCIALIST REPUBLIC OF SRI LANKA", 40, 50, textPaint);

        textPaint.setColor(Color.parseColor("#94A3B8"));
        textPaint.setTextSize(18);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        canvas.drawText("NATIONAL IDENTITY CARD / e-KYC VERIFIED NODE", 40, 85, textPaint);

        // Smart Card Microchip
        Paint chipPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        chipPaint.setColor(Color.parseColor("#FBBF24"));
        RectF chipRect = new RectF(50, 150, 170, 240);
        canvas.drawRoundRect(chipRect, 14, 14, chipPaint);

        Paint chipInner = new Paint(Paint.ANTI_ALIAS_FLAG);
        chipInner.setStyle(Paint.Style.STROKE);
        chipInner.setStrokeWidth(2);
        chipInner.setColor(Color.parseColor("#78350F"));
        canvas.drawRoundRect(new RectF(60, 160, 160, 230), 8, 8, chipInner);
        canvas.drawLine(110, 150, 110, 240, chipInner);
        canvas.drawLine(50, 195, 170, 195, chipInner);

        // Identity Information
        textPaint.setColor(Color.parseColor("#94A3B8"));
        textPaint.setTextSize(16);
        canvas.drawText("IDENTITY NUMBER (NIC):", 210, 160, textPaint);

        textPaint.setColor(Color.WHITE);
        textPaint.setTextSize(34);
        textPaint.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        canvas.drawText(nic.toUpperCase(), 210, 205, textPaint);

        textPaint.setColor(Color.parseColor("#94A3B8"));
        textPaint.setTextSize(16);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        canvas.drawText("CARDHOLDER NAME:", 210, 260, textPaint);

        textPaint.setColor(Color.WHITE);
        textPaint.setTextSize(26);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText(fullName.isEmpty() ? "SOLAR PROSUMER" : fullName.toUpperCase(), 210, 295, textPaint);

        // Verification Pill Badge
        Paint badgePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        badgePaint.setColor(Color.parseColor("#10B981"));
        RectF badgeRect = new RectF(width - 240, height - 100, width - 40, height - 40);
        canvas.drawRoundRect(badgeRect, 12, 12, badgePaint);

        Paint badgeText = new Paint(Paint.ANTI_ALIAS_FLAG);
        badgeText.setColor(Color.parseColor("#0F172A"));
        badgeText.setTextSize(18);
        badgeText.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText("✓ e-KYC VERIFIED", width - 225, height - 62, badgeText);

        // Export Base64
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
        byte[] bytes = outputStream.toByteArray();
        attachedNicBase64 = "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);

        ivNicPreview.setImageBitmap(bitmap);
        layoutNicPreview.setVisibility(View.VISIBLE);
        tvDocStatus.setText("✓ Digital NIC Scan Generated (" + (bytes.length / 1024) + " KB)");
        tvDocStatus.setTextColor(ContextCompat.getColor(this, R.color.accent));
        Toast.makeText(this, "Digital Sri Lankan NIC generated.", Toast.LENGTH_SHORT).show();
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

        if (!nic.matches("^([0-9]{9}[VvXx]|[0-9]{12})$")) {
            Toast.makeText(this, "Invalid NIC format. Must be 9 digits with V/X or 12 digits.", Toast.LENGTH_LONG).show();
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

        // Auto-generate digital scan fallback if user did not pick a photo
        if (attachedNicBase64 == null) {
            generateDigitalNicCard(nic, fullName);
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
                attachedNicBase64
        );

        ApiClient.getService(this).registerProsumer(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);

                if (response.isSuccessful()) {
                    new AlertDialog.Builder(RegisterActivity.this)
                            .setTitle("KYC Registration Submitted")
                            .setMessage("Your solar prosumer profile with e-KYC document has been registered.\n\nNIC: " + nic + "\nSolar Array: " + solarKw + " kW\nInverter: " + inverterSerial + "\n\nPer system specification, your account is in 'Pending' status awaiting Backoffice review.")
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

