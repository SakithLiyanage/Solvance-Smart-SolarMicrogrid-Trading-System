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
                new androidx.appcompat.app.AlertDialog.Builder(LoginActivity.this)
                        .setTitle("Connection Notice")
                        .setMessage("Cannot connect to Solvance Server at:\n" + currentEndpoint + "\n\nEnsure phone and PC are on the same Wi-Fi or Hotspot.")
                        .setPositiveButton("Retry", (dialog, which) -> performLogin())
                        .setNeutralButton("Set Server IP", (dialog, which) -> promptServerIp())
                        .setNegativeButton("Dismiss", null)
                        .show();
            }
        });
    }

    private void promptServerIp() {
        final android.widget.EditText input = new android.widget.EditText(this);
        input.setHint("e.g. 192.168.43.15 or 192.168.1.105");
        input.setText(ApiClient.getBaseUrl(this).replace("http://", "").replace("/api/", ""));
        input.setPadding(48, 32, 48, 32);

        new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Configure Server IP")
                .setMessage("Enter the PC IPv4 address (from 'ipconfig'):")
                .setView(input)
                .setPositiveButton("Save & Connect", (dialog, which) -> {
                    String ip = input.getText().toString().trim();
                    if (!ip.isEmpty()) {
                        ApiClient.setServerIp(this, ip);
                        Toast.makeText(this, "Target server updated: " + ip, Toast.LENGTH_SHORT).show();
                        performLogin();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void showForgotPasswordDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_forgot_password, null);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .create();

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
        }

        View layoutStep1 = dialogView.findViewById(R.id.layoutStep1Request);
        View layoutStep2 = dialogView.findViewById(R.id.layoutStep2Verify);

        // Step 1 Views
        EditText etRecoveryIdentifier = dialogView.findViewById(R.id.etRecoveryIdentifier);
        TextView tvStep1Error = dialogView.findViewById(R.id.tvStep1Error);
        Button btnCancelStep1 = dialogView.findViewById(R.id.btnCancelStep1);
        Button btnSendOtp = dialogView.findViewById(R.id.btnSendOtp);

        // Step 2 Views
        TextView tvOtpDispatchedInfo = dialogView.findViewById(R.id.tvOtpDispatchedInfo);
        EditText etRecoveryOtp = dialogView.findViewById(R.id.etRecoveryOtp);
        EditText etRecoveryNewPassword = dialogView.findViewById(R.id.etRecoveryNewPassword);
        EditText etRecoveryConfirmPassword = dialogView.findViewById(R.id.etRecoveryConfirmPassword);
        TextView tvStep2Error = dialogView.findViewById(R.id.tvStep2Error);
        Button btnBackToStep1 = dialogView.findViewById(R.id.btnBackToStep1);
        Button btnVerifyAndReset = dialogView.findViewById(R.id.btnVerifyAndReset);

        // Pre-fill identifier if already entered on login screen
        String enteredLogin = etUsername.getText() != null ? etUsername.getText().toString().trim() : "";
        if (!enteredLogin.isEmpty()) {
            etRecoveryIdentifier.setText(enteredLogin);
        }

        btnCancelStep1.setOnClickListener(v -> dialog.dismiss());

        final String[] currentIdentifierHolder = new String[1];

        // Step 1: Request OTP
        btnSendOtp.setOnClickListener(v -> {
            String identifier = etRecoveryIdentifier.getText() != null ? etRecoveryIdentifier.getText().toString().trim() : "";
            tvStep1Error.setVisibility(View.GONE);

            if (identifier.isEmpty()) {
                tvStep1Error.setText("Please enter your registered National ID (NIC) or Email.");
                tvStep1Error.setVisibility(View.VISIBLE);
                return;
            }

            btnSendOtp.setEnabled(false);
            btnSendOtp.setText("Sending...");

            AuthDtos.PasswordResetOtpRequest req = new AuthDtos.PasswordResetOtpRequest(identifier);
            ApiClient.getService(LoginActivity.this).requestPasswordResetOtp(req).enqueue(new Callback<AuthDtos.PasswordResetOtpResponse>() {
                @Override
                public void onResponse(Call<AuthDtos.PasswordResetOtpResponse> call, Response<AuthDtos.PasswordResetOtpResponse> response) {
                    btnSendOtp.setEnabled(true);
                    btnSendOtp.setText("Send Code");

                    if (response.isSuccessful() && response.body() != null) {
                        currentIdentifierHolder[0] = identifier;
                        AuthDtos.PasswordResetOtpResponse body = response.body();

                        tvOtpDispatchedInfo.setText(body.message != null ? body.message : "Verification code dispatched. Valid for 15 minutes.");

                        layoutStep1.setVisibility(View.GONE);
                        layoutStep2.setVisibility(View.VISIBLE);
                    } else {
                        String errMsg = "Failed to dispatch recovery code. Please check your identifier.";
                        try {
                            if (response.errorBody() != null) {
                                String raw = response.errorBody().string();
                                org.json.JSONObject obj = new org.json.JSONObject(raw);
                                if (obj.has("message")) errMsg = obj.getString("message");
                            }
                        } catch (Exception ignored) {}
                        tvStep1Error.setText(errMsg);
                        tvStep1Error.setVisibility(View.VISIBLE);
                    }
                }

                @Override
                public void onFailure(Call<AuthDtos.PasswordResetOtpResponse> call, Throwable t) {
                    btnSendOtp.setEnabled(true);
                    btnSendOtp.setText("Send Code");
                    tvStep1Error.setText("Network error: " + (t.getMessage() != null ? t.getMessage() : "Server unreachable"));
                    tvStep1Error.setVisibility(View.VISIBLE);
                }
            });
        });

        // Step 2: Back to Step 1
        btnBackToStep1.setOnClickListener(v -> {
            layoutStep2.setVisibility(View.GONE);
            layoutStep1.setVisibility(View.VISIBLE);
        });

        // Step 2: Verify OTP & Reset Password
        btnVerifyAndReset.setOnClickListener(v -> {
            String identifier = currentIdentifierHolder[0] != null ? currentIdentifierHolder[0] : etRecoveryIdentifier.getText().toString().trim();
            String otpCode = etRecoveryOtp.getText() != null ? etRecoveryOtp.getText().toString().trim() : "";
            String newPassword = etRecoveryNewPassword.getText() != null ? etRecoveryNewPassword.getText().toString() : "";
            String confirmPassword = etRecoveryConfirmPassword.getText() != null ? etRecoveryConfirmPassword.getText().toString() : "";

            tvStep2Error.setVisibility(View.GONE);

            if (otpCode.length() != 6) {
                tvStep2Error.setText("Please enter the 6-digit verification code.");
                tvStep2Error.setVisibility(View.VISIBLE);
                return;
            }

            if (newPassword.length() < 6) {
                tvStep2Error.setText("New password must be at least 6 characters.");
                tvStep2Error.setVisibility(View.VISIBLE);
                return;
            }

            if (!newPassword.equals(confirmPassword)) {
                tvStep2Error.setText("Passwords do not match.");
                tvStep2Error.setVisibility(View.VISIBLE);
                return;
            }

            btnVerifyAndReset.setEnabled(false);
            btnVerifyAndReset.setText("Verifying...");

            AuthDtos.PasswordResetVerifyRequest verifyReq = new AuthDtos.PasswordResetVerifyRequest(identifier, otpCode, newPassword, confirmPassword);
            ApiClient.getService(LoginActivity.this).verifyPasswordResetOtp(verifyReq).enqueue(new Callback<okhttp3.ResponseBody>() {
                @Override
                public void onResponse(Call<okhttp3.ResponseBody> call, Response<okhttp3.ResponseBody> response) {
                    btnVerifyAndReset.setEnabled(true);
                    btnVerifyAndReset.setText("Save Password");

                    if (response.isSuccessful()) {
                        dialog.dismiss();
                        etUsername.setText(identifier);
                        etPassword.setText(newPassword);

                        List<SolvanceDialog.DetailItem> details = new ArrayList<>();
                        details.add(new SolvanceDialog.DetailItem("Account", identifier));
                        details.add(new SolvanceDialog.DetailItem("Verification", "6-Digit OTP Confirmed"));
                        details.add(new SolvanceDialog.DetailItem("Status", "Password Updated"));

                        SolvanceDialog.showSuccess(
                                LoginActivity.this,
                                "Account Recovered",
                                "CREDENTIALS UPDATED",
                                "Your solar prosumer password has been securely updated. You can now sign into your microgrid account.",
                                details,
                                "Sign In Now",
                                () -> performLogin()
                        );
                    } else {
                        String errMsg = "Password update failed. Code may be invalid or expired.";
                        try {
                            if (response.errorBody() != null) {
                                String raw = response.errorBody().string();
                                org.json.JSONObject obj = new org.json.JSONObject(raw);
                                if (obj.has("message")) errMsg = obj.getString("message");
                            }
                        } catch (Exception ignored) {}
                        tvStep2Error.setText(errMsg);
                        tvStep2Error.setVisibility(View.VISIBLE);
                    }
                }

                @Override
                public void onFailure(Call<okhttp3.ResponseBody> call, Throwable t) {
                    btnVerifyAndReset.setEnabled(true);
                    btnVerifyAndReset.setText("Save Password");
                    tvStep2Error.setText("Network error: " + (t.getMessage() != null ? t.getMessage() : "Server unreachable"));
                    tvStep2Error.setVisibility(View.VISIBLE);
                }
            });
        });

        dialog.show();
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
