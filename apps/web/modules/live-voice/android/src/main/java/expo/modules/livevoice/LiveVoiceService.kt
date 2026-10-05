package expo.modules.livevoice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * **What keeps live voice going with the screen off**: a foreground service — `mediaPlayback`
 * while listening, `microphone` while reading — and its notification.
 *
 * - Listening, the notification is a media one with its own `MediaSession`, so the lock screen,
 *   headphones and a car get play and stop as well; reading, it says the voice is on, with a stop.
 * - Every button comes back to the app as a command (`onCommand`): the app decides what play and
 *   stop mean, and sends the new state here.
 * - **Started only from the app in front.** Android refuses a new foreground service from the
 *   background, so once running it is updated in place, never started again — a lock-screen play
 *   after a stop finds it still there, showing play.
 */
class LiveVoiceService : Service() {
  companion object {
    const val EXTRA_ROLE = "role"
    const val EXTRA_TITLE = "title"
    const val EXTRA_SUBTITLE = "subtitle"
    const val EXTRA_IS_PLAYING = "isPlaying"
    const val EXTRA_PLAY_LABEL = "playLabel"
    const val EXTRA_STOP_LABEL = "stopLabel"
    const val EXTRA_CHANNEL_NAME = "channelName"

    private const val ACTION_UPDATE = "expo.modules.livevoice.UPDATE"
    private const val ACTION_PLAY = "expo.modules.livevoice.PLAY"
    private const val ACTION_PAUSE = "expo.modules.livevoice.PAUSE"
    private const val CHANNEL_ID = "live-voice"
    private const val NOTIFICATION_ID = 4710

    /** Set by the module while the app is there to hear it. */
    @Volatile
    var onCommand: ((String) -> Unit)? = null

    @Volatile
    private var instance: LiveVoiceService? = null

    /*
     * **A start on its way** — `startForegroundService` called, `onStartCommand` not yet run.
     * Android then demands `startForeground` within seconds, and stopping before it crashes the
     * app (`ForegroundServiceDidNotStartInTimeException`). So meanwhile a new look only replaces
     * the one it will show, and a stop is kept until it has gone into the foreground.
     * Everything here runs on the main thread.
     */
    private var isStarting = false
    private var pendingInfo: Bundle? = null
    private var isStopPending = false

    private val mainHandler = Handler(Looper.getMainLooper())

    fun show(context: Context, info: Bundle) {
      mainHandler.post {
        if (isStarting) {
          pendingInfo = info
          isStopPending = false
          return@post
        }

        val running = instance

        if (running != null && running.foregroundRole != null) {
          running.update(info)
          return@post
        }

        val intent = Intent(context, LiveVoiceService::class.java).setAction(ACTION_UPDATE)

        isStarting = true
        isStopPending = false
        pendingInfo = info

        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
          } else {
            context.startService(intent)
          }
        } catch (_: Exception) {
          // Refused from the background: the voice still plays while the app is in front.
          isStarting = false
          pendingInfo = null
        }
      }
    }

    fun stop(context: Context) {
      mainHandler.post {
        if (isStarting) {
          isStopPending = true
          return@post
        }

        context.stopService(Intent(context, LiveVoiceService::class.java))
      }
    }
  }

  private var session: MediaSession? = null
  private var foregroundRole: String? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_PLAY -> onCommand?.invoke("play")
      ACTION_PAUSE -> onCommand?.invoke("pause")
      ACTION_UPDATE -> {
        // Into the foreground first, always — then a stop asked for meanwhile is honoured.
        val info = pendingInfo ?: Bundle()

        pendingInfo = null
        isStarting = false
        update(info)

        if (isStopPending || foregroundRole == null) {
          isStopPending = false
          stopNow()
        }
      }
    }

    return START_NOT_STICKY
  }

  private fun stopNow() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }

    stopSelf()
  }

  override fun onDestroy() {
    instance = null
    session?.release()
    session = null
    foregroundRole = null

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }

    super.onDestroy()
  }

  private fun update(info: Bundle) {
    val role = info.getString(EXTRA_ROLE) ?: "listening"
    val isListening = role == "listening"
    val title = info.getString(EXTRA_TITLE) ?: ""
    val subtitle = info.getString(EXTRA_SUBTITLE) ?: ""
    val isPlaying = info.getBoolean(EXTRA_IS_PLAYING)

    ensureChannel(info.getString(EXTRA_CHANNEL_NAME) ?: title)

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_LOW)
    }

    builder
      .setSmallIcon(R.drawable.live_voice_notification)
      .setContentTitle(title)
      .setContentText(subtitle)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)

    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, pendingFlags()))
    }

    if (isListening) {
      val mediaSession = ensureSession()

      mediaSession.setMetadata(
        MediaMetadata.Builder()
          .putString(MediaMetadata.METADATA_KEY_TITLE, title)
          .putString(MediaMetadata.METADATA_KEY_ARTIST, subtitle)
          .build()
      )
      mediaSession.setPlaybackState(
        PlaybackState.Builder()
          .setActions(
            PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
              PlaybackState.ACTION_STOP
          )
          .setState(
            if (isPlaying) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
            PlaybackState.PLAYBACK_POSITION_UNKNOWN,
            if (isPlaying) 1f else 0f
          )
          .build()
      )

      builder
        .addAction(
          if (isPlaying) {
            action(android.R.drawable.ic_media_pause, info.getString(EXTRA_STOP_LABEL) ?: "", ACTION_PAUSE)
          } else {
            action(android.R.drawable.ic_media_play, info.getString(EXTRA_PLAY_LABEL) ?: "", ACTION_PLAY)
          }
        )
        .setStyle(Notification.MediaStyle().setMediaSession(mediaSession.sessionToken).setShowActionsInCompactView(0))
    } else {
      session?.release()
      session = null
      builder.addAction(action(android.R.drawable.ic_media_pause, info.getString(EXTRA_STOP_LABEL) ?: "", ACTION_PAUSE))
    }

    val notification = builder.build()

    if (foregroundRole == role) {
      getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification)
      return
    }

    val type = if (isListening) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
    } else {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    }

    /*
     * The microphone type is refused without the permission granted (or from the background);
     * media playback then, so the promise of `startForegroundService` is still kept — the caller
     * stops a service that has nothing to hold.
     */
    if (startForegroundAs(notification, type) || startForegroundAs(notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)) {
      foregroundRole = role
    }
  }

  private fun startForegroundAs(notification: Notification, type: Int): Boolean =
    try {
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> startForeground(NOTIFICATION_ID, notification, type)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
          startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        else -> startForeground(NOTIFICATION_ID, notification)
      }

      true
    } catch (_: Exception) {
      false
    }

  private fun ensureSession(): MediaSession =
    session ?: MediaSession(this, "LiveVoice").also { created ->
      created.setCallback(object : MediaSession.Callback() {
        override fun onPlay() {
          onCommand?.invoke("play")
        }

        override fun onPause() {
          onCommand?.invoke("pause")
        }

        override fun onStop() {
          onCommand?.invoke("pause")
        }
      })
      created.isActive = true
      session = created
    }

  private fun ensureChannel(name: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    // Quiet: it stands for what is playing, it never rings. Re-creating it only renames it.
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW).apply {
      setShowBadge(false)
    }

    getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
  }

  private fun action(icon: Int, label: String, command: String): Notification.Action {
    val intent = Intent(this, LiveVoiceService::class.java).setAction(command)
    val pending = PendingIntent.getService(this, command.hashCode(), intent, pendingFlags())

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Notification.Action.Builder(Icon.createWithResource(this, icon), label, pending).build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Action.Builder(icon, label, pending).build()
    }
  }

  private fun pendingFlags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
}
