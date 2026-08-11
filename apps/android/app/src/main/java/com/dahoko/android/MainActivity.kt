package com.dahoko.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dahoko.android.ui.AppViewModel
import com.dahoko.android.ui.screens.HomeScreen
import com.dahoko.android.ui.screens.SettingsScreen
import com.dahoko.android.ui.theme.DahokoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DahokoTheme {
                DahokoRoot()
            }
        }
    }
}

@Composable
private fun DahokoRoot(viewModel: AppViewModel = viewModel()) {
    var showSettings by rememberSaveable { mutableStateOf(false) }
    if (showSettings) {
        SettingsScreen(viewModel = viewModel, onBack = { showSettings = false })
    } else {
        HomeScreen(viewModel = viewModel, onOpenSettings = { showSettings = true })
    }
}
