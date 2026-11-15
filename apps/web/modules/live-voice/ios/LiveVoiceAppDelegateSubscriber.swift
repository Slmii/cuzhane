import ExpoModulesCore

/// Puts `LiveVoiceAudioDevice` into `react-native-webrtc` as early as the app allows — before any
/// JavaScript runs, so before WebRTC's module makes its factory, which reads the device only then.
public class LiveVoiceAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func subscriberDidRegister() {
    LiveVoiceAudioDevice.install()
  }
}
