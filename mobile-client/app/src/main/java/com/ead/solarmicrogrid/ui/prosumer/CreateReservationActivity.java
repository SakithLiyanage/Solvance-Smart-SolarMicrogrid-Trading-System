// ============================================================================
// File: CreateReservationActivity.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Prosumer energy slot booking activity implementing 7-day advance booking window validation, dynamic capacity check, and panel-size cap.
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
import android.widget.ImageButton;
import android.widget.LinearLayout;
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

    // Mirrors ReservationSettings.PeakSunHoursPerDay on the server: one drop-off <= solar capacity (kW) x 5 hours
    private static final double PEAK_SUN_HOURS = 5.0;

    private ImageButton btnBack;
    private Spinner spStations;
    private RadioGroup rgTradeType;
    private RadioButton rbDropOff;
    private TextInputEditText etEnergyAmount;
    private TextView chipKwh10, chipKwh15, chipKwh25, chipKwh50;
    private Button btnPickDate, btnPickTime, btnConfirmBooking;
    private TextView tvSelectedDateTime, tvHorizonDateRange;
    private LinearLayout layoutDayChips;
    private ProgressBar progressBar;

    private DatabaseHelper dbHelper;
    private User currentUser;
    private List<SolarStation> stationList = new ArrayList<>();
    private Calendar selectedCalendar = Calendar.getInstance();
    private boolean isDateSelected = false;
    private boolean isTimeSelected = false;
    private final List<TextView> dayChipViews = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_reservation);

        dbHelper = new DatabaseHelper(this);
        currentUser = dbHelper.getLoggedInUser();

        initViews();
        loadStations();
        setupDayChips();
        setupDateTimePickers();
        setupKwhChips();
        setupSubmitListener();
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> {
                finish();
                overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
            });
        }
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
        tvHorizonDateRange = findViewById(R.id.tvHorizonDateRange);
        layoutDayChips = findViewById(R.id.layoutDayChips);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupDayChips() {
        if (layoutDayChips == null) return;
        layoutDayChips.removeAllViews();
        dayChipViews.clear();

        final Calendar baseCal = Calendar.getInstance();
        SimpleDateFormat dayNameFormat = new SimpleDateFormat("EEE", Locale.getDefault());
        SimpleDateFormat dayNumFormat = new SimpleDateFormat("MMM d", Locale.getDefault());
        SimpleDateFormat fullRangeFormat = new SimpleDateFormat("MMM d", Locale.getDefault());

        Calendar endRangeCal = Calendar.getInstance();
        endRangeCal.add(Calendar.DAY_OF_YEAR, 7);
        if (tvHorizonDateRange != null) {
            tvHorizonDateRange.setText("Allowed Booking Window: " + fullRangeFormat.format(baseCal.getTime()) +
                    " – " + fullRangeFormat.format(endRangeCal.getTime()) + " (Strict 7-Day Limit)");
        }

        for (int i = 0; i <= 7; i++) {
            final int dayOffset = i;
            final Calendar chipDate = Calendar.getInstance();
            chipDate.add(Calendar.DAY_OF_YEAR, dayOffset);

            TextView chip = new TextView(this);
            String title = (dayOffset == 0) ? "Today" : ((dayOffset == 1) ? "Tomorrow" : dayNameFormat.format(chipDate.getTime()));
            String subtitle = (dayOffset == 7) ? dayNumFormat.format(chipDate.getTime()) + " (Max)" : dayNumFormat.format(chipDate.getTime());
            chip.setText(title + "\n" + subtitle);
            chip.setTextSize(11);
            chip.setGravity(android.view.Gravity.CENTER);
            chip.setPadding(28, 14, 28, 14);
            chip.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip));
            chip.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            lp.setMargins(0, 0, 14, 0);
            chip.setLayoutParams(lp);

            chip.setOnClickListener(v -> {
                selectedCalendar.set(Calendar.YEAR, chipDate.get(Calendar.YEAR));
                selectedCalendar.set(Calendar.MONTH, chipDate.get(Calendar.MONTH));
                selectedCalendar.set(Calendar.DAY_OF_MONTH, chipDate.get(Calendar.DAY_OF_MONTH));
                isDateSelected = true;

                for (TextView c : dayChipViews) {
                    c.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip));
                    c.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
                }
                chip.setBackground(ContextCompat.getDrawable(this, R.drawable.bg_pill_chip_active));
                chip.setTextColor(ContextCompat.getColor(this, R.color.primary));

                updateDateTimeText();
            });

            dayChipViews.add(chip);
            layoutDayChips.addView(chip);
        }
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
        btnPickDate.setOnClickListener(v -> {
            final Calendar now = Calendar.getInstance();
            final Calendar maxDate = Calendar.getInstance();
            maxDate.add(Calendar.DAY_OF_YEAR, 7);
            maxDate.set(Calendar.HOUR_OF_DAY, 23);
            maxDate.set(Calendar.MINUTE, 59);
            maxDate.set(Calendar.SECOND, 59);
            maxDate.set(Calendar.MILLISECOND, 999);

            DatePickerDialog dialog = new DatePickerDialog(
                    CreateReservationActivity.this,
                    (view, year, month, dayOfMonth) -> {
                        Calendar picked = Calendar.getInstance();
                        picked.set(year, month, dayOfMonth, 0, 0, 0);
                        picked.set(Calendar.MILLISECOND, 0);

                        Calendar minCal = Calendar.getInstance();
                        minCal.set(Calendar.HOUR_OF_DAY, 0);
                        minCal.set(Calendar.MINUTE, 0);
                        minCal.set(Calendar.SECOND, 0);
                        minCal.set(Calendar.MILLISECOND, 0);

                        if (picked.before(minCal)) {
                            com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                                    this,
                                    "Past Date Blocked",
                                    "SCHEDULE POLICY",
                                    "Cannot schedule bookings in the past. Please select today or an upcoming day within 7 days.",
                                    "Adjust Date",
                                    null
                            );
                            isDateSelected = false;
                            updateDateTimeText();
                            return;
                        }

                        if (picked.after(maxDate)) {
                            SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                            com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                                    this,
                                    "7-Day Policy Violation",
                                    "SCHEDULE LIMIT EXCEEDED",
                                    "Trading reservations must be scheduled within 7 days from today (up to " + df.format(maxDate.getTime()) + ").",
                                    "Adjust Date",
                                    null
                            );
                            isDateSelected = false;
                            updateDateTimeText();
                            return;
                        }

                        selectedCalendar.set(Calendar.YEAR, year);
                        selectedCalendar.set(Calendar.MONTH, month);
                        selectedCalendar.set(Calendar.DAY_OF_MONTH, dayOfMonth);
                        isDateSelected = true;

                        // Sync chip state
                        for (int i = 0; i < dayChipViews.size(); i++) {
                            Calendar chipCal = Calendar.getInstance();
                            chipCal.add(Calendar.DAY_OF_YEAR, i);
                            boolean matches = chipCal.get(Calendar.YEAR) == year &&
                                    chipCal.get(Calendar.DAY_OF_YEAR) == picked.get(Calendar.DAY_OF_YEAR);
                            TextView chip = dayChipViews.get(i);
                            chip.setBackground(ContextCompat.getDrawable(this, matches ? R.drawable.bg_pill_chip_active : R.drawable.bg_pill_chip));
                            chip.setTextColor(ContextCompat.getColor(this, matches ? R.color.primary : R.color.text_secondary));
                        }

                        updateDateTimeText();
                    },
                    selectedCalendar.get(Calendar.YEAR),
                    selectedCalendar.get(Calendar.MONTH),
                    selectedCalendar.get(Calendar.DAY_OF_MONTH)
            );
            dialog.getDatePicker().setMinDate(now.getTimeInMillis() - 60000);
            dialog.getDatePicker().setMaxDate(maxDate.getTimeInMillis());
            dialog.show();
        });

        btnPickTime.setOnClickListener(v -> {
            TimePickerDialog dialog = new TimePickerDialog(
                    CreateReservationActivity.this,
                    (view, hourOfDay, minute) -> {
                        Calendar testCal = (Calendar) selectedCalendar.clone();
                        testCal.set(Calendar.HOUR_OF_DAY, hourOfDay);
                        testCal.set(Calendar.MINUTE, minute);
                        testCal.set(Calendar.SECOND, 0);

                        Calendar now = Calendar.getInstance();
                        if (isDateSelected && testCal.getTimeInMillis() < now.getTimeInMillis() - 600000) {
                            com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                                    this,
                                    "Past Time Slot",
                                    "SCHEDULE POLICY",
                                    "The selected time has already passed for today. Please select a future time.",
                                    "Adjust Time",
                                    null
                            );
                            isTimeSelected = false;
                            updateDateTimeText();
                            return;
                        }

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
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm (EEE)", Locale.getDefault());
        if (isDateSelected && isTimeSelected) {
            Calendar maxCal = Calendar.getInstance();
            maxCal.add(Calendar.DAY_OF_YEAR, 7);
            maxCal.set(Calendar.HOUR_OF_DAY, 23);
            maxCal.set(Calendar.MINUTE, 59);
            maxCal.set(Calendar.SECOND, 59);
            maxCal.set(Calendar.MILLISECOND, 999);

            if (selectedCalendar.after(maxCal)) {
                tvSelectedDateTime.setText("⚠ Invalid: Beyond 7-day horizon limit");
                tvSelectedDateTime.setTextColor(ContextCompat.getColor(this, R.color.danger));
            } else if (selectedCalendar.getTimeInMillis() < System.currentTimeMillis() - 600000) {
                tvSelectedDateTime.setText("⚠ Invalid: Time is in the past");
                tvSelectedDateTime.setTextColor(ContextCompat.getColor(this, R.color.danger));
            } else {
                tvSelectedDateTime.setText("✓ Valid Slot: " + sdf.format(selectedCalendar.getTime()) + " (Within 7 Days)");
                tvSelectedDateTime.setTextColor(ContextCompat.getColor(this, R.color.primary));
            }
        } else if (isDateSelected) {
            SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd (EEE)", Locale.getDefault());
            tvSelectedDateTime.setText("Date: " + df.format(selectedCalendar.getTime()) + " • Please choose a time");
            tvSelectedDateTime.setTextColor(ContextCompat.getColor(this, R.color.accent));
        } else {
            tvSelectedDateTime.setText("Scheduled: Tap a day chip or 'Select Date' & 'Select Time'");
            tvSelectedDateTime.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        }
    }

    private void setupSubmitListener() {
        btnConfirmBooking.setOnClickListener(v -> {
            if (!isDateSelected || !isTimeSelected) {
                Toast.makeText(this, "Please select both date and time (within 7 days).", Toast.LENGTH_SHORT).show();
                return;
            }

            long diffMillis = selectedCalendar.getTimeInMillis() - System.currentTimeMillis();
            if (diffMillis < -600000) { // more than 10 mins in past
                com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                        this,
                        "Invalid Appointment Time",
                        "SCHEDULE POLICY",
                        "Cannot schedule bookings in the past. Please select a future time slot within 7 days.",
                        "Adjust Time",
                        null
                );
                return;
            }

            Calendar maxAllowed = Calendar.getInstance();
            maxAllowed.add(Calendar.DAY_OF_YEAR, 7);
            maxAllowed.set(Calendar.HOUR_OF_DAY, 23);
            maxAllowed.set(Calendar.MINUTE, 59);
            maxAllowed.set(Calendar.SECOND, 59);
            maxAllowed.set(Calendar.MILLISECOND, 999);

            if (selectedCalendar.after(maxAllowed)) {
                com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                        this,
                        "7-Day Policy Violation",
                        "SCHEDULE LIMIT EXCEEDED",
                        "Trading reservations must be scheduled within 7 days from today. Please pick an appointment date within the next 7 days.",
                        "Adjust Date",
                        null
                );
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

            if (selectedStation.getCapacityKwh() > 0 && energy > selectedStation.getCapacityKwh()) {
                com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                        this,
                        "Capacity Limit Exceeded",
                        "STATION RATING",
                        "Requested energy quota (" + energy + " kWh) exceeds solar hub capacity (" + selectedStation.getCapacityKwh() + " kWh).",
                        "Reduce Quota",
                        null
                );
                return;
            }

            // Panel-size cap: a drop-off can't exceed one day of generation from the prosumer's panels
            double solarCapacityKw = currentUser != null ? currentUser.getSolarCapacityKw() : 0;
            double maxDropOffKwh = solarCapacityKw * PEAK_SUN_HOURS;
            if ("DropOff".equals(tradeType) && solarCapacityKw > 0 && energy > maxDropOffKwh) {
                com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                        this,
                        "Solar Capacity Limit",
                        "PANEL SIZE RULE",
                        String.format(Locale.US, "Your %s kW solar system produces about %.1f kWh per day, so a drop-off cannot exceed %.1f kWh.",
                                solarCapacityKw, maxDropOffKwh, maxDropOffKwh),
                        "Reduce Quota",
                        null
                );
                return;
            }

            if ("DropOff".equals(tradeType) && selectedStation.getAvailableBatterySlots() <= 0) {
                com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                        this,
                        "Station Battery Slots Full",
                        "PHYSICAL CAPACITY",
                        "Selected solar hub currently has 0 available battery slots for drop-off. Please choose Charging mode or select another station hub.",
                        "Change Hub / Mode",
                        null
                );
                return;
            }

            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
            isoFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            String scheduledIso = isoFormat.format(selectedCalendar.getTime());

            SimpleDateFormat localDisplayFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm (EEE)", Locale.getDefault());
            String localDisplayTime = localDisplayFormat.format(selectedCalendar.getTime());

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
                        java.util.List<com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem> details = new java.util.ArrayList<>();
                        details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("Station", selectedStation.getName()));
                        details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("Schedule Time", localDisplayTime));
                        details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("Energy Quota", energy + " kWh"));
                        details.add(new com.ead.solarmicrogrid.util.SolvanceDialog.DetailItem("Trading Mode", tradeType));

                        com.ead.solarmicrogrid.util.SolvanceDialog.showModal(
                                CreateReservationActivity.this,
                                com.ead.solarmicrogrid.util.SolvanceDialog.DialogType.SUCCESS,
                                "Reservation Submitted",
                                "AWAITING APPROVAL",
                                "Your power trading reservation is pending operator approval. The secure QR pass will appear after approval.",
                                details,
                                "After approval, your dynamic security QR will be available in the reservation details.",
                                "View Booking Details",
                                null,
                                false,
                                () -> {
                                    finish();
                                    overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
                                },
                                null
                        );
                    } else {
                        String errorMsg = "Booking rejected: Verify 7-day rule and account status.";
                        try {
                            if (response.errorBody() != null) {
                                String raw = response.errorBody().string();
                                try {
                                    org.json.JSONObject obj = new org.json.JSONObject(raw);
                                    if (obj.has("message")) errorMsg = obj.getString("message");
                                    else errorMsg = raw;
                                } catch (Exception ex) {
                                    if (!raw.isEmpty()) errorMsg = raw;
                                }
                            }
                        } catch (Exception ignored) {}

                        com.ead.solarmicrogrid.util.SolvanceDialog.showWarning(
                                CreateReservationActivity.this,
                                "Reservation Request Blocked",
                                "SCHEDULE RULE",
                                errorMsg,
                                "Review & Retry",
                                null
                        );
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