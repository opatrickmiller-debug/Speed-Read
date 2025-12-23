# Apple CarPlay Speed Alert App - Architecture Guide

## Overview

This document provides the architecture and implementation guide for building a native iOS CarPlay version of the Speed Alert app.

## Requirements

### Development Environment
- Xcode 15+ 
- Swift 5.9+
- iOS Deployment Target: iOS 14.0+
- CarPlay Framework
- Apple Developer Program membership ($99/year)

### Apple Requirements
- **CarPlay Entitlement Required**: Must apply via Apple Developer portal
- Navigation apps require `com.apple.developer.carplay-navigation` entitlement
- Must comply with Human Interface Guidelines for CarPlay
- App Review may take 1-2 weeks

---

## Entitlement Application Process

### Step 1: Apply for CarPlay Entitlement
1. Go to [Apple CarPlay Entitlement Request](https://developer.apple.com/contact/carplay/)
2. Fill out the form with:
   - App description
   - App category (Navigation)
   - Expected release date
   - Company information
3. Wait for approval (typically 1-2 weeks)

### Step 2: Add Entitlement to App
Once approved, add to your `Entitlements.plist`:
```xml
<key>com.apple.developer.carplay-navigation</key>
<true/>
```

---

## Project Structure

```
SpeedAlert-iOS/
├── SpeedAlert/
│   ├── App/
│   │   ├── SpeedAlertApp.swift
│   │   ├── AppDelegate.swift
│   │   └── SceneDelegate.swift
│   ├── CarPlay/
│   │   ├── CarPlaySceneDelegate.swift
│   │   ├── SpeedAlertCarPlayManager.swift
│   │   ├── Templates/
│   │   │   ├── SpeedDashboardTemplate.swift
│   │   │   ├── SettingsTemplate.swift
│   │   │   └── TripHistoryTemplate.swift
│   │   └── Controllers/
│   │       └── NavigationController.swift
│   ├── Services/
│   │   ├── LocationService.swift
│   │   ├── SpeedLimitService.swift
│   │   ├── AlertService.swift
│   │   └── APIClient.swift
│   ├── Models/
│   │   ├── SpeedLimit.swift
│   │   ├── Trip.swift
│   │   └── User.swift
│   ├── Views/
│   │   └── (SwiftUI views for iPhone)
│   └── Resources/
│       ├── Assets.xcassets
│       └── Localizable.strings
├── SpeedAlert.entitlements
├── Info.plist
└── SpeedAlert.xcodeproj
```

---

## Key Implementation Files

### 1. Info.plist Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Transport Security -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <false/>
    </dict>
    
    <!-- Location Usage -->
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>SpeedAlert needs your location to monitor your speed and fetch speed limits.</string>
    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>SpeedAlert needs background location access to alert you while driving.</string>
    
    <!-- Background Modes -->
    <key>UIBackgroundModes</key>
    <array>
        <string>audio</string>
        <string>location</string>
    </array>
    
    <!-- CarPlay Scene Configuration -->
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <true/>
        <key>UISceneConfigurations</key>
        <dict>
            <!-- iPhone Scene -->
            <key>UIWindowSceneSessionRoleApplication</key>
            <array>
                <dict>
                    <key>UISceneConfigurationName</key>
                    <string>Default Configuration</string>
                    <key>UISceneDelegateClassName</key>
                    <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
                </dict>
            </array>
            <!-- CarPlay Scene -->
            <key>CPTemplateApplicationSceneSessionRoleApplication</key>
            <array>
                <dict>
                    <key>UISceneConfigurationName</key>
                    <string>CarPlay Configuration</string>
                    <key>UISceneDelegateClassName</key>
                    <string>$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate</string>
                </dict>
            </array>
        </dict>
    </dict>
</dict>
</plist>
```

### 2. CarPlaySceneDelegate.swift

```swift
import CarPlay
import UIKit

class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    
    var interfaceController: CPInterfaceController?
    private var carPlayManager: SpeedAlertCarPlayManager?
    
    // MARK: - CPTemplateApplicationSceneDelegate
    
    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        
        // Initialize CarPlay manager
        carPlayManager = SpeedAlertCarPlayManager(interfaceController: interfaceController)
        carPlayManager?.start()
        
        print("CarPlay connected")
    }
    
    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        self.interfaceController = nil
        carPlayManager?.stop()
        carPlayManager = nil
        
        print("CarPlay disconnected")
    }
}
```

### 3. SpeedAlertCarPlayManager.swift

```swift
import CarPlay
import CoreLocation
import Combine

