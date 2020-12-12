# Garage Mongoose OS app

## Overview

Features:
 * relay cycle control for garage door opening
 * DHT22 temp/humidity readings
 * MQTT publishing
 * HTTP/MQTT RPC Control
 * Second relay control for lights

 # Relay Activation
 Relay activation simulates a doorbell button press, the relay turns on briefly, and this is turned off by the software.
 ## HTTP
 Issue an HTTP get like so, no paylaod is required. 
 ```bash
 curl http://192.168.1.xxx/rpc/SouthDoor.Activate
 ```

 ## MQTT RPC
 you can send a command via MQTT. This means you don't need to have a static IP for the device, but you will need to know its unique ID. I'm working on enabling auto-discovery in services like OpenHAB by leveraging via the [homie convention](https://homieiot.github.io).

In the example below, "alpha" is "correlation ID", that is, an identifier that will be echoed back by the node in response to an RPC request which will contain information about the node's response, errors, etc. 

 ```bash
 mqttpub -h 192.168.1.5 \
    -t esp8266_7E5E96/rpc  \
    '{id: 1, "src":"alpha", "method": "SouthDoor.Activate"}' 
 ```

## MQTT Trigger
TODO: It would be simpler in (especially for OpenHAB) if the relay activation could be triggered simply by the arrival of any message body `1` to a set topic, rather than having to craft and send a JSON document per MongooseOS' RPC requirements.

