package com.ead.solarmicrogrid.data.models;

import com.google.gson.annotations.SerializedName;

public class EnergyReservation {
    @SerializedName("id")
    private String id;

    @SerializedName("reservationNumber")
    private String reservationNumber;

    @SerializedName("prosumerNic")
    private String prosumerNic;

    @SerializedName("stationId")
    private String stationId;

    @SerializedName("stationName")
    private String stationName;

    @SerializedName("slotId")
    private String slotId;

    @SerializedName("scheduledDateTime")
    private String scheduledDateTime;

    @SerializedName("energyAmountKwh")
    private double energyAmountKwh;

    @SerializedName("tradeType")
    private String tradeType;

    @SerializedName("status")
    private String status;

    @SerializedName("qrCodeToken")
    private String qrCodeToken;

    @SerializedName("cancellationReason")
    private String cancellationReason;

    public EnergyReservation() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getReservationNumber() { return reservationNumber; }
    public void setReservationNumber(String reservationNumber) { this.reservationNumber = reservationNumber; }

    public String getProsumerNic() { return prosumerNic; }
    public void setProsumerNic(String prosumerNic) { this.prosumerNic = prosumerNic; }

    public String getStationId() { return stationId; }
    public void setStationId(String stationId) { this.stationId = stationId; }

    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }

    public String getSlotId() { return slotId; }
    public void setSlotId(String slotId) { this.slotId = slotId; }

    public String getScheduledDateTime() { return scheduledDateTime; }
    public void setScheduledDateTime(String scheduledDateTime) { this.scheduledDateTime = scheduledDateTime; }

    public double getEnergyAmountKwh() { return energyAmountKwh; }
    public void setEnergyAmountKwh(double energyAmountKwh) { this.energyAmountKwh = energyAmountKwh; }

    public String getTradeType() { return tradeType; }
    public void setTradeType(String tradeType) { this.tradeType = tradeType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getQrCodeToken() { return qrCodeToken; }
    public void setQrCodeToken(String qrCodeToken) { this.qrCodeToken = qrCodeToken; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }
}
