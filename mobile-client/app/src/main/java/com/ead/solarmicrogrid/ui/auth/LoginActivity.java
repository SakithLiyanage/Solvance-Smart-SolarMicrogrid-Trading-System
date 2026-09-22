// ============================================================================
// File: LoginActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Pure Android authentication controller handling multi-role login, SQLite session persistence, and API token storage.
// References & Citations:
//   - Android Activity Lifecycle & Intent Navigation:
//     https://developer.android.com/guide/components/activities/activity-lifecycle
//   - Square Retrofit 2 Network Call Enqueue:
//     https://square.github.io/retrofit/
//   - Android SQLite Database Session Storage:
//     https://developer.android.com/training/data-storage/sqlite
// ============================================================================

package com.ead.solarmicrogrid.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.local.DatabaseHelper;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.models.User;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.ead.solarmicrogrid.ui.operator.OperatorScannerActivity;
import com.ead.solarmicrogrid.ui.prosumer.ProsumerDashboardActivity;
import com.ead.solarmicrogrid.util.ThemeManager;
import com.google.android.material.textfield.TextInputEditText;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private TextInputEditText etUsername, etPassword;
    private Button btnLogin, btnQuickProsumer, btnQuickOperator;
    private ImageButton btnThemeToggle;
    private TextView tvRegister, tvServerConfig;
    private ProgressBar progressBar;
    private DatabaseHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        dbHelper = new DatabaseHelper(this);

        String autoUser = getIntent().getStringExtra("autoUser");
        String autoPass = getIntent().getStringExtra("autoPass");

        // Check if user already logged in locally in SQLite
        User existingUser = dbHelper.getLoggedInUser();
        if (autoUser == null && existingUser != null && !dbHelper.getAuthToken().isEmpty()) {
            if ("Backoffice".equalsIgnoreCase(existingUser.getRole())) {
                dbHelper.clearSession();
            } else {
                navigateForRole(existingUser.getRole());
                return;
            }
        }

        initViews();
        setupListeners();
        updateServerBadge();

        if (autoUser != null && autoPass != null) {
            dbHelper.clearSession();
            etUsername.setText(autoUser);
            etPassword.setText(autoPass);
            performLogin();
        }
    }

    private void initViews() {
        etUsername = findViewById(R.id.etUsername);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);
        tvRegister = findViewById(R.id.tvRegister);
        btnQuickProsumer = findViewById(R.id.btnQuickProsumer);
        btnQuickOperator = findViewById(R.id.btnQuickOperator);
        tvServerConfig = findViewById(R.id.tvServerConfig);
        progressBar = findViewById(R.id.progressBar);
        btnThemeToggle = findViewById(R.id.btnThemeToggle);
    }

    private void updateServerBadge() {
        if (tvServerConfig != null) {
            String currentUrl = ApiClient.getBaseUrl(this);
            tvServerConfig.setText("Server: " + currentUrl);
        }
    }

    private void setupListeners() {
        if (btnThemeToggle != null) {
            btnThemeToggle.setImageResource(ThemeManager.isDarkMode(this) ? R.drawable.ic_sun : R.drawable.ic_moon);
            btnThemeToggle.setOnClickListener(v -> ThemeManager.toggleTheme(this));
        }

        btnLogin.setOnClickListener(v -> performLogin());

        tvRegister.setOnClickListener(v -> {
            startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        btnQuickProsumer.setOnClickListener(v -> {
            etUsername.setText("200012345678");
            etPassword.setText("Prosumer@123");
        });

        btnQuickOperator.setOnClickListener(v -> {
            etUsername.setText("OPERATOR001");
            etPassword.setText("Operator@123");
        });

        if (tvServerConfig != null) {
            tvServerConfig.setOnClickListener(v -> showServerConfigDialog());
        }
    }

    private void showServerConfigDialog() {
        String[] options = {
                "USB Cable Reverse (127.0.0.1:5000) [Default USB]",
                "Wi-Fi LAN (192.168.1.105:5000) [Current Host PC]",
                "Android Emulator (10.0.2.2:5000)",
                "Custom URL..."
        };

        new AlertDialog.Builder(this)
                .setTitle("Select Server API Endpoint")
                .setItems(options, (dialog, which) -> {
                    switch (which) {
                        case 0:
                            ApiClient.setBaseUrl(this, "http://127.0.0.1:5000/api/");
                            updateServerBadge();
                            Toast.makeText(this, "Switched to USB Reverse (127.0.0.1:5000)", Toast.LENGTH_SHORT).show();
                            break;
                        case 1:
                            ApiClient.setBaseUrl(this, "http://192.168.1.105:5000/api/");
                            updateServerBadge();
                            Toast.makeText(this, "Switched to Wi-Fi LAN (192.168.1.105:5000)", Toast.LENGTH_SHORT).show();
                            break;
                        case 2:
                            ApiClient.setBaseUrl(this, "http://10.0.2.2:5000/api/");
                            updateServerBadge();
                            Toast.makeText(this, "Switched to Emulator (10.0.2.2:5000)", Toast.LENGTH_SHORT).show();
                            break;
                        case 3:
                            showCustomUrlDialog();
                            break;
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void showCustomUrlDialog() {
        final EditText input = new EditText(this);
        input.setText(ApiClient.getBaseUrl(this));
        input.setTextColor(androidx.core.content.ContextCompat.getColor(this, R.color.text_primary));
        input.setHintTextColor(androidx.core.content.ContextCompat.getColor(this, R.color.text_muted));
        input.setPadding(32, 24, 32, 24);

        new AlertDialog.Builder(this)
                .setTitle("Enter Custom Web API URL")
                .setView(input)
                .setPositiveButton("Save", (dialog, which) -> {
                    String url = input.getText().toString().trim();
                    if (!url.isEmpty()) {
                        ApiClient.setBaseUrl(this, url);
                        updateServerBadge();
                        Toast.makeText(this, "Server updated to: " + url, Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void performLogin() {
        String username = etUsername.getText() != null ? etUsername.getText().toString().trim() : "";
        String password = etPassword.getText() != null ? etPassword.getText().toString().trim() : "";

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please enter your National ID / Email and password.", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        btnLogin.setEnabled(false);

        AuthDtos.LoginRequest request = new AuthDtos.LoginRequest(username, password);
        ApiClient.getService(this).login(request).enqueue(new Callback<AuthDtos.AuthResponse>() {
            @Override
            public void onResponse(Call<AuthDtos.AuthResponse> call, Response<AuthDtos.AuthResponse> response) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);

                if (response.isSuccessful() && response.body() != null) {
                    AuthDtos.AuthResponse authData = response.body();

                    if ("Backoffice".equalsIgnoreCase(authData.role)) {
                        dbHelper.clearSession();
                        new AlertDialog.Builder(LoginActivity.this)
                                .setTitle("Solvance Web Portal Required")
                                .setMessage("Welcome, " + authData.fullName + " (Backoffice Officer).\n\nBackoffice operations (e-KYC Verification, Staff Provisioning, and Grid Auditing) must be accessed via the Solvance Web Portal at:\nhttp://localhost:5173\n\nThe Android Mobile Client is reserved for Prosumers and Field Grid Operators.")
                                .setPositiveButton("Understood", null)
                                .show();
                        return;
                    }

                    // Save session to local SQLite database with solar hardware specs
                    User user = new User(
                            authData.nic,
                            authData.fullName,
                            authData.email,
                            authData.phone != null ? authData.phone : "",
                            authData.address != null ? authData.address : "",
                            authData.role,
                            authData.status,
                            authData.solarCapacityKw,
                            authData.inverterSerial != null ? authData.inverterSerial : ""
                    );
                    dbHelper.saveUserSession(user, authData.token);

                    Toast.makeText(LoginActivity.this, "Welcome " + authData.fullName, Toast.LENGTH_SHORT).show();
                    navigateForRole(authData.role);
                } else {
                    int statusCode = response.code();
                    String errorCode = "";
                    String errorMessage = "Authentication failed. Please verify your credentials.";

                    try {
                        if (response.errorBody() != null) {
                            String raw = response.errorBody().string();
                            org.json.JSONObject obj = new org.json.JSONObject(raw);
                            if (obj.has("code")) errorCode = obj.getString("code");
                            if (obj.has("message")) errorMessage = obj.getString("message");
                        }
                    } catch (Exception ignored) {}

                    if (statusCode == 403) {
                        if ("ACCOUNT_PENDING".equalsIgnoreCase(errorCode) || errorMessage.toLowerCase().contains("pending")) {
                            new AlertDialog.Builder(LoginActivity.this)
                                    .setTitle("Account Pending KYC Review")
                                    .setMessage("Your solar prosumer account is currently in 'Pending' status.\n\nPer system specification, a Backoffice administrator must verify and approve your registration before login.")
                                    .setPositiveButton("Understood", null)
                                    .show();
                        } else if ("ACCOUNT_DEACTIVATED".equalsIgnoreCase(errorCode) || errorMessage.toLowerCase().contains("deactivated")) {
                            new AlertDialog.Builder(LoginActivity.this)
                                    .setTitle("Account Deactivated")
                                    .setMessage("Your account has been deactivated.\n\nPer Microgrid security policy, deactivated accounts can ONLY be reactivated by a Backoffice officer.")
                                    .setPositiveButton("Contact Support", null)
                                    .show();
                        } else {
                            new AlertDialog.Builder(LoginActivity.this)
                                    .setTitle("Access Forbidden")
                                    .setMessage(errorMessage)
                                    .setPositiveButton("OK", null)
                                    .show();
                        }
                    } else if (statusCode == 423 || "ACCOUNT_LOCKED".equalsIgnoreCase(errorCode)) {
                        new AlertDialog.Builder(LoginActivity.this)
                                .setTitle("Account Locked Out")
                                .setMessage(errorMessage + "\n\nPlease wait before attempting to sign in again.")
                                .setPositiveButton("OK", null)
                                .show();
                    } else {
                        Toast.makeText(LoginActivity.this, errorMessage, Toast.LENGTH_LONG).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<AuthDtos.AuthResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                String currentEndpoint = ApiClient.getBaseUrl(LoginActivity.this);
                Toast.makeText(LoginActivity.this, "Unable to reach Web API at: " + currentEndpoint + "\nTap Server at bottom to switch.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private void navigateForRole(String role) {
        if ("GridOperator".equalsIgnoreCase(role)) {
            Intent intent = new Intent(this, OperatorScannerActivity.class);
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
            finish();
        } else {
            Intent intent = new Intent(this, ProsumerDashboardActivity.class);
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
            finish();
        }
    }
}
