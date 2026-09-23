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
    private android.widget.ImageView ivBrandLogo;
    private TextView tvRegister;
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
        progressBar = findViewById(R.id.progressBar);
        btnThemeToggle = findViewById(R.id.btnThemeToggle);
        ivBrandLogo = findViewById(R.id.ivBrandLogo);
    }

    private void setupListeners() {
        if (btnThemeToggle != null) {
            btnThemeToggle.setImageResource(ThemeManager.isDarkMode(this) ? R.drawable.ic_sun : R.drawable.ic_moon);
            btnThemeToggle.setOnClickListener(v -> ThemeManager.toggleTheme(this));
        }

        if (ivBrandLogo != null) {
            ivBrandLogo.setOnLongClickListener(v -> {
                showServerConfigDialog();
                return true;
            });
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
                        com.ead.solarmicrogrid.util.SolvanceDialog.showInfo(
                                LoginActivity.this,
                                "Solvance Web Portal Required",
                                "ROLE RESTRICTION",
                                "Welcome, " + authData.fullName + " (Backoffice Officer).\n\nBackoffice operations (e-KYC Verification, Staff Provisioning, and Grid Auditing) must be accessed via the Solvance Web Portal on desktop/browser.\n\nThe Android Client is dedicated to Prosumers and Grid Operators.",
                                "Understood",
                                null
                        );
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
                            com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                                    LoginActivity.this,
                                    "Account Pending KYC Review",
                                    "APPROVAL REQUIRED",
                                    "Your solar prosumer account is currently awaiting verification.\n\nPer enterprise microgrid compliance, a Backoffice administrator must review and approve your submission before grid access is unlocked.",
                                    "Understood",
                                    null
                            );
                        } else if ("ACCOUNT_DEACTIVATED".equalsIgnoreCase(errorCode) || errorMessage.toLowerCase().contains("deactivated")) {
                            com.ead.solarmicrogrid.util.SolvanceDialog.showError(
                                    LoginActivity.this,
                                    "Account Deactivated",
                                    "Your solar prosumer account has been deactivated.\n\nPer Microgrid security policy, deactivated accounts can ONLY be reactivated by a Backoffice officer.",
                                    "Contact Support",
                                    null
                            );
                        } else {
                            com.ead.solarmicrogrid.util.SolvanceDialog.showError(
                                    LoginActivity.this,
                                    "Access Forbidden",
                                    errorMessage,
                                    "OK",
                                    null
                            );
                        }
                    } else if (statusCode == 423 || "ACCOUNT_LOCKED".equalsIgnoreCase(errorCode)) {
                        com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                                LoginActivity.this,
                                "Account Locked Out",
                                "SECURITY TIMEOUT",
                                errorMessage + "\n\nPlease wait before attempting to sign in again.",
                                "OK",
                                null
                        );
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
                new AlertDialog.Builder(LoginActivity.this)
                        .setTitle("Server Connection Notice")
                        .setMessage("Unable to reach Solvance Web API at:\n" + currentEndpoint + "\n\nError: " + (t != null ? t.getMessage() : "Network timeout") + "\n\nTip: Long-press the Solvance Logo at top to switch endpoint anytime.")
                        .setPositiveButton("Switch Server", (dialog, which) -> showServerConfigDialog())
                        .setNegativeButton("Retry", (dialog, which) -> performLogin())
                        .setNeutralButton("Dismiss", null)
                        .show();
            }
        });
    }

    private void showServerConfigDialog() {
        String[] options = {
                "Host PC Wi-Fi LAN (192.168.1.105:5000) [Recommended]",
                "USB Cable Reverse (127.0.0.1:5000) [ADB]",
                "Android Emulator (10.0.2.2:5000)",
                "Custom URL..."
        };

        new AlertDialog.Builder(this)
                .setTitle("Solvance Server API Endpoint")
                .setItems(options, (dialog, which) -> {
                    switch (which) {
                        case 0:
                            ApiClient.setBaseUrl(this, "http://192.168.1.105:5000/api/");
                            Toast.makeText(this, "Server set to PC Wi-Fi LAN (192.168.1.105:5000)", Toast.LENGTH_SHORT).show();
                            break;
                        case 1:
                            ApiClient.setBaseUrl(this, "http://127.0.0.1:5000/api/");
                            Toast.makeText(this, "Server set to USB Reverse (127.0.0.1:5000)", Toast.LENGTH_SHORT).show();
                            break;
                        case 2:
                            ApiClient.setBaseUrl(this, "http://10.0.2.2:5000/api/");
                            Toast.makeText(this, "Server set to Emulator (10.0.2.2:5000)", Toast.LENGTH_SHORT).show();
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
        input.setPadding(32, 24, 32, 24);

        new AlertDialog.Builder(this)
                .setTitle("Enter Web API URL")
                .setView(input)
                .setPositiveButton("Save", (dialog, which) -> {
                    String url = input.getText().toString().trim();
                    if (!url.isEmpty()) {
                        ApiClient.setBaseUrl(this, url);
                        Toast.makeText(this, "Server updated to: " + url, Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
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
