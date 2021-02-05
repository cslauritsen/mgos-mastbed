# DHT22 + Motion Mongoose OS app

# Hardware Platform
ESP8266 LoLin NodeMCU. 

<img src="docs/ESP8266-NodeMCU-kit-12-E-pinout-gpio-pin.png">


# Features
 * DHT22 Temperature and Humidity Sensing
 * PIR motion sensor
 * MQTT publishing
 * HTTP/MQTT RPC Control
 * OTA Firmware Updating

 # HTTP RPC
 Issue an HTTP get like so, no paylaod is required. 
 ```bash
 curl http://192.168.1.xxx/rpc/Motion.Read
 ```

 # MQTT RPC
 You can send a command via MQTT. This means you don't need to have a static IP for the device, but you will need to know its unique ID which doesn't change like the IP might. 
This device supports auto-discovery in services like OpenHAB by leveraging via the [homie convention](https://homieiot.github.io).

In the example below, "alpha" is "correlation ID", that is, an identifier that will be echoed back by the node in response to an RPC request which will contain information about the node's response, errors, etc. 

 ```bash
 mqttpub -h 192.168.1.5 \
    -t esp8266_7E5E96/rpc  \
    '{id: 1, "src":"alpha", "method": "Motion.Read"}' 
 ```

# OTA Firmware Update
When you use the `mos flash` command certain configurations parameters (like WiFi) configuration are lost.

The simplest method is to use an HTTP POST:
```bash
cd project-repo-root
curl -i -F filedata=@./build/fw.zip http://192.168.1.xxx/update
```