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

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.google.android.material.textfield.TextInputEditText;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private TextInputEditText etNic, etFullName, etEmail, etPhone, etAddress, etSolarCapacity, etInverterSerial, etPassword;
    private Button btnRegister;
    private TextView tvBackToLogin;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        initViews();
        setupListeners();
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
    }

    private void setupListeners() {
        btnRegister.setOnClickListener(v -> performRegistration());
        tvBackToLogin.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });
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

        progressBar.setVisibility(View.VISIBLE);
        btnRegister.setEnabled(false);

        AuthDtos.RegisterRequest request = new AuthDtos.RegisterRequest(nic, fullName, email, phone, address, solarKw, inverterSerial, password);
        ApiClient.getService(this).registerProsumer(request).enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                progressBar.setVisibility(View.GONE);
                btnRegister.setEnabled(true);

                if (response.isSuccessful()) {
                    new AlertDialog.Builder(RegisterActivity.this)
                            .setTitle("KYC Registration Submitted")
                            .setMessage("Your solar prosumer profile has been registered.\n\nNIC: " + nic + "\nSolar Array: " + solarKw + " kW\nInverter: " + inverterSerial + "\n\nPer system specification, your account is in 'Pending' status awaiting Backoffice review.")
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
