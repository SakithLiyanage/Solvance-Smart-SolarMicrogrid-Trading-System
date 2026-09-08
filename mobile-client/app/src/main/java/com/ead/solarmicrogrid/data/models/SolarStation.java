package com.ead.solarmicrogrid.data.models;

import com.google.gson.annotations.SerializedName;

public class SolarStation {
    @SerializedName("id")
    private String id;

    @SerializedName("stationCode")
    private String stationCode;

    @SerializedName("name")
    private String name;

    @SerializedName("latitude")
    private double latitude;

    @SerializedName("longitude")
    private double longitude;

    @SerializedName("address")
    private String address;

    @SerializedName("capacityKwh")
    private double capacityKwh;

    @SerializedName("totalBatterySlots")
    private int totalBatterySlots;

    @SerializedName("availableBatterySlots")
    private int availableBatterySlots;

    @SerializedName("isActive")
    private boolean isActive;

    public SolarStation() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public double getCapacityKwh() { return capacityKwh; }
    public void setCapacityKwh(double capacityKwh) { this.capacityKwh = capacityKwh; }

    public int getTotalBatterySlots() { return totalBatterySlots; }
    public void setTotalBatterySlots(int totalBatterySlots) { this.totalBatterySlots = totalBatterySlots; }

    public int getAvailableBatterySlots() { return availableBatterySlots; }
    public void setAvailableBatterySlots(int availableBatterySlots) { this.availableBatterySlots = availableBatterySlots; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
}
