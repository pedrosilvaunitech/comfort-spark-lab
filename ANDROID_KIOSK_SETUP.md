# Compilando o APK Kiosk para o Totem

## Pré-requisitos

1. **Node.js** 18+ instalado
2. **Android Studio** instalado e configurado
3. **JDK 17** instalado

## Passo a Passo

### 1. Clone o projeto do GitHub

Exporte o projeto para o GitHub pelo botão "Export to Github" no Lovable, depois:

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

### 5. Configure o Kiosk Mode no Android

Abra o projeto Android no Android Studio:

```bash
npx cap open android
```

#### 5.1 Edite `android/app/src/main/AndroidManifest.xml`

Adicione ao `<activity>` principal:

```xml
<activity
    ...
    android:theme="@style/AppTheme.NoActionBar"
    android:screenOrientation="portrait"
    android:immersive="true"
    android:keepScreenOn="true">
    
    <!-- Para auto-iniciar como kiosk -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
        <category android:name="android.intent.category.HOME" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</activity>
```

Adicione as permissões:

```xml
<uses-feature android:name="android.hardware.usb.host" />
<uses-permission android:name="android.permission.USB_PERMISSION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

#### 5.2 Crie o Plugin USB Printer

Crie o arquivo `android/app/src/main/java/app/lovable/UsbPrinterPlugin.java`:

```java
package app.lovable;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
        int vendorId = call.getInt("vendorId", 0);
        int productId = call.getInt("productId", 0);
        
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        UsbDevice targetDevice = null;
        
        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                targetDevice = device;
                break;
            }
        }
        
        if (targetDevice == null) {
            call.reject("Device not found");
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
        
        try {
            connection = usbManager.openDevice(targetDevice);
            UsbInterface intf = targetDevice.getInterface(0);
            connection.claimInterface(intf, true);
            
            for (int i = 0; i < intf.getEndpointCount(); i++) {
                UsbEndpoint ep = intf.getEndpoint(i);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && 
                    ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    endpoint = ep;
                    break;
                }
            }
            
            connectedDevice = targetDevice;
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Connection error: " + e.getMessage());
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
            call.reject("Printer not connected");
            return;
        }
        
        try {
            byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
            int transferred = connection.bulkTransfer(endpoint, data, data.length, 5000);
            
            JSObject result = new JSObject();
            result.put("success", transferred >= 0);
            result.put("message", transferred >= 0 ? "Printed successfully" : "Transfer failed");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Print error: " + e.getMessage());
        }
    }
}
```

#### 5.3 Registre o Plugin

No arquivo `android/app/src/main/java/.../MainActivity.java`, adicione:

```java
import app.lovable.UsbPrinterPlugin;

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
        
        // Keep screen always on
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
```

### 6. Gere o APK

No Android Studio:
1. Vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. O APK será gerado em `android/app/build/outputs/apk/debug/`

Para APK de produção:
1. **Build > Generate Signed Bundle / APK**
2. Siga o wizard para criar/usar uma keystore

### 7. Instale no Tablet/Totem

```bash
adb install app-debug.apk
```

Ou transfira o APK via USB/pendrive para o dispositivo Android.

### 8. Configure como App Padrão (Kiosk)

No Android do totem:
1. Vá em **Configurações > Apps > App Padrão > Tela Inicial**
2. Selecione o app do totem
3. O app será o launcher padrão (modo kiosk)

---

## Fluxo de Impressão USB

O app detecta automaticamente impressoras USB conectadas ao Android.  
Quando uma senha é gerada no totem:

1. Gera comandos ESC/POS com a senha
2. Envia via USB direto para a impressora térmica
3. Fallback para `window.print()` se não houver impressora USB

## Atualizando o App

Quando fizer alterações no Lovable:

```bash
git pull
npm install
npm run build
npx cap sync
```

Depois recompile o APK no Android Studio.
