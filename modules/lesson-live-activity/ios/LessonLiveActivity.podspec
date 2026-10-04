Pod::Spec.new do |s|
  s.name           = 'LessonLiveActivity'
  s.version        = '1.0.0'
  s.summary        = "Starts and ends the school day's Live Activity."
  s.description    = "Wraps ActivityKit so JS can show today's lessons on the Lock Screen and Dynamic Island."
  s.author         = 'OtaMaps'
  s.homepage       = 'https://otamaps.fi'
  s.license        = { :type => 'UNLICENSED' }
  # ActivityAttributes needs iOS 16.1, so this cannot go as low as the other
  # local modules. Matches the app's and the widget extension's target.
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ActivityKit'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
