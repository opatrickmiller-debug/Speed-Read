# Android Auto Speed Alert App - Architecture Guide

## Overview

This document provides the architecture and implementation guide for building a native Android Auto version of the Speed Alert app.

## Requirements

### Development Environment
- Android Studio Hedgehog (2023.1.1) or newer
- Kotlin 1.9+
- Min SDK: API 23 (Android 6.0)
- Target SDK: API 34 (Android 14)
- Car App Library: `androidx.car.app:app:1.4.0`

### Google Play Requirements
- Navigation app category requires **Google approval**
- Must comply with Driver Distraction Guidelines
- Need to submit for review via Play Console

---

## Project Structure

```
speed-alert-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/speedalert/
│   │   │   ├── SpeedAlertApplication.kt
│   │   │   ├── car/
│   │   │   │   ├── SpeedAlertCarAppService.kt
│   │   │   │   ├── SpeedAlertSession.kt
│   │   │   │   ├── screens/
│   │   │   │   │   ├── MainScreen.kt
│   │   │   │   │   ├── SettingsScreen.kt
│   │   │   │   │   └── TripHistoryScreen.kt
│   │   │   │   └── templates/
│   │   │   │       └── SpeedAlertTemplate.kt
│   │   │   ├── service/
│   │   │   │   ├── LocationService.kt
│   │   │   │   ├── SpeedLimitService.kt
│   │   │   │   └── AlertService.kt
│   │   │   ├── data/
│   │   │   │   ├── repository/
│   │   │   │   ├── api/
│   │   │   │   └── local/
│   │   │   └── di/
│   │   │       └── AppModule.kt
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── automotive/  (For native automotive builds)
└── build.gradle.kts
```

---

## Key Implementation Files

### 1. AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Required permissions -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <!-- Car app features -->
    <uses-feature
        android:name="android.hardware.type.automotive"
        android:required="false" />

    <application
        android:name=".SpeedAlertApplication"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.SpeedAlert">

        <!-- Car App Service -->
        <service
            android:name=".car.SpeedAlertCarAppService"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.car.app.CarAppService" />
                <category android:name="androidx.car.app.category.NAVIGATION" />
            </intent-filter>
        </service>

        <!-- Main Activity (Phone) -->
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Location Service -->
        <service
            android:name=".service.LocationService"
            android:foregroundServiceType="location"
            android:exported="false" />

    </application>
</manifest>
```

### 2. SpeedAlertCarAppService.kt

```kotlin
package com.speedalert.car

import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

class SpeedAlertCarAppService : CarAppService() {

    override fun createHostValidator(): HostValidator {
        // Allow all hosts for development, restrict in production
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
    }

    override fun onCreateSession(): Session {
        return SpeedAlertSession()
    }
}
```

### 3. SpeedAlertSession.kt

```kotlin
package com.speedalert.car

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session
import com.speedalert.car.screens.MainScreen

class SpeedAlertSession : Session() {

    override fun onCreateScreen(intent: Intent): Screen {
        return MainScreen(carContext)
    }
}
```

### 4. MainScreen.kt (Core Speed Display)

```kotlin
package com.speedalert.car.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.speedalert.service.LocationService
import com.speedalert.service.SpeedLimitService

class MainScreen(carContext: CarContext) : Screen(carContext) {

    private var currentSpeed: Int = 0
    private var speedLimit: Int? = null
    private var isSpeeding: Boolean = false
    private var roadName: String = "Unknown Road"

    private val locationService = LocationService(carContext)
    private val speedLimitService = SpeedLimitService()

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                startLocationUpdates()
            }

            override fun onStop(owner: LifecycleOwner) {
                stopLocationUpdates()
            }
        })
    }

    private fun startLocationUpdates() {
        locationService.startUpdates { location, speed ->
            currentSpeed = speed.toInt()
            
            // Fetch speed limit
            speedLimitService.getSpeedLimit(location.latitude, location.longitude) { limit, road ->
                speedLimit = limit
                roadName = road ?: "Unknown Road"
                isSpeeding = limit != null && currentSpeed > limit
                
                // Trigger alert if speeding
                if (isSpeeding) {
                    triggerAlert()
                }
                
                invalidate() // Refresh UI
            }
        }
    }

    private fun stopLocationUpdates() {
        locationService.stopUpdates()
    }

    private fun triggerAlert() {
        // Vibrate and play sound
        AlertService.triggerSpeedAlert(carContext)
    }

    override fun onGetTemplate(): Template {
        val speedText = "$currentSpeed"
        val unitText = "MPH"
        val limitText = speedLimit?.let { "LIMIT: $it" } ?: "NO DATA"

        // Build the navigation template
        val builder = NavigationTemplate.Builder()
            .setNavigationInfo(
                NavigationTemplate.NavigationInfo.Builder()
                    .setCurrentStep(
                        Step.Builder("Speed Alert Active")
                            .setRoad(roadName)
                            .build(),
                        Distance.create(0.0, Distance.UNIT_MILES)
                    )
                    .build()
            )

        // Add action strip
        builder.setActionStrip(
            ActionStrip.Builder()
                .addAction(
                    Action.Builder()
                        .setTitle("Settings")
                        .setOnClickListener {
                            screenManager.push(SettingsScreen(carContext))
                        }
                        .build()
                )
                .addAction(
                    Action.Builder()
                        .setTitle("Trips")
                        .setOnClickListener {
                            screenManager.push(TripHistoryScreen(carContext))
                        }
                        .build()
                )
                .build()
        )

        // Set background color based on speeding status
        if (isSpeeding) {
            builder.setBackgroundColor(CarColor.createCustom(0xFFEF4444.toInt(), 0xFFEF4444.toInt()))
        }

        return builder.build()
    }
}
```

### 5. SpeedLimitService.kt

```kotlin
package com.speedalert.service

