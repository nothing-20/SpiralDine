package com.spiraldine.printbridge.data.local;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

/**
 * Persistent representation of a Kitchen Order Ticket print job in SQLite.
 *
 * Distinct Identification Design:
 * - Ordinary canonical KOTs use deterministic jobId: "PJ-{ticketId}"
 * - An intentional reprint uses distinct jobId: "PJ-{ticketId}-REPRINT-{reprintCount}"
 * This ensures ordinary duplicate events are safely ignored, while intentional reprints
 * are clearly distinguished and auditable without modifying canonical restaurant orders.
 */
@Entity(
    tableName = "print_jobs",
    indices = {
        @Index(value = {"ticketId"}),
        @Index(value = {"status"}),
        @Index(value = {"createdAt"})
    }
)
public class PrintJobEntity {

    @PrimaryKey
    @NonNull
    public String jobId;

    @NonNull
    public String ticketId;

    @NonNull
    public String orderId;

    @NonNull
    public String ticketNumber;

    @Nullable
    public String tableNumber;

    public int round;

    public boolean isSupplementary;

    public boolean isReprint;

    public int reprintCount;

    @NonNull
    public String payloadJson;

    @NonNull
    public String status; // PENDING, SENDING, PRINTED, FAILED

    public int retryCount;

    public long createdAt;

    @Nullable
    public Long lastAttemptAt;

    @Nullable
    public String lastError;

    public PrintJobEntity(
            @NonNull String jobId,
            @NonNull String ticketId,
            @NonNull String orderId,
            @NonNull String ticketNumber,
            @Nullable String tableNumber,
            int round,
            boolean isSupplementary,
            boolean isReprint,
            int reprintCount,
            @NonNull String payloadJson,
            @NonNull String status,
            int retryCount,
            long createdAt,
            @Nullable Long lastAttemptAt,
            @Nullable String lastError) {
        this.jobId = jobId;
        this.ticketId = ticketId;
        this.orderId = orderId;
        this.ticketNumber = ticketNumber;
        this.tableNumber = tableNumber;
        this.round = round;
        this.isSupplementary = isSupplementary;
        this.isReprint = isReprint;
        this.reprintCount = reprintCount;
        this.payloadJson = payloadJson;
        this.status = status;
        this.retryCount = retryCount;
        this.createdAt = createdAt;
        this.lastAttemptAt = lastAttemptAt;
        this.lastError = lastError;
    }
}
