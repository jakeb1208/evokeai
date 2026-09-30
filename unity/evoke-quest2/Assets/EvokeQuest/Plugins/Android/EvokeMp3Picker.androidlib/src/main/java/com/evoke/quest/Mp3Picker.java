package com.evoke.quest;

import android.content.Intent;
import android.app.Activity;
import android.content.Context;

/** Starts the Android Storage Access Framework MP3 picker from the Unity activity. */
public final class Mp3Picker {
    private static volatile int activeSessionGeneration = Integer.MIN_VALUE;

    private Mp3Picker() {}

    public static void open(String unityObjectName, int sessionGeneration) {
        try {
            Class<?> unityPlayer = Class.forName("com.unity3d.player.UnityPlayer");
            Object currentActivity = unityPlayer.getField("currentActivity").get(null);
            Context context = (Context) currentActivity;
            Intent intent = new Intent(context, Mp3PickerActivity.class);
            intent.putExtra("unityObjectName", unityObjectName);
            intent.putExtra("sessionGeneration", sessionGeneration);
            activeSessionGeneration = sessionGeneration;
            ((Activity) currentActivity).startActivity(intent);
        } catch (Exception error) {
            if (activeSessionGeneration == sessionGeneration)
                activeSessionGeneration = Integer.MIN_VALUE;
            throw new IllegalStateException("Could not open the Unity Android activity.", error);
        }
    }

    public static void invalidate() {
        activeSessionGeneration = Integer.MIN_VALUE;
    }

    public static boolean isCurrentSession(int sessionGeneration) {
        return activeSessionGeneration == sessionGeneration;
    }
}