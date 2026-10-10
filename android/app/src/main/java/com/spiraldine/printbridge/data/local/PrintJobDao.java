package com.spiraldine.printbridge.data.local;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import java.util.List;

/**
 * Data Access Object for local persistent print queue jobs.
 */
@Dao
public interface PrintJobDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insertJob(PrintJobEntity job);

    @Query("SELECT * FROM print_jobs WHERE jobId = :jobId LIMIT 1")
    PrintJobEntity getJobById(String jobId);

    @Query("SELECT * FROM print_jobs WHERE ticketId = :ticketId ORDER BY createdAt DESC")
    List<PrintJobEntity> getJobsByTicketId(String ticketId);

    @Query("SELECT * FROM print_jobs WHERE status = 'PENDING' ORDER BY createdAt ASC")
    List<PrintJobEntity> getPendingJobs();

    @Query("UPDATE print_jobs SET status = :status, lastAttemptAt = :lastAttemptAt, lastError = :lastError WHERE jobId = :jobId")
    int updateJobStatus(String jobId, String status, Long lastAttemptAt, String lastError);

    @Query("UPDATE print_jobs SET retryCount = retryCount + 1, lastAttemptAt = :lastAttemptAt, lastError = :lastError, status = 'PENDING' WHERE jobId = :jobId")
    int incrementRetry(String jobId, Long lastAttemptAt, String lastError);

    @Query("SELECT * FROM print_jobs ORDER BY createdAt DESC LIMIT :limit")
    List<PrintJobEntity> getRecentHistory(int limit);

    @Query("SELECT COUNT(*) FROM print_jobs WHERE status = 'PENDING'")
    int countPendingJobs();

    @Query("SELECT COUNT(*) FROM print_jobs WHERE status = 'PRINTED'")
    int countPrintedJobs();
}
