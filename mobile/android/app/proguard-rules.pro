-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Play Core (deferred components Flutter — classes optionnelles au runtime)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }
