package com.evoke.quest;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import org.json.JSONObject;

/** SAF picker trampoline. Selected bytes are copied to app-private cache for Unity upload. */
public final class Mp3PickerActivity extends Activity {
    private static final int PICK_FILE = 7314;
    private static final long MAX_BYTES = 25L * 1024L * 1024L;
    private static final String STATE_UNITY_OBJECT = "unityObjectName";
    private static final String STATE_GENERATION = "sessionGeneration";
    private String unityObjectName;
    private int sessionGeneration;
    private boolean copying;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) {
            unityObjectName = state.getString(STATE_UNITY_OBJECT);
            sessionGeneration = state.getInt(STATE_GENERATION);
            return;
        }
        unityObjectName = getIntent().getStringExtra(STATE_UNITY_OBJECT);
        sessionGeneration = getIntent().getIntExtra(STATE_GENERATION, -1);
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("audio/mpeg");
        try {
            startActivityForResult(picker, PICK_FILE);
        } catch (Exception error) {
            sendError("Could not open the Android file picker.");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        state.putString(STATE_UNITY_OBJECT, unityObjectName);
        state.putInt(STATE_GENERATION, sessionGeneration);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILE || copying) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            JSONObject result = new JSONObject();
            try {
                result.put("status", "cancelled");
                result.put("session_generation", sessionGeneration);
            } catch (Exception ignored) {}
            finishWithPayload(result.toString());
            return;
        }
        if (!Mp3Picker.isCurrentSession(sessionGeneration)) {
            finish();
            return;
        }
        copying = true;
        final Uri uri = data.getData();
        new Thread(() -> copySelectedFile(uri), "EvokeMp3PickerCopy").start();
    }

    private void copySelectedFile(Uri uri) {
        File copy = null;
        try {
            String filename = displayName(uri);
            copy = new File(getCacheDir(), "evoke-mp3-" + System.currentTimeMillis() + ".mp3");
            InputStream input = getContentResolver().openInputStream(uri);
            if (input == null) throw new Exception("The selected file could not be opened.");
            byte[] buffer = new byte[32768];
            long total = 0;
            try (InputStream source = input; FileOutputStream output = new FileOutputStream(copy)) {
                int count;
                while ((count = source.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_BYTES) throw new Exception("MP3 uploads must be 25 MiB or smaller.");
                    output.write(buffer, 0, count);
                }
            }
            JSONObject result = new JSONObject();
            result.put("status", "selected");
            result.put("path", copy.getAbsolutePath());
            result.put("name", filename);
            result.put("session_generation", sessionGeneration);
            if (!Mp3Picker.isCurrentSession(sessionGeneration)) {
                copy.delete();
                runOnUiThread(this::finish);
                return;
            }
            finishWithPayload(result.toString());
        } catch (Exception error) {
            if (copy != null) copy.delete();
            sendError(error.getMessage() == null ? "Could not read the selected MP3." : error.getMessage());
        }
    }

    private String displayName(Uri uri) {
        Cursor cursor = getContentResolver().query(uri, null, null, null, null);
        if (cursor == null) return "music.mp3";
        try {
            int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
            if (column >= 0 && cursor.moveToFirst()) return cursor.getString(column);
        } finally {
            cursor.close();
        }
        return "music.mp3";
    }

    private void sendError(String message) {
        try {
            JSONObject result = new JSONObject();
            result.put("status", "error");
            result.put("error", message);
            result.put("session_generation", sessionGeneration);
            finishWithPayload(result.toString());
        } catch (Exception ignored) {
            finishWithPayload("{\"status\":\"error\",\"error\":\"Could not read the selected MP3.\"}");
        }
    }

    private void finishWithPayload(String payload) {
        runOnUiThread(() -> {
            send(payload);
            finish();
        });
    }

    private void send(String payload) {
        if (unityObjectName == null || unityObjectName.isEmpty()) {
            deletePayloadFile(payload);
            return;
        }
        try {
            Class<?> unityPlayer = Class.forName("com.unity3d.player.UnityPlayer");
            unityPlayer.getMethod("UnitySendMessage", String.class, String.class, String.class)
                .invoke(null, unityObjectName, "OnQuestMp3Picked", payload);
        } catch (Exception ignored) {
            // Unity may have exited while the Android picker was open.
            deletePayloadFile(payload);
        }
    }

    private void deletePayloadFile(String payload) {
        try {
            String stalePath = new JSONObject(payload).optString("path");
            if (!stalePath.isEmpty()) new File(stalePath).delete();
        } catch (Exception ignored) {}
    }
}