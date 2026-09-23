package com.ead.solarmicrogrid.data.models;

import com.google.gson.annotations.SerializedName;

public class User {
    @SerializedName("nic")
    private String nic;

    @SerializedName("fullName")
    private String fullName;

    @SerializedName("email")
    private String email;

    @SerializedName("phone")
    private String phone;

    @SerializedName("address")
    private String address = "";

    @SerializedName("role")
    private String role;

    @SerializedName("status")
    private String status;

    @SerializedName("solarCapacityKw")
    private double solarCapacityKw = 0.0;

    @SerializedName("inverterSerial")
    private String inverterSerial = "";

    public User() {}

    public User(String nic, String fullName, String email, String phone, String address, String role, String status, double solarCapacityKw, String inverterSerial) {
        this.nic = nic;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.address = address;
        this.role = role;
        this.status = status;
        this.solarCapacityKw = solarCapacityKw;
        this.inverterSerial = inverterSerial;
    }

    public User(String nic, String fullName, String email, String phone, String role, String status) {
        this(nic, fullName, email, phone, "", role, status, 15.0, "INV-SL-2026-DEFAULT");
    }

    public String getNic() { return nic; }
    public void setNic(String nic) { this.nic = nic; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getSolarCapacityKw() { return solarCapacityKw; }
    public void setSolarCapacityKw(double solarCapacityKw) { this.solarCapacityKw = solarCapacityKw; }

    public String getInverterSerial() { return inverterSerial; }
    public void setInverterSerial(String inverterSerial) { this.inverterSerial = inverterSerial; }
}