import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

class SpeedLimitService {
    
    private val client = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO)
    
    // Your backend API URL
    private val baseUrl = "https://your-backend-url.com/api"

    fun getSpeedLimit(
        lat: Double, 
        lon: Double, 
        callback: (Int?, String?) -> Unit
    ) {
        scope.launch {
            try {
                val request = Request.Builder()
                    .url("$baseUrl/speed-limit?lat=$lat&lon=$lon")
                    .build()

                val response = client.newCall(request).execute()
                val json = JSONObject(response.body?.string() ?: "{}")
                
                val speedLimit = if (json.isNull("speed_limit")) null else json.getInt("speed_limit")
                val roadName = if (json.isNull("road_name")) null else json.getString("road_name")
                
                withContext(Dispatchers.Main) {
                    callback(speedLimit, roadName)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    callback(null, null)
                }
            }
        }
    }
}
```

### 6. AlertService.kt

```kotlin
package com.speedalert.service

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import java.util.*

object AlertService {
    
    private var tts: TextToSpeech? = null
    private var lastAlertTime = 0L
    private const val ALERT_COOLDOWN_MS = 10000 // 10 seconds

    fun initialize(context: Context) {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
            }
        }
    }

    fun triggerSpeedAlert(context: Context) {
        val now = System.currentTimeMillis()
        if (now - lastAlertTime < ALERT_COOLDOWN_MS) return
        lastAlertTime = now

        // Vibrate
        vibrate(context)

        // Play tone
        playAlertTone()

        // Speak warning
        speak("Speed Alert. You are exceeding the speed limit.")
    }

    private fun vibrate(context: Context) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(500)
        }
    }

    private fun playAlertTone() {
        try {
            val toneGen = ToneGenerator(AudioManager.STREAM_ALARM, 100)
            toneGen.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 500)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun speak(text: String) {
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "speed_alert")
    }

    fun shutdown() {
        tts?.shutdown()
        tts = null
    }
}
```

---

## build.gradle.kts (App Module)

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    kotlin("kapt")
}

android {
    namespace = "com.speedalert"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.speedalert"
        minSdk = 23
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    // Car App Library
    implementation("androidx.car.app:app:1.4.0")
    
    // Location
    implementation("com.google.android.gms:play-services-location:21.0.1")
    
    // Networking
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    
    // DI
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")
    
    // Room (for local trip storage)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
}
```

---

## Android Auto UI Constraints

### Allowed Templates for Navigation Apps:
1. `NavigationTemplate` - Main driving view ✅
2. `PlaceListNavigationTemplate` - List of places
3. `RoutePreviewNavigationTemplate` - Route selection
4. `MapTemplate` - Custom map view (requires approval)

### NOT Allowed:
- Custom layouts
- Complex animations
- Small text
- Distracting elements

### Driver Distraction Guidelines:
- Max 6 items in lists
- Max 2 lines of text per item
- Touch targets min 76dp
- No video or complex graphics
- Actions must complete in <2 seconds

---

## Testing Android Auto

### 1. Desktop Head Unit (DHU)
```bash
# Install DHU from Android SDK
sdkmanager "extras;google;auto"

# Run DHU
cd $ANDROID_HOME/extras/google/auto
./desktop-head-unit
```

### 2. Connect Phone
```bash
adb forward tcp:5277 tcp:5277
```

### 3. Test on Real Car
- Enable Developer Mode on phone
- Connect via USB/Android Auto Wireless
- App appears in car display

---

## Submission to Google Play

### Requirements for Navigation Apps:
1. **Google Form Submission**: Apply at [Android Auto Navigation Access](https://docs.google.com/forms/d/e/1FAIpQLSf5pE3sLkwL1hFQlgwPBsEKasFqJDypmKU-pu5mxmvxnFxQAQ/viewform)
2. **Video Demo**: Show app working in DHU
3. **Privacy Policy**: Required
4. **Testing**: Thorough testing on multiple car head units

### Review Timeline:
- Initial review: 2-4 weeks
- May require multiple iterations

---

## Migration Path from Web App

### Data Sync Strategy:
1. Use same backend API (`/api/trips/*`, `/api/speed-limit`)
2. Share authentication (JWT tokens)
3. Sync trip data between web and Android

### Shared Components:
- Speed limit API (OpenStreetMap)
- Trip storage (MongoDB backend)
- User authentication

---

## Resources

- [Android for Cars Documentation](https://developer.android.com/training/cars)
- [Car App Library Reference](https://developer.android.com/reference/androidx/car/app/package-summary)
- [Navigation App Design Guidelines](https://developer.android.com/training/cars/apps/navigation)
- [Desktop Head Unit Guide](https://developer.android.com/training/cars/testing)

---

## Timeline Estimate

| Phase | Tasks | Duration |
|-------|-------|----------|
| Setup | Project structure, dependencies | 1 week |
| Core | Speed tracking, alerts | 2 weeks |
| UI | Car templates, phone app | 2 weeks |
| Integration | Backend sync, auth | 1 week |
| Testing | DHU, real cars | 2 weeks |
| Submission | Google review process | 2-4 weeks |

**Total: 10-12 weeks** for full Android Auto support
