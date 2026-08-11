# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class com.dahoko.android.** {
    *** Companion;
}
-keepclasseswithmembers class com.dahoko.android.** {
    kotlinx.serialization.KSerializer serializer(...);
}
