package expo.modules.livevoice

import android.app.Application
import android.content.Context
import android.media.AudioAttributes
import com.oney.WebRTCModule.WebRTCModuleOptions
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package
import org.webrtc.audio.JavaAudioDeviceModule

/**
 * **WebRTC's audio played as media, not as a call.** `react-native-webrtc` plays through a
 * `JavaAudioDeviceModule` that defaults to voice-communication attributes — the call stream, whose
 * volume the lock-screen keys and our media session do not drive and which never goes to zero.
 * Ours is the same module with media/speech attributes, given to it in `Application.onCreate`,
 * before any JavaScript can make its factory.
 */
class LiveVoicePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        install(application)
      }
    })

  companion object {
    fun install(context: Context) {
      val options = WebRTCModuleOptions.getInstance()

      if (options.audioDeviceModule != null) {
        return
      }

      options.audioDeviceModule = JavaAudioDeviceModule.builder(context)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        )
        .setEnableVolumeLogger(false)
        .createAudioDeviceModule()
    }
  }
}
