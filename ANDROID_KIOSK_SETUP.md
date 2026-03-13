# Compilando o APK Kiosk para o Totem (PT80KM)

## Impressora Suportada

- **PT80KM** — 80mm Thermal Kiosk Printer Panel Mount
- VID: `0x0483` (1155) | PID: `0x7540` (30016)
- Interface: USB (ESC/POS)

## Pré-requisitos

1. **Node.js** 18+
2. **Android Studio** instalado e configurado
3. **JDK 17** instalado

## Passo a Passo

### 1. Clone o projeto do GitHub

```bash
git clone <seu-repositorio>
cd <nome-do-projeto>
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Adicione a plataforma Android

```bash
npx cap add android
```

### 4. Construa o projeto

```bash
npm run build
npx cap sync
```

### 5. Abra no Android Studio

```bash
npx cap open android
```

### 6. Configure o AndroidManifest.xml

Edite `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.usb.host" />
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <application
        ...
        android:persistent="true">

        <activity
            ...
            android:theme="@style/AppTheme.NoActionBar"
            android:screenOrientation="landscape"
            android:immersive="true"
            android:keepScreenOn="true"
            android:lockTaskMode="if_whitelisted"
            android:launchMode="singleTask"
            android:excludeFromRecents="true">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.HOME" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            
            <!-- Auto-detect PT80KM printer -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            <meta-data
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />
        </activity>

        <!-- Boot receiver para iniciar automaticamente -->
        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>

        <!-- Device Admin para kiosk real -->
        <receiver
            android:name=".KioskDeviceAdmin"
            android:permission="android.permission.BIND_DEVICE_ADMIN"
            android:exported="true">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/device_admin" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>
```

### 7. Crie o filtro USB para a PT80KM

Crie `android/app/src/main/res/xml/device_filter.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <usb-device vendor-id="1155" product-id="30016" />
    <usb-device vendor-id="1155" />
</resources>
```

### 8. Crie o Device Admin XML

Crie `android/app/src/main/res/xml/device_admin.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<device-admin>
    <uses-policies>
        <limit-password />
        <watch-login />
        <reset-password />
        <force-lock />
        <wipe-data />
    </uses-policies>
</device-admin>
```

### 9. Crie o Plugin USB Printer

Crie `android/app/src/main/java/app/lovable/comfortsparklab/UsbPrinterPlugin.java`:

```java
package app.lovable.comfortsparklab;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.*;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;

@CapacitorPlugin(name = "UsbPrinter")
public class UsbPrinterPlugin extends Plugin {
    private static final String TAG = "UsbPrinter";
    private static final String ACTION_USB_PERMISSION = "app.lovable.comfortsparklab.USB_PERMISSION";
    
    private UsbManager usbManager;
    private UsbDevice connectedDevice;
    private UsbDeviceConnection connection;
    private UsbEndpoint endpoint;

    @Override
    public void load() {
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        autoConnectPT80KM();
    }
    
    private void autoConnectPT80KM() {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == 0x0483) {
                if (usbManager.hasPermission(device)) {
                    connectToDevice(device);
                } else {
                    PendingIntent pi = PendingIntent.getBroadcast(
                        getContext(), 0,
                        new Intent(ACTION_USB_PERMISSION),
                        PendingIntent.FLAG_IMMUTABLE
                    );
                    usbManager.requestPermission(device, pi);
                }
                break;
            }
        }
    }
    
    private boolean connectToDevice(UsbDevice device) {
        try {
            connection = usbManager.openDevice(device);
            UsbInterface intf = device.getInterface(0);
            connection.claimInterface(intf, true);
            
            for (int i = 0; i < intf.getEndpointCount(); i++) {
                UsbEndpoint ep = intf.getEndpoint(i);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && 
                    ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    endpoint = ep;
                    break;
                }
            }
            
            connectedDevice = device;
            Log.i(TAG, "Connected to " + device.getDeviceName());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Connection error: " + e.getMessage());
            return false;
        }
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        try {
            JSONArray devices = new JSONArray();
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            
            for (UsbDevice device : deviceList.values()) {
                JSONObject d = new JSONObject();
                d.put("vendorId", device.getVendorId());
                d.put("productId", device.getProductId());
                d.put("name", device.getDeviceName());
                devices.put(d);
            }
            
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Error listing devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        int vendorId = call.getInt("vendorId", 0x0483);
        int productId = call.getInt("productId", 0x7540);
        
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        UsbDevice targetDevice = null;
        
        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                targetDevice = device;
                break;
            }
        }
        
        if (targetDevice == null) {
            call.reject("Printer not found. Check USB connection.");
            return;
        }
        
        if (!usbManager.hasPermission(targetDevice)) {
            PendingIntent pi = PendingIntent.getBroadcast(
                getContext(), 0, 
                new Intent(ACTION_USB_PERMISSION),
                PendingIntent.FLAG_IMMUTABLE
            );
            usbManager.requestPermission(targetDevice, pi);
            call.reject("Permission requested. Try again.");
            return;
        }
        
        boolean ok = connectToDevice(targetDevice);
        if (ok) {
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } else {
            call.reject("Failed to connect");
        }
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", connection != null && connectedDevice != null);
        if (connectedDevice != null) {
            result.put("deviceName", connectedDevice.getDeviceName());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void print(PluginCall call) {
        String base64Data = call.getString("data", "");
        
        if (connection == null || endpoint == null) {
            autoConnectPT80KM();
            if (connection == null || endpoint == null) {
                call.reject("Printer not connected");
                return;
            }
        }
        
        try {
            byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
            
            int chunkSize = 64;
            boolean success = true;
            for (int offset = 0; offset < data.length; offset += chunkSize) {
                int len = Math.min(chunkSize, data.length - offset);
                byte[] chunk = new byte[len];
                System.arraycopy(data, offset, chunk, 0, len);
                int transferred = connection.bulkTransfer(endpoint, chunk, len, 5000);
                if (transferred < 0) {
                    success = false;
                    break;
                }
            }
            
            JSObject result = new JSObject();
            result.put("success", success);
            result.put("message", success ? "Printed" : "Transfer failed");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Print error: " + e.getMessage());
        }
    }
}
```

### 10. Crie o BootReceiver

Crie `android/app/src/main/java/app/lovable/comfortsparklab/BootReceiver.java`:

```java
package app.lovable.comfortsparklab;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launchIntent);
        }
    }
}
```

### 11. Crie o KioskDeviceAdmin

Crie `android/app/src/main/java/app/lovable/comfortsparklab/KioskDeviceAdmin.java`:

```java
package app.lovable.comfortsparklab;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;

