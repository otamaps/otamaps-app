Pod::Spec.new do |s|
  s.name           = 'SearchScopeBar'
  s.version        = '1.0.0'
  s.summary        = "Shows the navigation search bar's scope bar as a permanent selector."
  s.description    = "Turns on the scope bar of the screen's UISearchController and reports changes."
  s.author         = 'OtaMaps'
  s.homepage       = 'https://otamaps.fi'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
