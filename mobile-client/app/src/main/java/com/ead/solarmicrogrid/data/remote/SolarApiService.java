package com.ead.solarmicrogrid.data.remote;

import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.models.EnergyReservation;
import com.ead.solarmicrogrid.data.models.SolarStation;

import java.util.List;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface SolarApiService {

    @POST("auth/login")
    Call<AuthDtos.AuthResponse> login(@Body AuthDtos.LoginRequest request);

    @POST("auth/register-prosumer")
    Call<ResponseBody> registerProsumer(@Body AuthDtos.RegisterRequest request);

    @GET("stations")
    Call<List<SolarStation>> getStations(@Query("activeOnly") boolean activeOnly);

    @POST("reservations")
    Call<ResponseBody> createReservation(@Body AuthDtos.CreateReservationRequest request);

    @POST("reservations/{id}/approve")
    Call<ResponseBody> approveReservation(@Path("id") String id);

    @PUT("reservations/{id}")
    Call<ResponseBody> updateReservation(@Path("id") String id, @Body AuthDtos.UpdateReservationRequest request);

    @POST("reservations/{id}/cancel")
    Call<ResponseBody> cancelReservation(@Path("id") String id, @Body AuthDtos.CancelRequest request);

    @GET("reservations/prosumer/{nic}")
    Call<List<EnergyReservation>> getProsumerReservations(@Path("nic") String nic);

    @GET("reservations/dashboard-stats")
    Call<AuthDtos.DashboardStats> getDashboardStats(@Query("nic") String nic);

    @POST("reservations/verify-qr")
    Call<ResponseBody> verifyQr(@Body AuthDtos.VerifyQrRequest request);

    @GET("reservations")
    Call<List<EnergyReservation>> getAllReservations();

    @PUT("stations/{id}/battery-slots")
    Call<ResponseBody> updateBatterySlots(@Path("id") String id, @Body AuthDtos.UpdateBatterySlotsRequest request);

    @POST("auth/forgot-password")
    Call<ResponseBody> forgotPassword(@Body AuthDtos.ForgotPasswordRequest request);

    @POST("auth/change-password")
    Call<ResponseBody> changePassword(@Body AuthDtos.ChangePasswordRequest request);

    @PUT("users/profile")
    Call<ResponseBody> updateProfile(@Body AuthDtos.UpdateProfileRequest request);

    @POST("users/deactivate-self")
    Call<ResponseBody> deactivateSelf();
}
