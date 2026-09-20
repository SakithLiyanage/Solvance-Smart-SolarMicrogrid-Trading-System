package com.ead.solarmicrogrid.ui.operator;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.ead.solarmicrogrid.R;
import com.ead.solarmicrogrid.data.models.EnergyReservation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class OperatorReservationAdapter extends RecyclerView.Adapter<OperatorReservationAdapter.ViewHolder> {

    public interface OnOperatorActionListener {
        void onVerify(EnergyReservation reservation);
        void onCancel(EnergyReservation reservation);
    }

    private final Context context;
    private List<EnergyReservation> fullList = new ArrayList<>();
    private List<EnergyReservation> displayList = new ArrayList<>();
    private final OnOperatorActionListener listener;

    private String currentSearch = "";
    private String currentStatusFilter = "All";

    public OperatorReservationAdapter(Context context, OnOperatorActionListener listener) {
        this.context = context;
        this.listener = listener;
    }

    public void setData(List<EnergyReservation> list) {
        this.fullList = list != null ? new ArrayList<>(list) : new ArrayList<>();
        applyFilter();
    }

    public void filter(String search, String status) {
        this.currentSearch = search != null ? search.toLowerCase().trim() : "";
        this.currentStatusFilter = status != null ? status : "All";
        applyFilter();
    }

    private void applyFilter() {
        displayList.clear();
        for (EnergyReservation item : fullList) {
            boolean matchesStatus = "All".equalsIgnoreCase(currentStatusFilter) ||
                    (item.getStatus() != null && item.getStatus().equalsIgnoreCase(currentStatusFilter));

            boolean matchesSearch = currentSearch.isEmpty() ||
                    (item.getReservationNumber() != null && item.getReservationNumber().toLowerCase().contains(currentSearch)) ||
                    (item.getProsumerNic() != null && item.getProsumerNic().toLowerCase().contains(currentSearch)) ||
                    (item.getStationName() != null && item.getStationName().toLowerCase().contains(currentSearch));

            if (matchesStatus && matchesSearch) {
                displayList.add(item);
            }
        }

        // Sort: Active queue items (Pending/Approved) first
        Collections.sort(displayList, (a, b) -> {
            boolean aActive = "Approved".equalsIgnoreCase(a.getStatus()) || "Pending".equalsIgnoreCase(a.getStatus());
            boolean bActive = "Approved".equalsIgnoreCase(b.getStatus()) || "Pending".equalsIgnoreCase(b.getStatus());
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return 0;
        });

        notifyDataSetChanged();
    }

    public int getFilteredCount() {
        return displayList.size();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_operator_reservation, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        EnergyReservation item = displayList.get(position);

        holder.tvOperatorResNumber.setText(item.getReservationNumber() != null ? item.getReservationNumber() : "RES-???");
        holder.tvOperatorProsumerNic.setText(item.getProsumerNic() != null ? item.getProsumerNic() : "N/A");
        holder.tvOperatorStation.setText(item.getStationName() != null ? item.getStationName() : "Solar Hub Station");
        holder.tvOperatorSchedule.setText(item.getScheduledDateTime() != null ? item.getScheduledDateTime() : "--:--");
        holder.tvOperatorEnergy.setText(item.getEnergyAmountKwh() + " kWh");

        String tradeType = item.getTradeType() != null ? item.getTradeType() : "Trade";
        holder.tvOperatorTradeType.setText(tradeType);

        String status = item.getStatus() != null ? item.getStatus() : "Pending";
        holder.tvOperatorStatusBadge.setText(status);
        applyStatusBadgeStyle(holder.tvOperatorStatusBadge, status);

        // Actions visibility
        if ("Pending".equalsIgnoreCase(status) || "Approved".equalsIgnoreCase(status)) {
            holder.layoutOperatorActions.setVisibility(View.VISIBLE);
            holder.tvOperatorResolvedMsg.setVisibility(View.GONE);

            holder.btnCardVerify.setOnClickListener(v -> {
                if (listener != null) listener.onVerify(item);
            });

            holder.btnCardCancel.setOnClickListener(v -> {
                if (listener != null) listener.onCancel(item);
            });
        } else {
            holder.layoutOperatorActions.setVisibility(View.GONE);
            holder.tvOperatorResolvedMsg.setVisibility(View.VISIBLE);
            if ("Completed".equalsIgnoreCase(status)) {
                holder.tvOperatorResolvedMsg.setText("Transaction Verified & Grid Synchronized");
                holder.tvOperatorResolvedMsg.setTextColor(ContextCompat.getColor(context, R.color.accent));
            } else {
                String reason = item.getCancellationReason() != null ? item.getCancellationReason() : "Cancelled";
                holder.tvOperatorResolvedMsg.setText("Cancelled: " + reason);
                holder.tvOperatorResolvedMsg.setTextColor(ContextCompat.getColor(context, R.color.text_muted));
            }
        }
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
        return displayList.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOperatorResNumber, tvOperatorTradeType, tvOperatorStatusBadge;
        TextView tvOperatorProsumerNic, tvOperatorStation, tvOperatorSchedule, tvOperatorEnergy;
        LinearLayout layoutOperatorActions;
        Button btnCardVerify, btnCardCancel;
        TextView tvOperatorResolvedMsg;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOperatorResNumber = itemView.findViewById(R.id.tvOperatorResNumber);
            tvOperatorTradeType = itemView.findViewById(R.id.tvOperatorTradeType);
            tvOperatorStatusBadge = itemView.findViewById(R.id.tvOperatorStatusBadge);
            tvOperatorProsumerNic = itemView.findViewById(R.id.tvOperatorProsumerNic);
            tvOperatorStation = itemView.findViewById(R.id.tvOperatorStation);
            tvOperatorSchedule = itemView.findViewById(R.id.tvOperatorSchedule);
            tvOperatorEnergy = itemView.findViewById(R.id.tvOperatorEnergy);
            layoutOperatorActions = itemView.findViewById(R.id.layoutOperatorActions);
            btnCardVerify = itemView.findViewById(R.id.btnCardVerify);
            btnCardCancel = itemView.findViewById(R.id.btnCardCancel);
            tvOperatorResolvedMsg = itemView.findViewById(R.id.tvOperatorResolvedMsg);
        }
    }
}
