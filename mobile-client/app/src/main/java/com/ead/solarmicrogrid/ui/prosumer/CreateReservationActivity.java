// ============================================================================
// File: CreateReservationActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Prosumer energy slot booking activity implementing 7-day advance booking window validation and dynamic capacity check.
// References & Citations:
//   - Android DatePicker & TimePicker Dialog Widgets:
//     https://developer.android.com/reference/android/app/DatePickerDialog
//   - Square Retrofit 2 HTTP Network API Client:
//     https://square.github.io/retrofit/
// ============================================================================

package com.ead.solarmicrogrid.ui.prosumer;

import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.local.DatabaseHelper;
import com.ead.solarmicrogrid.data.models.AuthDtos;
import com.ead.solarmicrogrid.data.models.SolarStation;
import com.ead.solarmicrogrid.data.models.User;
import com.ead.solarmicrogrid.data.remote.ApiClient;
import com.google.android.material.textfield.TextInputEditText;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CreateReservationActivity extends AppCompatActivity {

    private Spinner spStations;
    private RadioGroup rgTradeType;
    private RadioButton rbDropOff;
    private TextInputEditText etEnergyAmount;
    private TextView chipKwh10, chipKwh15, chipKwh25, chipKwh50;
    private Button btnPickDate, btnPickTime, btnConfirmBooking;
    private TextView tvSelectedDateTime;
    private ProgressBar progressBar;

    private DatabaseHelper dbHelper;
    private User currentUser;
    private List<SolarStation> stationList = new ArrayList<>();
    private Calendar selectedCalendar = Calendar.getInstance();
    private boolean isDateSelected = false;
    private boolean isTimeSelected = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_reservation);

        dbHelper = new DatabaseHelper(this);
        currentUser = dbHelper.getLoggedInUser();

        initViews();
        loadStations();
        setupDateTimePickers();
        setupKwhChips();
        setupSubmitListener();
    }

    private void initViews() {
        spStations = findViewById(R.id.spStations);
        rgTradeType = findViewById(R.id.rgTradeType);
        rbDropOff = findViewById(R.id.rbDropOff);
        etEnergyAmount = findViewById(R.id.etEnergyAmount);
        chipKwh10 = findViewById(R.id.chipKwh10);
        chipKwh15 = findViewById(R.id.chipKwh15);
        chipKwh25 = findViewById(R.id.chipKwh25);
        chipKwh50 = findViewById(R.id.chipKwh50);
        btnPickDate = findViewById(R.id.btnPickDate);
        btnPickTime = findViewById(R.id.btnPickTime);
        btnConfirmBooking = findViewById(R.id.btnConfirmBooking);
        tvSelectedDateTime = findViewById(R.id.tvSelectedDateTime);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupKwhChips() {
        if (chipKwh10 != null) chipKwh10.setOnClickListener(v -> setKwhPreset("10.0", chipKwh10));
        if (chipKwh15 != null) chipKwh15.setOnClickListener(v -> setKwhPreset("15.0", chipKwh15));
        if (chipKwh25 != null) chipKwh25.setOnClickListener(v -> setKwhPreset("25.0", chipKwh25));
        if (chipKwh50 != null) chipKwh50.setOnClickListener(v -> setKwhPreset("50.0", chipKwh50));
    }

    private void setKwhPreset(String val, TextView selectedChip) {
        etEnergyAmount.setText(val);
        resetChip(chipKwh10);
        resetChip(chipKwh15);
        resetChip(chipKwh25);
        resetChip(chipKwh50);
        highlightChip(selectedChip);
    }

    private void resetChip(TextView chip) {
        if (chip != null) {
            chip.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip));
            chip.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
        }
    }

    private void highlightChip(TextView chip) {
        if (chip != null) {
            chip.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip_active));
            chip.setTextColor(ContextCompat.getColor(this, R.color.primary));
        }
    }

    private void loadStations() {
        stationList = dbHelper.getCachedStations();
        if (!stationList.isEmpty()) {
            populateSpinner();
        }

        ApiClient.getService(this).getStations(true).enqueue(new Callback<List<SolarStation>>() {
            @Override
            public void onResponse(Call<List<SolarStation>> call, Response<List<SolarStation>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    stationList = response.body();
                    dbHelper.cacheStations(stationList);
                    populateSpinner();
                }
            }

            @Override
            public void onFailure(Call<List<SolarStation>> call, Throwable t) {}
        });
    }

    private void populateSpinner() {
        List<String> names = new ArrayList<>();
        for (SolarStation s : stationList) {
            names.add(s.getName() + " (" + s.getAvailableBatterySlots() + " slots free)");
        }
        ArrayAdapter<String> spinnerAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names);
        spStations.setAdapter(spinnerAdapter);
    }

    private void setupDateTimePickers() {
        final Calendar now = Calendar.getInstance();
        final Calendar maxDate = Calendar.getInstance();
        maxDate.add(Calendar.DAY_OF_YEAR, 7);

        btnPickDate.setOnClickListener(v -> {
            DatePickerDialog dialog = new DatePickerDialog(
                    CreateReservationActivity.this,
                    (view, year, month, dayOfMonth) -> {
                        selectedCalendar.set(Calendar.YEAR, year);
                        selectedCalendar.set(Calendar.MONTH, month);
                        selectedCalendar.set(Calendar.DAY_OF_MONTH, dayOfMonth);
                        isDateSelected = true;
                        updateDateTimeText();
                    },
                    now.get(Calendar.YEAR),
                    now.get(Calendar.MONTH),
                    now.get(Calendar.DAY_OF_MONTH)
            );
            dialog.getDatePicker().setMinDate(now.getTimeInMillis());
            dialog.getDatePicker().setMaxDate(maxDate.getTimeInMillis());
            dialog.show();
        });

        btnPickTime.setOnClickListener(v -> {
            TimePickerDialog dialog = new TimePickerDialog(
                    CreateReservationActivity.this,
                    (view, hourOfDay, minute) -> {
                        selectedCalendar.set(Calendar.HOUR_OF_DAY, hourOfDay);
                        selectedCalendar.set(Calendar.MINUTE, minute);
                        selectedCalendar.set(Calendar.SECOND, 0);
                        isTimeSelected = true;
                        updateDateTimeText();
                    },
                    selectedCalendar.get(Calendar.HOUR_OF_DAY),
                    selectedCalendar.get(Calendar.MINUTE),
                    true
            );
            dialog.show();
        });
    }

    private void updateDateTimeText() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);
        tvSelectedDateTime.setText("Scheduled: " + sdf.format(selectedCalendar.getTime()) + " UTC");
    }

    private void setupSubmitListener() {
        btnConfirmBooking.setOnClickListener(v -> {
            if (!isDateSelected || !isTimeSelected) {
                Toast.makeText(this, "Please select both date and time (within 7 days).", Toast.LENGTH_SHORT).show();
                return;
            }

            if (stationList.isEmpty() || spStations.getSelectedItemPosition() < 0) {
                Toast.makeText(this, "No solar hub selected.", Toast.LENGTH_SHORT).show();
                return;
            }

            String energyStr = etEnergyAmount.getText() != null ? etEnergyAmount.getText().toString().trim() : "";
            double parsedEnergy;
            try {
                parsedEnergy = Double.parseDouble(energyStr);
            } catch (NumberFormatException e) {
                Toast.makeText(this, "Enter valid energy amount.", Toast.LENGTH_SHORT).show();
                return;
            }

            if (parsedEnergy <= 0) {
                Toast.makeText(this, "Energy amount must be greater than 0.", Toast.LENGTH_SHORT).show();
                return;
            }

            final double energy = parsedEnergy;

            SolarStation selectedStation = stationList.get(spStations.getSelectedItemPosition());
            String tradeType = rbDropOff.isChecked() ? "DropOff" : "Charging";

            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
            String scheduledIso = isoFormat.format(selectedCalendar.getTime());

            progressBar.setVisibility(View.VISIBLE);
            btnConfirmBooking.setEnabled(false);

            AuthDtos.CreateReservationRequest request = new AuthDtos.CreateReservationRequest(
                    currentUser.getNic(),
                    selectedStation.getId(),
                    scheduledIso,
                    energy,
                    tradeType
            );

            ApiClient.getService(this).createReservation(request).enqueue(new Callback<ResponseBody>() {
                @Override
                public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                    progressBar.setVisibility(View.GONE);
                    btnConfirmBooking.setEnabled(true);

                    if (response.isSuccessful()) {
                        new AlertDialog.Builder(CreateReservationActivity.this)
                                .setTitle("Booking Confirmed & Pass Issued")
                                .setMessage("Your power trading slot has been reserved successfully!\n\n" +
                                        "Station: " + selectedStation.getName() + "\n" +
                                        "Schedule: " + scheduledIso + "\n" +
                                        "Energy: " + energy + " kWh (" + tradeType + ")\n\n" +
                                        "Digital Pass with secure transaction QR generated.")
                                .setPositiveButton("View Booking Details", (dialog, which) -> {
                                    finish();
                                    overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
                                })
                                .setCancelable(false)
                                .show();
                    } else {
                        Toast.makeText(CreateReservationActivity.this, "Booking rejected: Verify 7-day rule and account status.", Toast.LENGTH_LONG).show();
                    }
                }

                @Override
                public void onFailure(Call<ResponseBody> call, Throwable t) {
                    progressBar.setVisibility(View.GONE);
                    btnConfirmBooking.setEnabled(true);
                    Toast.makeText(CreateReservationActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        });
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
    }
}
