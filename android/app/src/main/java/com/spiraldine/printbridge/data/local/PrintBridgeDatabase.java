package com.spiraldine.printbridge.data.local;

import android.content.Context;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

/**
 * Persistent SQLite Database for SpiralDine Android Print Bridge.
 */
@Database(
    entities = {PrintJobEntity.class},
    version = 1,
    exportSchema = false
)
public abstract class PrintBridgeDatabase extends RoomDatabase {

    private static volatile PrintBridgeDatabase INSTANCE;

    public abstract PrintJobDao printJobDao();

    public static PrintBridgeDatabase getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (PrintBridgeDatabase.class) {
                if (INSTANCE == null) {
                    INSTANCE = Room.databaseBuilder(
                            context.getApplicationContext(),
                            PrintBridgeDatabase.class,
                            "spiraldine_print_queue.db"
                    ).fallbackToDestructiveMigration().build();
                }
            }
        }
        return INSTANCE;
    }
}
