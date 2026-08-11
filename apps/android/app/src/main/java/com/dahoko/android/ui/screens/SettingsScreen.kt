package com.dahoko.android.ui.screens

import android.content.Intent
import androidx.core.net.toUri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.dahoko.android.ui.AppViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: AppViewModel, onBack: () -> Unit) {
    val syncState by viewModel.syncState.collectAsState()

    var serverUrl by rememberSaveable {
        mutableStateOf(syncState.config?.serverUrl ?: "http://10.0.2.2:8787")
    }
    var email by rememberSaveable { mutableStateOf(syncState.config?.email ?: "") }
    var password by rememberSaveable { mutableStateOf("") }
    var passphrase by rememberSaveable { mutableStateOf("") }
    var mode by rememberSaveable { mutableStateOf("login") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Encrypted sync", style = MaterialTheme.typography.titleMedium)
            Text(
                "Optional end-to-end encrypted sync. Your tasks are encrypted " +
                    "on this device with a separate passphrase before upload — " +
                    "the server can never read them. Use different values for " +
                    "the account password and the encryption passphrase.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (syncState.connected) {
                Card {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Connected", style = MaterialTheme.typography.titleSmall)
                        Text(
                            "${syncState.config?.email}\n${syncState.config?.serverUrl}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                        syncState.config?.lastSyncedAt?.let {
                            Text(
                                "Last synced: $it",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { viewModel.syncNow() },
                                enabled = !syncState.syncing,
                            ) {
                                Text(if (syncState.syncing) "Syncing…" else "Sync now")
                            }
                            OutlinedButton(onClick = { viewModel.disconnectSync() }) {
                                Text("Disconnect")
                            }
                        }
                    }
                }

                syncState.billing?.let { billing ->
                    val context = LocalContext.current
                    val openUrl = { url: String ->
                        context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
                    }
                    val subscription = billing.subscription
                    Card {
                        Column(
                            Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "Dahoko Cloud plan · " + when {
                                    subscription.status == "trialing" -> "Pro (trial)"
                                    subscription.active -> "Pro"
                                    else -> "Free"
                                },
                                style = MaterialTheme.typography.titleSmall,
                            )
                            if (subscription.active) {
                                subscription.currentPeriodEnd?.let { end ->
                                    val date = Instant.ofEpochSecond(end)
                                        .atZone(ZoneId.systemDefault())
                                        .format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
                                    val card = subscription.cardLast4
                                        ?.let { last4 ->
                                            " · ${subscription.cardBrand ?: "card"} ····$last4"
                                        } ?: ""
                                    Text(
                                        (if (subscription.cancelAtPeriodEnd) "Ends " else "Renews ") +
                                            date + card,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(onClick = { viewModel.openBillingPortal(openUrl) }) {
                                        Text("Manage billing")
                                    }
                                    OutlinedButton(onClick = { viewModel.refreshBilling() }) {
                                        Text("Refresh")
                                    }
                                }
                            } else {
                                Text(
                                    "Upgrade to sync this account across devices on hosted, " +
                                        "end-to-end-encrypted Dahoko Cloud. Checkout opens in " +
                                        "your browser; the plan refreshes here afterwards.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(onClick = { viewModel.startCheckout("monthly", openUrl) }) {
                                        Text("Upgrade · $4/mo")
                                    }
                                    OutlinedButton(
                                        onClick = { viewModel.startCheckout("yearly", openUrl) },
                                    ) {
                                        Text("$40/yr")
                                    }
                                }
                                OutlinedButton(onClick = { viewModel.refreshBilling() }) {
                                    Text("I've finished checkout — refresh")
                                }
                            }
                        }
                    }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = mode == "login",
                        onClick = { mode = "login" },
                        label = { Text("Sign in") },
                    )
                    FilterChip(
                        selected = mode == "register",
                        onClick = { mode = "register" },
                        label = { Text("Create account") },
                    )
                }
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Sync server URL") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Email") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Account password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                )
                OutlinedTextField(
                    value = passphrase,
                    onValueChange = { passphrase = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Encryption passphrase") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    supportingText = {
                        Text("Never sent to the server. If lost, synced data cannot be recovered.")
                    },
                )
                Button(
                    onClick = {
                        viewModel.connectSync(serverUrl, mode, email, password, passphrase)
                    },
                    enabled = !syncState.syncing &&
                        serverUrl.isNotBlank() && email.isNotBlank() &&
                        password.isNotBlank() && passphrase.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        when {
                            syncState.syncing -> "Working…"
                            mode == "register" -> "Create account & sync"
                            else -> "Sign in & sync"
                        },
                    )
                }
            }

            syncState.message?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (syncState.error) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    },
                )
            }

            Spacer(Modifier.height(16.dp))
            Text("About", style = MaterialTheme.typography.titleMedium)
            Text(
                "Dahoko for Android 0.1.0 — an open-source, offline-first task manager.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
