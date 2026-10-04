package com.ead.solarmicrogrid.data.models;

import com.google.gson.annotations.SerializedName;

public class AuthDtos {
    public static class LoginRequest {
        @SerializedName("usernameOrNic")
        public String usernameOrNic;
        @SerializedName("password")
        public String password;

        public LoginRequest(String usernameOrNic, String password) {
            this.usernameOrNic = usernameOrNic;
            this.password = password;
        }
    }

    public static class AuthResponse {
        @SerializedName("token")
        public String token;
        @SerializedName("nic")
        public String nic;
        @SerializedName("fullName")
        public String fullName;
        @SerializedName("email")
        public String email;
        @SerializedName("phone")
        public String phone;
        @SerializedName("address")
        public String address;
        @SerializedName("role")
        public String role;
        @SerializedName("status")
        public String status;
        @SerializedName("solarCapacityKw")
        public double solarCapacityKw;
        @SerializedName("inverterSerial")
        public String inverterSerial;
    }

    public static class AuthErrorResponse {
        @SerializedName("code")
        public String code;
        @SerializedName("message")
        public String message;
        @SerializedName("status")
        public String status;
    }

    public static class RegisterRequest {
        @SerializedName("nic")
        public String nic;
        @SerializedName("fullName")
        public String fullName;
        @SerializedName("email")
        public String email;
        @SerializedName("phone")
        public String phone;
        @SerializedName("address")
        public String address;
        @SerializedName("solarCapacityKw")
        public double solarCapacityKw;
        @SerializedName("inverterSerial")
        public String inverterSerial;
        @SerializedName("nicDocumentBase64")
        public String nicDocumentBase64;
        @SerializedName("nicBackDocumentBase64")
        public String nicBackDocumentBase64;
        @SerializedName("utilityBillBase64")
        public String utilityBillBase64;
        @SerializedName("password")
        public String password;

        public RegisterRequest(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial, String password, String nicDocumentBase64, String nicBackDocumentBase64, String utilityBillBase64) {
            this.nic = nic;
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
            this.address = address;
            this.solarCapacityKw = solarCapacityKw;
            this.inverterSerial = inverterSerial;
            this.password = password;
            this.nicDocumentBase64 = nicDocumentBase64;
            this.nicBackDocumentBase64 = nicBackDocumentBase64;
            this.utilityBillBase64 = utilityBillBase64;
        }

        public RegisterRequest(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial, String password, String nicDocumentBase64, String utilityBillBase64) {
            this(nic, fullName, email, phone, address, solarCapacityKw, inverterSerial, password, nicDocumentBase64, null, utilityBillBase64);
        }

        public RegisterRequest(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial, String password, String nicDocumentBase64) {
            this(nic, fullName, email, phone, address, solarCapacityKw, inverterSerial, password, nicDocumentBase64, null, null);
        }

        public RegisterRequest(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial, String password) {
            this(nic, fullName, email, phone, address, solarCapacityKw, inverterSerial, password, null, null, null);
        }

        public RegisterRequest(String nic, String fullName, String email, String phone, String password) {
            this(nic, fullName, email, phone, "", 15.0, "INV-SL-2026-DEFAULT", password, null, null, null);
        }
    }

    public static class CreateReservationRequest {
        @SerializedName("prosumerNic")
        public String prosumerNic;
        @SerializedName("stationId")
        public String stationId;
        @SerializedName("slotId")
        public String slotId;
        @SerializedName("scheduledDateTime")
        public String scheduledDateTime;
        @SerializedName("energyAmountKwh")
        public double energyAmountKwh;
        @SerializedName("tradeType")
        public String tradeType;

        public CreateReservationRequest(String prosumerNic, String stationId, String scheduledDateTime, double energyAmountKwh, String tradeType) {
            this.prosumerNic = prosumerNic;
            this.stationId = stationId;
            this.slotId = "";
            this.scheduledDateTime = scheduledDateTime;
            this.energyAmountKwh = energyAmountKwh;
            this.tradeType = tradeType;
        }
    }

    public static class CancelRequest {
        @SerializedName("reason")
        public String reason;

        public CancelRequest(String reason) {
            this.reason = reason;
        }
    }

    public static class VerifyQrRequest {
        @SerializedName("qrCodeToken")
        public String qrCodeToken;
        @SerializedName("stationId")
        public String stationId;