class SpeedAlertCarPlayManager: NSObject {
    
    private let interfaceController: CPInterfaceController
    private let locationService = LocationService.shared
    private let speedLimitService = SpeedLimitService()
    private let alertService = AlertService.shared
    
    private var cancellables = Set<AnyCancellable>()
    
    // State
    private var currentSpeed: Int = 0
    private var speedLimit: Int?
    private var roadName: String = "Unknown Road"
    private var isSpeeding: Bool = false
    
    // Templates
    private var dashboardTemplate: CPNavigationTemplate?
    
    init(interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController
        super.init()
    }
    
    func start() {
        setupDashboard()
        startLocationUpdates()
    }
    
    func stop() {
        locationService.stopUpdates()
        cancellables.removeAll()
    }
    
    // MARK: - Dashboard Setup
    
    private func setupDashboard() {
        // Create the main navigation template
        let template = createNavigationTemplate()
        dashboardTemplate = template
        
        interfaceController.setRootTemplate(template, animated: true) { success, error in
            if let error = error {
                print("Failed to set root template: \(error)")
            }
        }
    }
    
    private func createNavigationTemplate() -> CPNavigationTemplate {
        // Create trip estimates (shows speed info)
        let estimates = CPTravelEstimates(
            distanceRemaining: nil,
            timeRemaining: nil
        )
        
        // Create maneuver for current road
        let maneuver = CPManeuver()
        maneuver.instructionVariants = [roadName]
        
        // Create navigation session
        let trip = CPTrip(
            origin: MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D())),
            destination: MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D())),
            routeChoices: []
        )
        
        let template = CPNavigationTemplate(navigationSession: nil)
        
        // Add bar buttons
        template.leadingNavigationBarButtons = [
            CPBarButton(title: "Settings") { [weak self] _ in
                self?.showSettings()
            }
        ]
        
        template.trailingNavigationBarButtons = [
            CPBarButton(title: "Trips") { [weak self] _ in
                self?.showTripHistory()
            }
        ]
        
        return template
    }
    
    // MARK: - Location Updates
    
    private func startLocationUpdates() {
        locationService.speedPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] speed in
                self?.currentSpeed = Int(speed)
                self?.checkSpeedLimit()
                self?.updateDashboard()
            }
            .store(in: &cancellables)
        
        locationService.locationPublisher
            .debounce(for: .seconds(5), scheduler: DispatchQueue.main)
            .sink { [weak self] location in
                self?.fetchSpeedLimit(for: location)
            }
            .store(in: &cancellables)
        
        locationService.startUpdates()
    }
    
    private func fetchSpeedLimit(for location: CLLocation) {
        speedLimitService.getSpeedLimit(
            lat: location.coordinate.latitude,
            lon: location.coordinate.longitude
        ) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let response):
                    self?.speedLimit = response.speedLimit
                    self?.roadName = response.roadName ?? "Unknown Road"
                    self?.checkSpeedLimit()
                    self?.updateDashboard()
                case .failure(let error):
                    print("Speed limit fetch failed: \(error)")
                }
            }
        }
    }
    
    private func checkSpeedLimit() {
        guard let limit = speedLimit else {
            isSpeeding = false
            return
        }
        
        let wasSpeeding = isSpeeding
        isSpeeding = currentSpeed > limit + 5 // 5 mph threshold
        
        if isSpeeding && !wasSpeeding {
            triggerAlert()
        }
    }
    
    private func triggerAlert() {
        alertService.playSpeedAlert(
            currentSpeed: currentSpeed,
            speedLimit: speedLimit ?? 0
        )
    }
    
    // MARK: - Update Dashboard
    
    private func updateDashboard() {
        // CarPlay has limited UI customization
        // We use the navigation template's built-in elements
        // For speed display, we update the maneuver instructions
        
        guard let template = dashboardTemplate else { return }
        
        // Update would require recreating template elements
        // In practice, you'd use CPInstrumentClusterController for speed
        // This is a simplified example
    }
    
    // MARK: - Settings
    
    private func showSettings() {
        let items = [
            CPListItem(text: "Speed Unit", detailText: "MPH"),
            CPListItem(text: "Alert Threshold", detailText: "+5 MPH"),
            CPListItem(text: "Voice Alerts", detailText: "On"),
            CPListItem(text: "Audio Alerts", detailText: "On")
        ]
        
        let section = CPListSection(items: items)
        let listTemplate = CPListTemplate(title: "Settings", sections: [section])
        
        interfaceController.pushTemplate(listTemplate, animated: true) { _, _ in }
    }
    
    // MARK: - Trip History
    
    private func showTripHistory() {
        // Fetch trips from API and display
        let items = [
            CPListItem(text: "Today - 25 mi", detailText: "2 alerts"),
            CPListItem(text: "Yesterday - 42 mi", detailText: "0 alerts"),
            CPListItem(text: "Dec 21 - 18 mi", detailText: "1 alert")
        ]
        
        let section = CPListSection(items: items)
        let listTemplate = CPListTemplate(title: "Trip History", sections: [section])
        
        interfaceController.pushTemplate(listTemplate, animated: true) { _, _ in }
    }
}
```

### 4. LocationService.swift

```swift
import CoreLocation
import Combine

