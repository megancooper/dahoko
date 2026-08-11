package com.dahoko.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * dahoko brand palette, mapped 1:1 from the desktop design tokens in
 * packages/ui/src/index.css. Pastel blue #A3D0FF is the brand color with
 * deep navy as its text/contrast partner; peach is the warm complement;
 * neutrals are blue-tinged. Dynamic (wallpaper) color is deliberately not
 * used — the app should look like dahoko everywhere.
 */

val DahokoBlue = Color(0xFFA3D0FF) // --brand-primary
val DahokoBlueStrong = Color(0xFF2563A8) // --brand-primary-strong
val DahokoNavy = Color(0xFF17456F) // --brand-primary-depth
val DahokoPeach = Color(0xFFFFD3A3) // --brand-secondary

private val LightColors = lightColorScheme(
    primary = DahokoBlue,
    onPrimary = Color(0xFF102A42),
    primaryContainer = Color(0xFFEAF4FF), // --secondary
    onPrimaryContainer = DahokoNavy,
    inversePrimary = DahokoBlue,
    secondary = DahokoBlueStrong,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFEAF4FF),
    onSecondaryContainer = DahokoNavy,
    tertiary = Color(0xFFB2791A), // --attention
    onTertiary = Color(0xFF1E1606),
    tertiaryContainer = DahokoPeach,
    onTertiaryContainer = Color(0xFF3A2708),
    error = Color(0xFFC0392B), // --destructive
    onError = Color(0xFFFFFAF9),
    errorContainer = Color(0xFFF9E3E0),
    onErrorContainer = Color(0xFF5B160D),
    background = Color.White,
    onBackground = Color(0xFF18222E), // --text-primary
    surface = Color.White,
    onSurface = Color(0xFF18222E),
    surfaceVariant = Color(0xFFF0F6FC), // --muted
    onSurfaceVariant = Color(0xFF5A6C7E), // --text-secondary
    surfaceTint = DahokoBlue,
    outline = Color(0xFF808FA0), // --input
    outlineVariant = Color(0xFFD5E3F0), // --border
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF4F9FE), // --surface-subtle
    surfaceContainer = Color(0xFFF0F6FC),
    surfaceContainerHigh = Color(0xFFEAF4FF),
    surfaceContainerHighest = Color(0xFFEAF4FF),
    inverseSurface = Color(0xFF18222E),
    inverseOnSurface = Color(0xFFF4F9FE),
    scrim = Color(0xFF10141B),
)

private val DarkColors = darkColorScheme(
    primary = DahokoBlue,
    onPrimary = Color(0xFF102134),
    primaryContainer = Color(0xFF203044), // --accent
    onPrimaryContainer = Color(0xFFC9E3FC), // --brand-primary-depth (dark)
    inversePrimary = DahokoBlueStrong,
    secondary = Color(0xFF8FC3F7), // --brand-primary-strong (dark)
    onSecondary = Color(0xFF102134),
    secondaryContainer = Color(0xFF1B293A), // --secondary (dark)
    onSecondaryContainer = Color(0xFFE8F0FA),
    tertiary = Color(0xFFE2B25A), // --attention (dark)
    onTertiary = Color(0xFF1E1606),
    tertiaryContainer = Color(0xFF3A2D1E), // --brand-secondary (dark)
    onTertiaryContainer = Color(0xFFF2DBB4),
    error = Color(0xFFF08076), // --destructive (dark)
    onError = Color(0xFF3B0E0A),
    errorContainer = Color(0xFF4A1810),
    onErrorContainer = Color(0xFFF6C1BA),
    background = Color(0xFF0E1621), // --background (dark)
    onBackground = Color(0xFFE8F0FA), // --text-primary (dark)
    surface = Color(0xFF0E1621),
    onSurface = Color(0xFFE8F0FA),
    surfaceVariant = Color(0xFF1B293A), // --muted (dark)
    onSurfaceVariant = Color(0xFFB1C2D4), // --text-secondary (dark)
    surfaceTint = DahokoBlue,
    outline = Color(0xFF889AAE), // --input (dark)
    outlineVariant = Color(0xFF2C3D53), // --border (dark)
    surfaceContainerLowest = Color(0xFF0B121B),
    surfaceContainerLow = Color(0xFF15202E), // --card (dark)
    surfaceContainer = Color(0xFF1B293A),
    surfaceContainerHigh = Color(0xFF203044),
    surfaceContainerHighest = Color(0xFF243850),
    inverseSurface = Color(0xFFE8F0FA),
    inverseOnSurface = Color(0xFF15202E),
    scrim = Color(0xFF05080D),
)

/** Soft radii matching the desktop's --radius (0.8rem ≈ 13dp). */
private val DahokoShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(18.dp),
    extraLarge = RoundedCornerShape(26.dp),
)

/**
 * Type scale tuned to read like the desktop app: titles carry weight and
 * slightly negative tracking, body copy stays quiet, and labels — the
 * layer used for section captions — are small, medium-weight, and
 * letterspaced so structure comes from typography rather than boxes.
 */
private val DahokoTypography = Typography(
    titleLarge = TextStyle(
        fontSize = 22.sp,
        lineHeight = 28.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.3).sp,
    ),
    titleMedium = TextStyle(
        fontSize = 17.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.1).sp,
    ),
    titleSmall = TextStyle(
        fontSize = 15.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.sp,
    ),
    bodyLarge = TextStyle(
        fontSize = 16.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.sp,
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.1.sp,
    ),
    bodySmall = TextStyle(
        fontSize = 12.5.sp,
        lineHeight = 17.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.1.sp,
    ),
    labelLarge = TextStyle(
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.1.sp,
    ),
    labelMedium = TextStyle(
        fontSize = 12.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.4.sp,
    ),
    // Section captions: small caps energy without shouting.
    labelSmall = TextStyle(
        fontSize = 11.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.9.sp,
    ),
)

@Composable
fun DahokoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        shapes = DahokoShapes,
        typography = DahokoTypography,
        content = content,
    )
}

/**
 * Priority accents matching the desktop: destructive red for high, warm
 * gold for medium, accessible brand blue for low. Dark theme lifts each
 * hue the same way the desktop tokens do.
 */
@Composable
fun priorityColor(priority: Int): Color? {
    val dark = isSystemInDarkTheme()
    return when (priority) {
        3 -> if (dark) Color(0xFFF08076) else Color(0xFFC0392B)
        2 -> if (dark) Color(0xFFE2B25A) else Color(0xFFB2791A)
        1 -> if (dark) Color(0xFF8FC3F7) else DahokoBlueStrong
        else -> null
    }
}
