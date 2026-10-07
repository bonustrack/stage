Pod::Spec.new do |s|
  s.name = 'StageSpeech'
  s.version = '0.1.0'
  s.summary = 'On-device microphone dictation'
  s.description = 'Local speech recognition with no network recognition fallback'
  s.license = { :type => 'MIT' }
  s.author = 'Stage Labs'
  s.homepage = 'https://stage.box'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Speech', 'AVFoundation'
  s.source_files = '**/*.swift'
end
