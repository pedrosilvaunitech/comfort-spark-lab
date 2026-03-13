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
<activity
    ...
    android:theme="@style/AppTheme.NoActionBar"
    android:screenOrientation="landscape"
    android:immersive="true"
    android:keepScreenOn="true">
    
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
```

Permissões:

```xml
<uses-feature android:name="android.hardware.usb.host" />
<uses-permission android:name="android.permission.USB_PERMISSION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.INTERNET" />
```

### 7. Crie o filtro USB para a PT80KM

Crie `android/app/src/main/res/xml/device_filter.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- PT80KM Thermal Kiosk Printer -->
    <usb-device vendor-id="1155" product-id="30016" />
    <!-- Outros modelos POS compatíveis -->
    <usb-device vendor-id="1155" />
</resources>
```

### 8. Crie o Plugin USB Printer

Crie `android/app/src/main/java/app/lovable/UsbPrinterPlugin.java`:

```java
package app.lovable;

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
    private static final String ACTION_USB_PERMISSION = "app.lovable.USB_PERMISSION";
    
    private UsbManager usbManager;
    private UsbDevice connectedDevice;
    private UsbDeviceConnection connection;
    private UsbEndpoint endpoint;

    @Override
    public void load() {
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        // Auto-detect PT80KM on load
        autoConnectPT80KM();
    }
    
    private void autoConnectPT80KM() {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        for (UsbDevice device : deviceList.values()) {
            // PT80KM: VID=0x0483 PID=0x7540
            if (device.getVendorId() == 0x0483 && device.getProductId() == 0x7540) {
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
            call.reject("PT80KM not found. Check USB connection.");
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
            call.reject("Failed to connect to PT80KM");
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
            // Try auto-connect
            autoConnectPT80KM();
            if (connection == null || endpoint == null) {
                call.reject("PT80KM not connected");
                return;
            }
        }
        
        try {
            byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
            
            // Send in chunks for reliability (PT80KM max packet = 64 bytes)
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
            result.put("message", success ? "Printed successfully" : "Transfer failed");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Print error: " + e.getMessage());
        }
    }
}
```

### 9. Registre o Plugin

Em `android/app/src/main/java/.../MainActivity.java`:

```java
import app.lovable.UsbPrinterPlugin;
import android.view.View;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsbPrinterPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Kiosk mode - Immersive fullscreen
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
        
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
```

### 10. Gere o APK

No Android Studio:

1. **Build > Build Bundle(s) / APK(s) > Build APK(s)** (debug)
2. O APK fica em `android/app/build/outputs/apk/debug/`

Para produção:

1. **Build > Generate Signed Bundle / APK**
2. Siga o wizard para criar/usar uma keystore

### 11. Instale no Tablet/Totem

```bash
adb install app-debug.apk
```

### 12. Configure como Kiosk

No Android:
1. **Configurações > Apps > App Padrão > Tela Inicial**
2. Selecione o app do totem

---

## Fluxo de Impressão

1. App detecta PT80KM automaticamente via USB
2. Gera comandos ESC/POS com a senha (80mm)
3. Envia via USB bulk transfer em chunks de 64 bytes
4. Corte automático (GS V 66 03)

## Atualizando

```bash
git pull
npm install
npm run build
npx cap sync
# Recompile o APK no Android Studio
```