class LocationService: NSObject, CLLocationManagerDelegate {
    
    static let shared = LocationService()
    
    private let locationManager = CLLocationManager()
    private var lastLocation: CLLocation?
    private var lastUpdateTime: Date?
    
    // Publishers
    let locationPublisher = PassthroughSubject<CLLocation, Never>()
    let speedPublisher = PassthroughSubject<Double, Never>()
    
    private override init() {
        super.init()
        setupLocationManager()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 10 // Update every 10 meters
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
    }
    
    func startUpdates() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
    }
    
    func stopUpdates() {
        locationManager.stopUpdatingLocation()
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        // Calculate speed
        var speed: Double = 0
        
        if location.speed >= 0 {
            // Use GPS speed if available (m/s to mph)
            speed = location.speed * 2.23694
        } else if let lastLoc = lastLocation, let lastTime = lastUpdateTime {
            // Calculate from distance/time
            let distance = location.distance(from: lastLoc)
            let timeDiff = location.timestamp.timeIntervalSince(lastTime)
            if timeDiff > 0 {
                speed = (distance / timeDiff) * 2.23694 // m/s to mph
            }
        }
        
        // Filter out unrealistic speeds
        if speed < 200 {
            speedPublisher.send(speed)
        }
        
        locationPublisher.send(location)
        
        lastLocation = location
        lastUpdateTime = location.timestamp
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error)")
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        default:
            break
        }
    }
}
```

### 5. SpeedLimitService.swift

```swift
import Foundation

struct SpeedLimitResponse: Codable {
    let speedLimit: Int?
    let unit: String
    let roadName: String?
    let source: String
    
    enum CodingKeys: String, CodingKey {
        case speedLimit = "speed_limit"
        case unit
        case roadName = "road_name"
        case source
    }
}

class SpeedLimitService {
    
    // Your backend API URL
    private let baseURL = "https://your-backend-url.com/api"
    