        public VerifyQrRequest(String qrCodeToken, String stationId) {
            this.qrCodeToken = qrCodeToken;
            this.stationId = stationId;
        }

        public VerifyQrRequest(String qrCodeToken) {
            this(qrCodeToken, null);
        }
    }

    public static class DashboardStats {
        @SerializedName("activeBookingsCount")
        public int activeBookingsCount;
        @SerializedName("pendingBookingsCount")
        public int pendingBookingsCount;
        @SerializedName("approvedFutureBookingsCount")
        public int approvedFutureBookingsCount;
    }

    public static class UpdateBatterySlotsRequest {
        @SerializedName("availableSlots")
        public int availableSlots;

        public UpdateBatterySlotsRequest(int availableSlots) {
            this.availableSlots = availableSlots;
        }
    }

    public static class UpdateProfileRequest {
        @SerializedName("fullName")
        public String fullName;
        @SerializedName("email")
        public String email;
        @SerializedName("phone")
        public String phone;
        @SerializedName("address")
        public String address;
        @SerializedName("solarCapacityKw")
        public double solarCapacityKw;
        @SerializedName("inverterSerial")
        public String inverterSerial;

        public UpdateProfileRequest(String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial) {
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
            this.address = address;
            this.solarCapacityKw = solarCapacityKw;
            this.inverterSerial = inverterSerial;
        }

        public UpdateProfileRequest(String fullName, String email, String phone, String address) {
            this(fullName, email, phone, address, 15.0, "INV-SL-2026-DEFAULT");
        }

        public UpdateProfileRequest(String fullName, String email, String phone) {
            this(fullName, email, phone, "", 15.0, "INV-SL-2026-DEFAULT");
        }
    }

    public static class UpdateReservationRequest {
        @SerializedName("scheduledDateTime")
        public String scheduledDateTime;
        @SerializedName("energyAmountKwh")
        public double energyAmountKwh;
        @SerializedName("tradeType")
        public String tradeType;

        public UpdateReservationRequest(String scheduledDateTime, double energyAmountKwh, String tradeType) {
            this.scheduledDateTime = scheduledDateTime;
            this.energyAmountKwh = energyAmountKwh;
            this.tradeType = tradeType;
        }
    }

    public static class PasswordResetOtpRequest {
        @SerializedName("identifier")
        public String identifier;

        public PasswordResetOtpRequest(String identifier) {
            this.identifier = identifier;
        }
    }

    public static class PasswordResetOtpResponse {
        @SerializedName("message")
        public String message;
        @SerializedName("maskedRecipient")
        public String maskedRecipient;
        @SerializedName("expiresInMinutes")
        public int expiresInMinutes;
        @SerializedName("debugCode")
        public String debugCode;
    }

    public static class PasswordResetVerifyRequest {
        @SerializedName("identifier")
        public String identifier;
        @SerializedName("otpCode")
        public String otpCode;
        @SerializedName("newPassword")
        public String newPassword;
        @SerializedName("confirmPassword")
        public String confirmPassword;

        public PasswordResetVerifyRequest(String identifier, String otpCode, String newPassword, String confirmPassword) {
            this.identifier = identifier;
            this.otpCode = otpCode;
            this.newPassword = newPassword;
            this.confirmPassword = confirmPassword;
        }
    }

    public static class ForgotPasswordRequest {
        @SerializedName("nic")
        public String nic;
        @SerializedName("email")
        public String email;
        @SerializedName("newPassword")
        public String newPassword;
        @SerializedName("confirmPassword")
        public String confirmPassword;

        public ForgotPasswordRequest(String nic, String email, String newPassword, String confirmPassword) {
            this.nic = nic;
            this.email = email;
            this.newPassword = newPassword;
            this.confirmPassword = confirmPassword;
        }

        public ForgotPasswordRequest(String nic, String email, String newPassword) {
            this(nic, email, newPassword, newPassword);
        }
    }

    public static class ChangePasswordRequest {
        @SerializedName("currentPassword")
        public String currentPassword;
        @SerializedName("newPassword")
        public String newPassword;
        @SerializedName("confirmPassword")
        public String confirmPassword;

        public ChangePasswordRequest(String currentPassword, String newPassword, String confirmPassword) {
            this.currentPassword = currentPassword;
            this.newPassword = newPassword;
            this.confirmPassword = confirmPassword;
        }
    }
}