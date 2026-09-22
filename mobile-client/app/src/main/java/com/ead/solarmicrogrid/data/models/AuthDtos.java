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
        @SerializedName("utilityBillBase64")
        public String utilityBillBase64;
        @SerializedName("password")
        public String password;

        public RegisterRequest(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial, String password, String nicDocumentBase64) {
            this.nic = nic;
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
            this.address = address;
            this.solarCapacityKw = solarCapacityKw;
            this.inverterSerial = inverterSerial;
            this.password = password;
            this.nicDocumentBase64 = nicDocumentBase64;
        }

        public RegisterRequest(String nic, String fullName, String email, String phone, String address, double solarCapacityKw, String inverterSerial, String password) {
            this(nic, fullName, email, phone, address, solarCapacityKw, inverterSerial, password, null);
        }

        public RegisterRequest(String nic, String fullName, String email, String phone, String password) {
            this(nic, fullName, email, phone, "", 15.0, "INV-SL-2026-DEFAULT", password, null);
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

        public VerifyQrRequest(String qrCodeToken) {
            this.qrCodeToken = qrCodeToken;
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

        public UpdateProfileRequest(String fullName, String email, String phone) {
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
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
}
