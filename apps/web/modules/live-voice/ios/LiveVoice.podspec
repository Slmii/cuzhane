Pod::Spec.new do |s|
  s.name           = 'LiveVoice'
  s.version        = '1.0.0'
  s.summary        = 'Live voice: audio session, Now Playing and lock-screen controls'
  s.description    = 'The audio session, Now Playing entry and remote commands for live voice'
  s.author         = ''
  s.homepage       = 'https://cuzhane.app'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # WebRTC's own audio session object, so ours and react-native-webrtc's never fight over it.
  s.dependency 'JitsiWebRTC', '~> 124.0.0'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
