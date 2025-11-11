package com.example;

import java.io.FileInputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;

public class App {

    // Project Details 
    private static final String DATABASE_URL = "https://mindease-b9b6f-default-rtdb.firebaseio.com";
    private static final String SERVICE_ACCOUNT_PATH = "service-account.json";
    
    // Test User ID - UPDATED with your UID from the console
    private static final String TEST_UID = "nWZ2LMtJmRT32LBdhChUKc1l2hE2"; 

    public static void main(String[] args) {
        
        CountDownLatch initLatch = new CountDownLatch(1);

        // --- Initialization ---
        try {
            FileInputStream serviceAccount = new FileInputStream(SERVICE_ACCOUNT_PATH);

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setDatabaseUrl(DATABASE_URL)
                    .build();

            FirebaseApp.initializeApp(options);
            System.out.println("✅ Firebase Admin SDK initialized successfully.");
            initLatch.countDown();

        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("\n❌ FAILED to initialize Firebase Admin SDK.");
            initLatch.countDown();
            return; 
        }

        // Wait for initialization
        try {
            initLatch.await(5, TimeUnit.SECONDS); 
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Initialization interrupted.");
            return;
        }

        // --- Execute Operation using Switch Case ---
        String operation;
        
        if (args.length == 0) {
            // 🛑 FORCED OPERATION: No argument was passed on the command line.
            operation = "read"; // <<<--- Default to 'read' for easy testing
            
            System.out.println("\n--- FORCING Default Operation: " + operation.toUpperCase() + " on User: " + TEST_UID + " ---");
            System.out.println("To use other operations, run: mvn exec:java -Dexec.args=\"<operation>\"");
            
            // Note: We DO NOT 'return' here, we let the code flow to the switch below.
            
        } else {
            // Normal path: argument was provided (this should still work if you fix the syntax)
            operation = args[0].toLowerCase();
            System.out.println("\n--- Executing Operation: " + operation.toUpperCase() + " on User: " + TEST_UID + " ---");
        }

        switch (operation) {
            case "read":
                readUser(TEST_UID);
                break;
            case "create":
                // 1st argument (args[1]) is Name, 2nd (args[2]) is Email
                String cName = (args.length > 1) ? args[1] : "Default Created Name";
                String cEmail = (args.length > 2) ? args[2] : "default.created@example.com";
                
                System.out.println("Creating/Overwriting User with Name: " + cName + ", Email: " + cEmail);
                createOrUpdateUser(TEST_UID, cName, cEmail);
                break;
            case "update":
                String newName = (args.length > 1) ? args[1] : "Jane Doe (Updated by Java Admin)";
                updateUser(TEST_UID, newName);
                break;
            case "delete":
                deleteUser(TEST_UID);
                break;
            case "all":
                // Execute the full CRUD cycle
                readUser(TEST_UID);
                updateUser(TEST_UID, "Jane Doe (Full Cycle Update)");
                readUser(TEST_UID);
                deleteUser(TEST_UID); 
                break;
            default:
                System.out.println("❌ Invalid operation specified: " + operation);
                System.out.println("Available operations: read, create, update, delete, all");
        }

        System.out.println("\nApplication finished operation.");
    }

    // --- HELPER METHODS (Unchanged) ---

    public static void createOrUpdateUser(String uid, String name, String email) {
        FirebaseDatabase database = FirebaseDatabase.getInstance();
        DatabaseReference userRef = database.getReference("users").child(uid);

        Map<String, Object> userData = new HashMap<>();
        userData.put("name", name);
        userData.put("email", email);
        userData.put("createdAt", ServerValue.TIMESTAMP);

        CountDownLatch latch = new CountDownLatch(1);
        
        userRef.setValue(userData, (error, dbRef) -> {
            if (error != null) {
                System.err.println("❌ CREATE/UPDATE failed for " + uid + ": " + error.getMessage());
            } else {
                System.out.println("✅ User record saved/updated: " + uid);
            }
            latch.countDown();
        });

        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    public static void readUser(String uid) {
        FirebaseDatabase database = FirebaseDatabase.getInstance();
        DatabaseReference userRef = database.getReference("users").child(uid);
        
        CountDownLatch latch = new CountDownLatch(1);

        userRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot dataSnapshot) {
                if (dataSnapshot.exists()) {
                    String name = (String) dataSnapshot.child("name").getValue();
                    String email = (String) dataSnapshot.child("email").getValue();

                    System.out.println("\n--- User Data for " + uid + " ---");
                    System.out.println("Name: " + name);
                    System.out.println("Email: " + email);
                    System.out.println("--------------------------------");
                } else {
                    System.out.println("🔍 User not found: " + uid);
                }
                latch.countDown();
            }

            @Override
            public void onCancelled(DatabaseError error) {
                System.err.println("❌ READ failed: " + error.getMessage());
                latch.countDown();
            }
        });

        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public static void updateUser(String uid, String newName) {
        FirebaseDatabase database = FirebaseDatabase.getInstance();
        DatabaseReference userRef = database.getReference("users").child(uid);

        Map<String, Object> updates = new HashMap<>();
        updates.put("name", newName);
        updates.put("lastUpdated", ServerValue.TIMESTAMP); 

        CountDownLatch latch = new CountDownLatch(1);

        userRef.updateChildren(updates, (error, dbRef) -> {
            if (error != null) {
                System.err.println("❌ UPDATE failed for " + uid + ": " + error.getMessage());
            } else {
                System.out.println("✅ User " + uid + " updated (New Name: " + newName + ")");
            }
            latch.countDown();
        });

        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    public static void deleteUser(String uid) {
        FirebaseDatabase database = FirebaseDatabase.getInstance();
        DatabaseReference userRef = database.getReference("users").child(uid);

        CountDownLatch latch = new CountDownLatch(1);

        userRef.removeValue((error, dbRef) -> {
            if (error != null) {
                System.err.println("❌ DELETE failed for " + uid + ": " + error.getMessage());
            } else {
                System.out.println("✅ User " + uid + " deleted successfully.");
            }
            latch.countDown();
        });

        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}