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
import android.view.LayoutInflater;
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
import com.ead.solarmicrogrid.util.SolvanceDialog;
import com.ead.solarmicrogrid.util.ThemeManager;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private TextInputEditText etUsername, etPassword;
    private Button btnLogin;
    private ImageButton btnThemeToggle;
    private android.widget.ImageView ivBrandLogo;
    private TextView tvRegister, tvForgotPassword;
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
        tvForgotPassword = findViewById(R.id.tvForgotPassword);
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

        if (tvForgotPassword != null) {
            tvForgotPassword.setOnClickListener(v -> showForgotPasswordDialog());
        }

        tvRegister.setOnClickListener(v -> {
            startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
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

    private void showForgotPasswordDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_forgot_password, null);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .create();

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
        }

        EditText etForgotNic = dialogView.findViewById(R.id.etForgotNic);
        EditText etForgotEmail = dialogView.findViewById(R.id.etForgotEmail);
        EditText etForgotNewPassword = dialogView.findViewById(R.id.etForgotNewPassword);
        EditText etForgotConfirmPassword = dialogView.findViewById(R.id.etForgotConfirmPassword);
        TextView tvForgotError = dialogView.findViewById(R.id.tvForgotError);
        Button btnCancel = dialogView.findViewById(R.id.btnCancelForgot);
        Button btnSubmit = dialogView.findViewById(R.id.btnSubmitForgot);

        // Pre-fill NIC or Email if already typed into main login form
        String enteredLogin = etUsername.getText() != null ? etUsername.getText().toString().trim() : "";
        if (!enteredLogin.isEmpty()) {
            if (enteredLogin.contains("@")) {
                etForgotEmail.setText(enteredLogin);
            } else {
                etForgotNic.setText(enteredLogin);
            }
        }

        btnCancel.setOnClickListener(v -> dialog.dismiss());

        btnSubmit.setOnClickListener(v -> {
            String nic = etForgotNic.getText() != null ? etForgotNic.getText().toString().trim() : "";
            String email = etForgotEmail.getText() != null ? etForgotEmail.getText().toString().trim() : "";
            String newPassword = etForgotNewPassword.getText() != null ? etForgotNewPassword.getText().toString() : "";
            String confirmPassword = etForgotConfirmPassword.getText() != null ? etForgotConfirmPassword.getText().toString() : "";

            tvForgotError.setVisibility(View.GONE);

            if (nic.isEmpty()) {
                tvForgotError.setText("Please enter your registered National ID (NIC).");
                tvForgotError.setVisibility(View.VISIBLE);
                return;
            }

            if (email.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                tvForgotError.setText("Please enter a valid registered email address.");
                tvForgotError.setVisibility(View.VISIBLE);
                return;
            }

            if (newPassword.length() < 6) {
                tvForgotError.setText("New password must be at least 6 characters.");
                tvForgotError.setVisibility(View.VISIBLE);
                return;
            }

            if (!newPassword.equals(confirmPassword)) {
                tvForgotError.setText("Passwords do not match.");
                tvForgotError.setVisibility(View.VISIBLE);
                return;
            }

            btnSubmit.setEnabled(false);
            btnSubmit.setText("Verifying...");

            AuthDtos.ForgotPasswordRequest req = new AuthDtos.ForgotPasswordRequest(nic, email, newPassword, confirmPassword);
            ApiClient.getService(LoginActivity.this).forgotPassword(req).enqueue(new Callback<okhttp3.ResponseBody>() {
                @Override
                public void onResponse(Call<okhttp3.ResponseBody> call, Response<okhttp3.ResponseBody> response) {
                    btnSubmit.setEnabled(true);
                    btnSubmit.setText("Reset Password");

                    if (response.isSuccessful()) {
                        dialog.dismiss();
                        etUsername.setText(nic);
                        etPassword.setText(newPassword);

                        List<SolvanceDialog.DetailItem> details = new ArrayList<>();
                        details.add(new SolvanceDialog.DetailItem("National ID", nic));
                        details.add(new SolvanceDialog.DetailItem("Registered Email", email));
                        details.add(new SolvanceDialog.DetailItem("Security Status", "Password Updated"));

                        SolvanceDialog.showSuccess(
                                LoginActivity.this,
                                "Password Reset Complete",
                                "CREDENTIALS UPDATED",
                                "Your solar prosumer password has been successfully reset. You can now log into your microgrid account.",
                                details,
                                "Sign In Now",
                                () -> performLogin()
                        );
                    } else {
                        String errMsg = "Password reset failed. Please verify your NIC and Email.";
                        try {
                            if (response.errorBody() != null) {
                                String errBodyStr = response.errorBody().string();
                                org.json.JSONObject obj = new org.json.JSONObject(errBodyStr);
                                if (obj.has("message")) {
                                    errMsg = obj.getString("message");
                                }
                            }
                        } catch (Exception ignored) { }

                        tvForgotError.setText(errMsg);
                        tvForgotError.setVisibility(View.VISIBLE);
                    }
                }

                @Override
                public void onFailure(Call<okhttp3.ResponseBody> call, Throwable t) {
                    btnSubmit.setEnabled(true);
                    btnSubmit.setText("Reset Password");
                    tvForgotError.setText("Connection failed: " + (t.getMessage() != null ? t.getMessage() : "Server unreachable"));
                    tvForgotError.setVisibility(View.VISIBLE);
                }
            });
        });

        dialog.show();
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
