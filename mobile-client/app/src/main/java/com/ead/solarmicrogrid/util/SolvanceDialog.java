package com.ead.solarmicrogrid.util;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.DrawableRes;
import androidx.core.content.ContextCompat;

import com.ead.solarmicrogrid.R;
import com.google.android.material.button.MaterialButton;

import java.util.ArrayList;
import java.util.List;

/**
 * Modern, Glassmorphic Dialog Modal Utility for Solvance Smart Microgrid Platform.
 * Replaces standard Android AlertDialog with themed card modals, structured key-value chips,
 * and high-contrast accessibility compliant elements.
 *
 * Authors:
 *   - L.T. Jayawardhana (IT23156760) - Modal UI Architecture & Rule Dialogs
 *   - M.L. Booso (IT23452916) - e-KYC Verification & Auth Feedback Modals
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 */
public class SolvanceDialog {

    public static class DetailItem {
        public final String label;
        public final String value;

        public DetailItem(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    public enum DialogType {
        SUCCESS,
        WARNING,
        ERROR,
        INFO,
        KYC
    }

    public static void showKycSuccess(
            Context context,
            String fullName,
            String nic,
            String demographics,
            String solarKw,
            String inverterSerial,
            Runnable onGoToLogin
    ) {
        List<DetailItem> details = new ArrayList<>();
        if (fullName != null && !fullName.isEmpty()) details.add(new DetailItem("Full Name", fullName));
        details.add(new DetailItem("National ID (NIC)", nic));
        details.add(new DetailItem("Demographics", demographics));
        details.add(new DetailItem("Solar Array", solarKw + " kW"));
        details.add(new DetailItem("Inverter Serial", inverterSerial));

        showModal(
                context,
                DialogType.KYC,
                "e-KYC Prosumer Registered",
                "E-KYC VERIFICATION",
                "Your solar prosumer node registration has been submitted with Front/Back ID verification.",
                details,
                "Per enterprise compliance, account status is 'Pending' awaiting Backoffice review.",
                "Go to Login",
                null,
                false,
                onGoToLogin,
                null
        );
    }

    public static void showSuccess(
            Context context,
            String title,
            String badge,
            String message,
            List<DetailItem> details,
            String buttonText,
            Runnable onConfirm
    ) {
        showModal(
                context,
                DialogType.SUCCESS,
                title,
                badge != null ? badge : "SUCCESS",
                message,
                details,
                null,
                buttonText != null ? buttonText : "OK",
                null,
                true,
                onConfirm,
                null
        );
    }

    public static void showWarning(
            Context context,
            String title,
            String badge,
            String message,
            String buttonText,
            Runnable onConfirm
    ) {
        showModal(
                context,
                DialogType.WARNING,
                title,
                badge != null ? badge : "NOTICE",
                message,
                null,
                null,
                buttonText != null ? buttonText : "Understood",
                null,
                true,
                onConfirm,
                null
        );
    }

    public static void showError(
            Context context,
            String title,
            String message,
            String buttonText,
            Runnable onConfirm
    ) {
        showModal(
                context,
                DialogType.ERROR,
                title,
                "SYSTEM ERROR",
                message,
                null,
                null,
                buttonText != null ? buttonText : "Close",
                null,
                true,
                onConfirm,
                null
        );
    }

    public static void showInfo(
            Context context,
            String title,
            String badge,
            String message,
            String buttonText,
            Runnable onConfirm
    ) {
        showModal(
                context,
                DialogType.INFO,
                title,
                badge != null ? badge : "INFORMATION",
                message,
                null,
                null,
                buttonText != null ? buttonText : "OK",
                null,
                true,
                onConfirm,
                null
        );
    }

    public static void showConfirm(
            Context context,
            String title,
            String badge,
            String message,
            String confirmText,
            String cancelText,
            Runnable onConfirm,
            Runnable onCancel
    ) {
        showModal(
                context,
                DialogType.WARNING,
                title,
                badge != null ? badge : "CONFIRMATION",
                message,
                null,
                null,
                confirmText != null ? confirmText : "Confirm",
                cancelText != null ? cancelText : "Cancel",
                true,
                onConfirm,
                onCancel
        );
    }

    public static void showModal(
            Context context,
            DialogType type,
            String title,
            String badge,
            String message,
            List<DetailItem> details,
            String footnote,
            String primaryButtonText,
            String secondaryButtonText,
            boolean cancelable,
            Runnable onPrimaryAction,
            Runnable onSecondaryAction
    ) {
        if (context == null) return;

        Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        View view = LayoutInflater.from(context).inflate(R.layout.dialog_solvance_modal, null);
        dialog.setContentView(view);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            window.setLayout(
                    (int) (context.getResources().getDisplayMetrics().widthPixels * 0.92),
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            );
        }

        dialog.setCancelable(cancelable);

        FrameLayout layoutIconContainer = view.findViewById(R.id.layoutIconContainer);
        ImageView ivModalIcon = view.findViewById(R.id.ivModalIcon);
        TextView tvModalBadge = view.findViewById(R.id.tvModalBadge);
        TextView tvModalTitle = view.findViewById(R.id.tvModalTitle);
        TextView tvModalMessage = view.findViewById(R.id.tvModalMessage);
        View layoutDetailsCard = view.findViewById(R.id.layoutDetailsCard);
        LinearLayout layoutDetailsContainer = view.findViewById(R.id.layoutDetailsContainer);
        TextView tvModalFootnote = view.findViewById(R.id.tvModalFootnote);
        MaterialButton btnModalPrimary = view.findViewById(R.id.btnModalPrimary);
        MaterialButton btnModalSecondary = view.findViewById(R.id.btnModalSecondary);

        // Configure Icon & Styling according to DialogType
        int iconRes = R.drawable.ic_shield_check;
        int circleBgRes = R.drawable.bg_icon_circle_emerald;
        int tintColor = ContextCompat.getColor(context, R.color.accent);

        switch (type) {
            case KYC:
                iconRes = R.drawable.ic_shield_check;
                circleBgRes = R.drawable.bg_icon_circle_solar;
                tintColor = ContextCompat.getColor(context, R.color.primary);
                break;
            case SUCCESS:
                iconRes = R.drawable.ic_check_circle;
                circleBgRes = R.drawable.bg_icon_circle_emerald;
                tintColor = ContextCompat.getColor(context, R.color.accent);
                break;
            case WARNING:
                iconRes = R.drawable.ic_alert_circle;
                circleBgRes = R.drawable.bg_icon_circle_solar;
                tintColor = ContextCompat.getColor(context, R.color.primary);
                break;
            case ERROR:
                iconRes = R.drawable.ic_alert_circle;
                circleBgRes = R.drawable.bg_icon_circle_purple;
                tintColor = ContextCompat.getColor(context, R.color.danger);
                break;
            case INFO:
            default:
                iconRes = R.drawable.ic_info;
                circleBgRes = R.drawable.bg_icon_circle_cyan;
                tintColor = ContextCompat.getColor(context, R.color.cyan_accent);
                break;
        }

        layoutIconContainer.setBackgroundResource(circleBgRes);
        ivModalIcon.setImageResource(iconRes);
        ivModalIcon.setColorFilter(tintColor);

        // Badge
        if (badge != null && !badge.isEmpty()) {
            tvModalBadge.setText(badge);
            tvModalBadge.setVisibility(View.VISIBLE);
        } else {
            tvModalBadge.setVisibility(View.GONE);
        }

        // Title & Message
        tvModalTitle.setText(title);
        tvModalMessage.setText(message);

        // Details breakdown
        if (details != null && !details.isEmpty()) {
            layoutDetailsCard.setVisibility(View.VISIBLE);
            layoutDetailsContainer.removeAllViews();
            LayoutInflater inflater = LayoutInflater.from(context);
            for (DetailItem item : details) {
                View row = inflater.inflate(R.layout.item_dialog_detail_row, layoutDetailsContainer, false);
                TextView tvLabel = row.findViewById(R.id.tvDetailLabel);
                TextView tvVal = row.findViewById(R.id.tvDetailValue);
                tvLabel.setText(item.label);
                tvVal.setText(item.value);
                layoutDetailsContainer.addView(row);
            }
        } else {
            layoutDetailsCard.setVisibility(View.GONE);
        }

        // Footnote
        if (footnote != null && !footnote.isEmpty()) {
            tvModalFootnote.setText(footnote);
            tvModalFootnote.setVisibility(View.VISIBLE);
        } else {
            tvModalFootnote.setVisibility(View.GONE);
        }

        // Primary Button
        btnModalPrimary.setText(primaryButtonText != null ? primaryButtonText : "OK");
        btnModalPrimary.setOnClickListener(v -> {
            dialog.dismiss();
            if (onPrimaryAction != null) {
                onPrimaryAction.run();
            }
        });

        // Secondary Button
        if (secondaryButtonText != null && !secondaryButtonText.isEmpty()) {
            btnModalSecondary.setText(secondaryButtonText);
            btnModalSecondary.setVisibility(View.VISIBLE);
            btnModalSecondary.setOnClickListener(v -> {
                dialog.dismiss();
                if (onSecondaryAction != null) {
                    onSecondaryAction.run();
                }
            });
        } else {
            btnModalSecondary.setVisibility(View.GONE);
        }

        dialog.show();
    }
}
