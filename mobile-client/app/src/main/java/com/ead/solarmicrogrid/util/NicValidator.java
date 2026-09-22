// ============================================================================
// File: NicValidator.java
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Sri Lankan National Identity Card (NIC) algorithmic validator & demographic extractor.
// ============================================================================

package com.ead.solarmicrogrid.util;

import java.util.Calendar;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class NicValidator {

    private static final Pattern OLD_NIC_PATTERN = Pattern.compile("^([0-9]{2})([0-9]{3})([0-9]{4})([VvXx])$");
    private static final Pattern NEW_NIC_PATTERN = Pattern.compile("^([0-9]{4})([0-9]{3})([0-9]{5})$");

    public static class NicValidationResult {
        public final boolean isValid;
        public final String cleanNic;
        public final String format;
        public final int birthYear;
        public final String gender;
        public final int dayOfYear;
        public final int age;
        public final String summary;
        public final String error;

        public NicValidationResult(boolean isValid, String cleanNic, String format, int birthYear, String gender, int dayOfYear, int age, String summary, String error) {
            this.isValid = isValid;
            this.cleanNic = cleanNic;
            this.format = format;
            this.birthYear = birthYear;
            this.gender = gender;
            this.dayOfYear = dayOfYear;
            this.age = age;
            this.summary = summary;
            this.error = error;
        }

        public static NicValidationResult invalid(String error) {
            return new NicValidationResult(false, "", "", 0, "", 0, 0, "", error);
        }
    }

    public static NicValidationResult validate(String nicInput) {
        if (nicInput == null || nicInput.trim().isEmpty()) {
            return NicValidationResult.invalid("NIC cannot be empty");
        }

        String clean = nicInput.trim().toUpperCase();
        int currentYear = Calendar.getInstance().get(Calendar.YEAR);

        Matcher oldMatcher = OLD_NIC_PATTERN.matcher(clean);
        if (oldMatcher.matches()) {
            int yearShort = Integer.parseInt(oldMatcher.group(1));
            int birthYear = 1900 + yearShort;
            int dayCode = Integer.parseInt(oldMatcher.group(2));
            String suffix = oldMatcher.group(4);

            String gender = "Male";
            int dayOfYear = dayCode;
            if (dayCode > 500) {
                gender = "Female";
                dayOfYear = dayCode - 500;
            }

            if (dayOfYear < 1 || dayOfYear > 366) {
                return NicValidationResult.invalid("Invalid day-of-year in NIC (out of bounds).");
            }

            int age = currentYear - birthYear;
            String suffixDesc = "V".equalsIgnoreCase(suffix) ? "Voter" : "Non-Voter";
            String dobFormatted = calculateDob(birthYear, dayOfYear);
            String summary = String.format("✓ Valid Old NIC (%s) • %s • Born: %s (Age %d)", suffixDesc, gender, dobFormatted, age);

            return new NicValidationResult(true, clean, "Old 9-Digit Format", birthYear, gender, dayOfYear, age, summary, null);
        }

        Matcher newMatcher = NEW_NIC_PATTERN.matcher(clean);
        if (newMatcher.matches()) {
            int birthYear = Integer.parseInt(newMatcher.group(1));
            int dayCode = Integer.parseInt(newMatcher.group(2));

            if (birthYear < 1900 || birthYear > currentYear) {
                return NicValidationResult.invalid("Invalid birth year in NIC.");
            }

            String gender = "Male";
            int dayOfYear = dayCode;
            if (dayCode > 500) {
                gender = "Female";
                dayOfYear = dayCode - 500;
            }

            if (dayOfYear < 1 || dayOfYear > 366) {
                return NicValidationResult.invalid("Invalid day-of-year in NIC (out of bounds).");
            }

            int age = currentYear - birthYear;
            String dobFormatted = calculateDob(birthYear, dayOfYear);
            String summary = String.format("✓ Valid 12-Digit Digital NIC • %s • Born: %s (Age %d)", gender, dobFormatted, age);

            return new NicValidationResult(true, clean, "New 12-Digit Format", birthYear, gender, dayOfYear, age, summary, null);
        }

        return NicValidationResult.invalid("Invalid NIC format. Must be 9 digits with V/X or 12 digits.");
    }

    private static String calculateDob(int year, int dayOfYear) {
        int[] daysInMonths = { 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
        int month = 0;
        int remainingDays = dayOfYear;
        while (month < daysInMonths.length && remainingDays > daysInMonths[month]) {
            remainingDays -= daysInMonths[month];
            month++;
        }
        int monthNum = Math.min(month + 1, 12);
        int dayNum = Math.max(remainingDays, 1);
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", year, monthNum, dayNum);
    }
}