public class KioskDeviceAdmin extends DeviceAdminReceiver {
    @Override
    public void onEnabled(Context context, Intent intent) {}
    
    @Override
    public void onDisabled(Context context, Intent intent) {}
}
```

### 12. Configure o MainActivity.java

Substitua `android/app/src/main/java/app/lovable/comfortsparklab/MainActivity.java`:

```java
package app.lovable.comfortsparklab;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private DevicePolicyManager dpm;
    private ComponentName adminComponent;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsbPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, KioskDeviceAdmin.class);

        enableKioskMode();
    }

    private void enableKioskMode() {
        // Fullscreen immersive
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        // Keep screen on
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        // Lock Task Mode (true kiosk - blocks Home, Recent, notifications)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            if (dpm != null && dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setLockTaskPackages(adminComponent, new String[]{getPackageName()});
                startLockTask();
            } else {
                // Fallback: start lock task without device owner (user can exit)
                try {
                    startLockTask();
                } catch (Exception e) {
                    // Lock task not available without device owner
                }
            }
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }

    // Block all physical keys
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Allow volume for accessibility, block everything else
        if (keyCode == KeyEvent.KEYCODE_BACK
            || keyCode == KeyEvent.KEYCODE_HOME
            || keyCode == KeyEvent.KEYCODE_APP_SWITCH
            || keyCode == KeyEvent.KEYCODE_MENU) {
            return true; // consume = block
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        // Block back button completely
    }
}
```

### 13. Ativar Device Owner (KIOSK REAL)

Após instalar o APK no tablet, conecte via ADB e execute:

```bash
# Resetar o tablet para fábrica (necessário para device owner)
# OU usar ADB com tablet sem conta Google:
adb shell dpm set-device-owner app.lovable.comfortsparklab/.KioskDeviceAdmin
```

> ⚠️ **IMPORTANTE**: Para definir Device Owner, o tablet NÃO pode ter contas Google configuradas. Faça um factory reset antes e pule a configuração da conta Google.

**Alternativa sem factory reset** (kiosk parcial):
O app ainda funcionará em modo imersivo com tela cheia e bloqueio de back/home, mas o usuário pode eventualmente sair segurando botões.

### 14. Gere o APK

No Android Studio:

1. **Build > Build Bundle(s) / APK(s) > Build APK(s)** (debug)
2. O APK fica em `android/app/build/outputs/apk/debug/`

Para produção:

1. **Build > Generate Signed Bundle / APK**
2. Siga o wizard para criar/usar uma keystore

### 15. Instale no Tablet/Totem

```bash
adb install -r app-debug.apk
```

---

## O que o Modo Kiosk faz

| Recurso | Descrição |
|---------|-----------|
| **Lock Task Mode** | Bloqueia Home, Recentes, Notificações |
| **Immersive Sticky** | Oculta barra de status e navegação |
| **Keep Screen On** | Tela sempre ligada |
| **Boot Receiver** | Inicia automaticamente ao ligar |
| **Back Button Block** | Botão voltar desativado |
| **Physical Keys Block** | Menu e App Switch bloqueados |
| **Landscape Lock** | Fixa em modo paisagem |
| **USB Auto-detect** | Detecta impressora PT80KM automaticamente |

## Desbloquear Kiosk (para manutenção)

```bash
adb shell dpm remove-active-admin app.lovable.comfortsparklab/.KioskDeviceAdmin
adb shell am force-stop app.lovable.comfortsparklab
```

## Atualizando

```bash
git pull
npm install
npm run build
npx cap sync
# Recompile o APK no Android Studio
adb install -r app-debug.apk
```