    func getSpeedLimit(
        lat: Double,
        lon: Double,
        completion: @escaping (Result<SpeedLimitResponse, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)/speed-limit?lat=\(lat)&lon=\(lon)") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1)))
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "No data", code: -1)))
                return
            }
            
            do {
                let response = try JSONDecoder().decode(SpeedLimitResponse.self, from: data)
                completion(.success(response))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
```

### 6. AlertService.swift

```swift
import AVFoundation
import AudioToolbox

class AlertService {
    
    static let shared = AlertService()
    
    private var synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var lastAlertTime: Date?
    private let alertCooldown: TimeInterval = 10 // seconds
    
    private init() {
        setupAudioSession()
    }
    
    private func setupAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .voicePrompt,
                options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Audio session setup failed: \(error)")
        }
    }
    
    func playSpeedAlert(currentSpeed: Int, speedLimit: Int) {
        // Check cooldown
        if let lastAlert = lastAlertTime,
           Date().timeIntervalSince(lastAlert) < alertCooldown {
            return
        }
        lastAlertTime = Date()
        
        // Haptic feedback
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        
        // Play alert tone
        playAlertTone()
        
        // Voice alert
        let message = "Speed alert. You are going \(currentSpeed) in a \(speedLimit) zone."
        speak(message)
    }
    
    private func playAlertTone() {
        // Play system alert sound
        AudioServicesPlayAlertSound(SystemSoundID(1005)) // Standard alert
    }
    
    private func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.volume = 1.0
        
        synthesizer.speak(utterance)
    }
}
```

---

## CarPlay UI Constraints

### Allowed Templates for Navigation Apps:
1. `CPNavigationTemplate` - Main driving view ✅
2. `CPListTemplate` - Settings, trip history
3. `CPAlertTemplate` - Speed alerts
4. `CPMapTemplate` - Custom map (requires special entitlement)
5. `CPInformationTemplate` - Information display

### NOT Allowed:
- Custom views/layouts
- Complex animations
- Video content
- Web views
- Games or entertainment

### Human Interface Guidelines:
- Maximum 2 rows of text per list item
- Touch targets minimum 44pt
- High contrast colors
- Glanceable information only
- No distracting animations

---

## Testing CarPlay

### 1. CarPlay Simulator (Xcode)
```
1. Open Xcode
2. Run your app on a simulator
3. Go to: I/O → External Displays → CarPlay
4. A CarPlay window appears
```

### 2. Real Device Testing
```
1. Connect iPhone to CarPlay-compatible car/head unit
2. App must be installed from TestFlight or App Store
3. Enable Developer Mode on iPhone
4. App appears in CarPlay dashboard
```

### 3. CarPlay Simulator App
- Download "CarPlay Simulator" from Mac App Store
- More realistic than Xcode simulator
- Supports touch and knob interactions

---

## Package.swift (SPM Dependencies)

```swift
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SpeedAlert",
    platforms: [.iOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
        .package(url: "https://github.com/realm/realm-swift.git", from: "10.44.0"),
    ],
    targets: [
        .target(
            name: "SpeedAlert",
            dependencies: ["Alamofire", "RealmSwift"]
        )
    ]
)
```

---

## Migration Path from Web App

### Shared Backend:
- Use same API endpoints (`/api/speed-limit`, `/api/trips/*`)
- Same JWT authentication
- Same MongoDB database

### Data Sync:
```swift
// APIClient.swift
class APIClient {
    static let baseURL = "https://your-backend-url.com/api"
    
    static func setAuthToken(_ token: String) {
        // Store in Keychain
        KeychainHelper.save(key: "auth_token", value: token)
    }
    
    static func getAuthHeader() -> [String: String] {
        guard let token = KeychainHelper.load(key: "auth_token") else {
            return [:]
        }
        return ["Authorization": "Bearer \(token)"]
    }
}
```

---

## App Store Submission

### Requirements:
1. **CarPlay Entitlement**: Must be approved before submission
2. **Privacy Policy**: Required for location access
3. **App Preview Video**: Show CarPlay functionality
4. **Screenshots**: Include CarPlay screenshots

### Review Notes:
- Explain CarPlay navigation functionality
- Note that speed limits come from OpenStreetMap
- Clarify the app is for awareness, not navigation

---

## Timeline Estimate

| Phase | Tasks | Duration |
|-------|-------|----------|
| Entitlement | Apply for CarPlay access | 1-2 weeks |
| Setup | Project structure, dependencies | 1 week |
| Core | Location tracking, speed alerts | 2 weeks |
| CarPlay UI | Templates, navigation | 2 weeks |
| iPhone App | SwiftUI companion app | 2 weeks |
| Integration | Backend sync, auth | 1 week |
| Testing | Simulator, real devices | 2 weeks |
| Submission | App Store review | 1-2 weeks |

**Total: 12-14 weeks** for full CarPlay support

---

## Resources

- [CarPlay Developer Documentation](https://developer.apple.com/carplay/)
- [CarPlay Programming Guide](https://developer.apple.com/documentation/carplay)
- [Human Interface Guidelines - CarPlay](https://developer.apple.com/design/human-interface-guidelines/carplay)
- [WWDC CarPlay Sessions](https://developer.apple.com/videos/carplay)
- [CarPlay Entitlement Request](https://developer.apple.com/contact/carplay/)

---

## Comparison: Android Auto vs CarPlay

| Aspect | Android Auto | CarPlay |
|--------|--------------|---------|
| Language | Kotlin | Swift |
| SDK | Car App Library | CarPlay Framework |
| Approval | Google Form (2-4 weeks) | Apple Portal (1-2 weeks) |
| Testing | Desktop Head Unit | Xcode Simulator |
| Templates | NavigationTemplate | CPNavigationTemplate |
| Cost | Free (Play Console fee) | $99/year Developer Program |
