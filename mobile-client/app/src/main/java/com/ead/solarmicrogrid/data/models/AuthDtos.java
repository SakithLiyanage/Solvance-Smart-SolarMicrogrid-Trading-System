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
        @SerializedName("role")
        public String role;
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
        @SerializedName("password")
        public String password;

        public RegisterRequest(String nic, String fullName, String email, String phone, String password) {
            this.nic = nic;
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
            this.password = password;
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
}
