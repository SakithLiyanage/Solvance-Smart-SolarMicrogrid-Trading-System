package com.ead.solarmicrogrid.ui.prosumer;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AnimationUtils;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.models.EnergyReservation;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class ReservationAdapter extends RecyclerView.Adapter<ReservationAdapter.ViewHolder> {

    private final Context context;
    private List<EnergyReservation> reservationList;

    public ReservationAdapter(Context context, List<EnergyReservation> reservationList) {
        this.context = context;
        this.reservationList = reservationList != null ? reservationList : new ArrayList<>();
    }

    public void updateData(List<EnergyReservation> newList) {
        this.reservationList = newList != null ? newList : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_reservation, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        EnergyReservation item = reservationList.get(position);

        holder.tvResNumber.setText(item.getReservationNumber() != null ? item.getReservationNumber() : "RES-00000000");
        holder.tvStationName.setText(item.getStationName() != null ? item.getStationName() : "Solar Station Hub");
        holder.tvScheduleTime.setText(item.getScheduledDateTime() != null ? item.getScheduledDateTime() : "-");
        holder.tvEnergyAmount.setText(String.format(Locale.US, "%.1f", item.getEnergyAmountKwh()));

        String tradeType = item.getTradeType() != null ? item.getTradeType() : "DropOff";
        boolean isDropOff = tradeType.equalsIgnoreCase("DropOff") || tradeType.toLowerCase().contains("sell");

        if (isDropOff) {
            holder.viewTradeIndicator.setBackgroundColor(ContextCompat.getColor(context, R.color.primary));
            holder.tvTradePill.setText("Drop-Off (Sell)");
            holder.tvTradePill.setTextColor(ContextCompat.getColor(context, R.color.primary));
            holder.ivEnergyIcon.setImageResource(R.drawable.ic_zap);
            holder.ivEnergyIcon.setColorFilter(ContextCompat.getColor(context, R.color.primary));
        } else {
            holder.viewTradeIndicator.setBackgroundColor(ContextCompat.getColor(context, R.color.accent));
            holder.tvTradePill.setText("Charging (Buy)");
            holder.tvTradePill.setTextColor(ContextCompat.getColor(context, R.color.accent));
            holder.ivEnergyIcon.setImageResource(R.drawable.ic_battery_charging);
            holder.ivEnergyIcon.setColorFilter(ContextCompat.getColor(context, R.color.accent));
        }

        String status = item.getStatus() != null ? item.getStatus() : "Pending";
        holder.tvStatusBadge.setText(status);
        applyStatusBadgeStyle(holder.tvStatusBadge, status);

        // Entrance micro-animation
        try {
            holder.itemView.startAnimation(AnimationUtils.loadAnimation(context, R.anim.item_animation_fall_down));
        } catch (Exception ignored) {}

        // Tap item opens reservation pass detail
        holder.itemView.setOnClickListener(v -> {
            Intent intent = new Intent(context, ReservationDetailActivity.class);
            intent.putExtra("id", item.getId());
            intent.putExtra("resNumber", item.getReservationNumber());
            intent.putExtra("stationName", item.getStationName());
            intent.putExtra("scheduled", item.getScheduledDateTime());
            intent.putExtra("kwh", item.getEnergyAmountKwh());
            intent.putExtra("tradeType", item.getTradeType());
            intent.putExtra("status", item.getStatus());
            intent.putExtra("qrToken", item.getQrCodeToken());
            context.startActivity(intent);

            if (context instanceof Activity) {
                ((Activity) context).overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
            }
        });
    }

    private void applyStatusBadgeStyle(TextView tvBadge, String status) {
        if ("Approved".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(context, R.drawable.bg_badge_approved));
            tvBadge.setTextColor(ContextCompat.getColor(context, R.color.badge_approved_text));
        } else if ("Pending".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(context, R.drawable.bg_badge_pending));
            tvBadge.setTextColor(ContextCompat.getColor(context, R.color.badge_pending_text));
        } else if ("Completed".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(context, R.drawable.bg_badge_completed));
            tvBadge.setTextColor(ContextCompat.getColor(context, R.color.badge_completed_text));
        } else if ("Cancelled".equalsIgnoreCase(status)) {
            tvBadge.setBackground(ContextCompat.getDrawable(context, R.drawable.bg_badge_cancelled));
            tvBadge.setTextColor(ContextCompat.getColor(context, R.color.badge_cancelled_text));
        } else {
            tvBadge.setBackground(ContextCompat.getDrawable(context, R.drawable.bg_badge_pending));
            tvBadge.setTextColor(ContextCompat.getColor(context, R.color.badge_pending_text));
        }
    }

    @Override
    public int getItemCount() {
        return reservationList.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        View viewTradeIndicator;
        TextView tvResNumber, tvTradePill, tvStatusBadge, tvStationName, tvScheduleTime, tvEnergyAmount;
        ImageView ivEnergyIcon;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            viewTradeIndicator = itemView.findViewById(R.id.viewTradeIndicator);
            tvResNumber = itemView.findViewById(R.id.tvResNumber);
            tvTradePill = itemView.findViewById(R.id.tvTradePill);
            tvStatusBadge = itemView.findViewById(R.id.tvStatusBadge);
            tvStationName = itemView.findViewById(R.id.tvStationName);
            tvScheduleTime = itemView.findViewById(R.id.tvScheduleTime);
            tvEnergyAmount = itemView.findViewById(R.id.tvEnergyAmount);
            ivEnergyIcon = itemView.findViewById(R.id.ivEnergyIcon);
        }
    }
}
