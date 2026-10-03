package expo.modules.livevoice

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.ContentObserver
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** The notification, as `index.ts` describes it. Texts come from the app's own language. */
class NowPlayingInfo : Record {
  @Field var role: String = "listening"
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var isPlaying: Boolean = false
  @Field var playLabel: String = ""
  @Field var stopLabel: String = ""
  @Field var channelName: String = ""
}

/**
 * Live voice on Android: the foreground service and its notification (`LiveVoiceService`), the
 * microphone permission, and the audio focus — whose loss to a call is reported as an
 * interruption. The audio itself is `react-native-webrtc`'s, played as media (`LiveVoicePackage`).
 */
class LiveVoiceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private var focusRequest: AudioFocusRequest? = null
  private var hasLegacyFocus = false

  // Only a passing loss counts: a call. Another app's music taking over is not the reader's to report.
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> sendEvent("onInterruption", mapOf("isInterrupted" to true))
      AudioManager.AUDIOFOCUS_GAIN -> sendEvent("onInterruption", mapOf("isInterrupted" to false))
    }
  }

  // Headphones out: Android's own "becoming noisy", the signal media apps stop on.
  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(receiverContext: Context?, intent: Intent?) {
      if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
        sendEvent("onHeadphonesLost", mapOf<String, Any>())
      }
    }
  }

  // The volume buttons write the system settings; watching them is how a change is heard.
  private val volumeObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
    override fun onChange(selfChange: Boolean) {
      sendEvent("onVolumeChange", mapOf("volume" to outputVolume()))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("LiveVoice")

    Events("onCommand", "onInterruption", "onHeadphonesLost", "onVolumeChange")

    OnCreate {
      LiveVoiceService.onCommand = { command -> sendEvent("onCommand", mapOf("command" to command)) }
      appContext.reactContext?.let { reactContext ->
        // `LiveVoicePackage` has normally done this in `Application.onCreate`; harmless again.
        LiveVoicePackage.install(reactContext.applicationContext)

        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)

        // A system broadcast still reaches a receiver no other app may send to.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          reactContext.registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
          reactContext.registerReceiver(noisyReceiver, filter)
        }
        reactContext.contentResolver.registerContentObserver(Settings.System.CONTENT_URI, true, volumeObserver)
      }
    }

    OnDestroy {
      LiveVoiceService.onCommand = null
      appContext.reactContext?.let { reactContext ->
        LiveVoiceService.stop(reactContext)
        runCatching { reactContext.unregisterReceiver(noisyReceiver) }
        reactContext.contentResolver.unregisterContentObserver(volumeObserver)
      }
      abandonFocus()
    }

    Function("getOutputVolume") {
      outputVolume()
    }

    AsyncFunction("setAudioMode") { mode: String ->
      if (mode == "off") {
        abandonFocus()
      } else {
        requestFocus(mode)
      }
    }

    AsyncFunction("requestMicrophonePermission") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.RECORD_AUDIO)
    }

    Function("showNowPlaying") { info: NowPlayingInfo ->
      val extras = Bundle().apply {
        putString(LiveVoiceService.EXTRA_ROLE, info.role)
        putString(LiveVoiceService.EXTRA_TITLE, info.title)
        putString(LiveVoiceService.EXTRA_SUBTITLE, info.subtitle)
        putBoolean(LiveVoiceService.EXTRA_IS_PLAYING, info.isPlaying)
        putString(LiveVoiceService.EXTRA_PLAY_LABEL, info.playLabel)
        putString(LiveVoiceService.EXTRA_STOP_LABEL, info.stopLabel)
        putString(LiveVoiceService.EXTRA_CHANNEL_NAME, info.channelName)
      }

      LiveVoiceService.show(context, extras)
    }

    Function("hideNowPlaying") {
      LiveVoiceService.stop(context)
    }
  }

  /**
   * The voice plays as media (`LiveVoicePackage`), so its volume is the music stream's, 0 to 1
   * from the stream's own least — some phones' least is above zero, and that is "all the way down".
   */
  private fun outputVolume(): Double {
    val manager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return 1.0
    val stream = AudioManager.STREAM_MUSIC
    val max = manager.getStreamMaxVolume(stream)
    val min = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) manager.getStreamMinVolume(stream) else 0

    return if (max > min) (manager.getStreamVolume(stream) - min).toDouble() / (max - min) else 1.0
  }

  private fun requestFocus(mode: String) {
    abandonFocus()

    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attributes = AudioAttributes.Builder()
        .setUsage(if (mode == "reading") AudioAttributes.USAGE_VOICE_COMMUNICATION else AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener(focusListener)
        .build()

      focusRequest = request
      audioManager.requestAudioFocus(request)
    } else {
      hasLegacyFocus = true
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
    }

    // Refused (a call is on): the reader's voice cannot go out until the focus comes back.
    if (result == AudioManager.AUDIOFOCUS_REQUEST_FAILED) {
      sendEvent("onInterruption", mapOf("isInterrupted" to true))
    }
  }

  private fun abandonFocus() {
    val manager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { manager.abandonAudioFocusRequest(it) }
      focusRequest = null
    } else if (hasLegacyFocus) {
      @Suppress("DEPRECATION")
      manager.abandonAudioFocus(focusListener)
      hasLegacyFocus = false
    }
  }
}
