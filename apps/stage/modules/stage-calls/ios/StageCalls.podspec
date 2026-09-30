Pod::Spec.new do |s|
  s.name = 'StageCalls'
  s.version = '0.1.0'
  s.summary = 'Native call capture lifecycle'
  s.description = 'Foreground call service and local screen broadcast lifecycle'
  s.license = { :type => 'MIT' }
  s.author = 'Stage Labs'
  s.homepage = 'https://stage.box'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
