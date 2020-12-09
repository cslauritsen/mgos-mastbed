load('api_gpio.js');
load('api_config.js');
load('api_rpc.js');
load('api_dht.js');
load('api_timer.js');
load('api_sensor_utils.js');
load('api_mqtt.js');
load('api_adc.js');

let device_id = Cfg.get('device.id');
let nm = Cfg.get('project.name');
let tr = 'homie/' + device_id + '/';

MQTT.pub(tr + '$homie', "4.0");
MQTT.pub(tr + '$name', nm);
MQTT.pub(tr + '$state', 'init');
MQTT.pub(tr + '$implementation', 'esp8266');
MQTT.pub(tr + '$nodes', 'dht22,south_door,north_door');

MQTT.pub(tr + 'dht22/$name', 'DHT22 Temp & Humidity Sensor');
MQTT.pub(tr + 'dht22/$type', 'DHT22');
MQTT.pub(tr + 'dht22/$properties', 'tempc,tempf,rh');

MQTT.pub(tr + 'dht22/tempf/$name', 'Temperature in Fahrenheit');
MQTT.pub(tr + 'dht22/tempf/$datatype', 'float');
MQTT.pub(tr + 'dht22/tempf/$settable', 'false');
MQTT.pub(tr + 'dht22/tempf/$unit', '°F');

MQTT.pub(tr + 'dht22/tempc/$name', 'Temperature in Celsius');
MQTT.pub(tr + 'dht22/tempc/$settable', 'false');
MQTT.pub(tr + 'dht22/tempc/$datatype', 'float');
MQTT.pub(tr + 'dht22/tempc/$unit', '°C');

MQTT.pub(tr + 'dht22/rh/$name', 'Relative Humidity');
MQTT.pub(tr + 'dht22/rh/$settable', 'false');
MQTT.pub(tr + 'dht22/rh/$datatype', 'float');
MQTT.pub(tr + 'dht22/rh/$unit', '%');

MQTT.pub(tr + 'south_door/$name', 'South Garage Door');
MQTT.pub(tr + 'south_door/$type', 'door');
MQTT.pub(tr + 'south_door/$properties', 'open,activate');
MQTT.pub(tr + 'south_door/open/$name', 'Door Open?');
MQTT.pub(tr + 'south_door/open/$settable', 'false');
MQTT.pub(tr + 'south_door/open/$datatype', 'boolean');
MQTT.pub(tr + 'south_door/activate/$name', 'Activate Door Opener');
MQTT.pub(tr + 'south_door/open/$settable', 'true');
MQTT.pub(tr + 'south_door/open/$datatype', 'boolean');

MQTT.pub(tr + 'north_door/$name', 'North Garage Door');
MQTT.pub(tr + 'north_door/$type', 'door');
MQTT.pub(tr + 'north_door/$properties', 'open');
MQTT.pub(tr + 'north_door/open/$name', 'Door Open?');
MQTT.pub(tr + 'north_door/open/$settable', 'false');
MQTT.pub(tr + 'north_door/open/$datatype', 'boolean');

MQTT.pub(tr + '$state', 'ready');

let dht_pin = Cfg.get('garage.dht_pin');
print('dht_pin:', dht_pin);
let pubInt = Cfg.get('garage.mqttPubInterval');
let dht = DHT.create(dht_pin, DHT.DHT22);
let counter = 0;

let n_door_contact = Cfg.get('garage.north_door_contact');
let s_door_contact = Cfg.get('garage.south_door_contact');
let s_door_activate = Cfg.get('garage.south_door_activation_pin');
let door_activate_millis = Cfg.get('garage.door_activate_millis');

// Garage relay is activated by shorting to ground
GPIO.set_pull(s_door_activate, GPIO.PULL_UP);
GPIO.setup_output(s_door_activate, 1);

/*
let contacts = [
   {pin: n_door_contact, nm: 'north', last_r: GPIO.read(n_door_contact)},
   {pin: s_door_contact, nm: 'south', last_r: GPIO.read(s_door_contact)}
   ];

let x;
for (x of contacts) {
  GPIO.set_pull(x.pin, GPIO.PULL_UP);
  GPIO.set_mode(x.pin, GPIO.MODE_INPUT);
  let v = GPIO.read(x.pin);
  MQTT.pub(device_id + '/contact/' + x.nm + '_door', JSON.stringify(v));
  GPIO.set_int_handler(n_door_contact, GPIO.INT_EDGE_ANY, function(pin) {
    let v = GPIO.read(pin);
    if (v !== x.last_r) {
      print('Pin', pin, 'got north door interrupt: ', v);
      let okrh = MQTT.pub(device_id + '/contact/' + x.nm + '_door', JSON.stringify(v)); 
    }
    x.last_r = v;
  }, null);
  GPIO.enable_int(n_door_contact); 

}
*/

GPIO.set_pull(n_door_contact, GPIO.PULL_UP);
GPIO.set_mode(n_door_contact, GPIO.MODE_INPUT);
let n_door_reading = GPIO.read(n_door_contact);
MQTT.pub(tr + 'north_door/open', n_door_reading === 0 ? 'false' : 'true');
GPIO.set_int_handler(n_door_contact, GPIO.INT_EDGE_ANY, function(pin) {
  let v = GPIO.read(pin);
  if (v !== n_door_reading) {
    print('Pin', pin, 'got north door interrupt: ', v);
    let okrh = MQTT.pub(device_id + '/contact/north_door', JSON.stringify(v)); 
    MQTT.pub(tr + 'north_door/open', v === 0 ? 'false' : 'true');
  }
  n_door_reading = v;
}, null);
GPIO.enable_int(n_door_contact); 

GPIO.set_pull(s_door_contact, GPIO.PULL_UP);
GPIO.set_mode(s_door_contact, GPIO.MODE_INPUT);
let s_door_reading = GPIO.read(s_door_contact);
MQTT.pub(tr + 'contact/south_door', s_door_reading === 0 ? 'false' : 'true');
GPIO.set_int_handler(s_door_contact, GPIO.INT_EDGE_ANY, function(pin) {
   let v = GPIO.read(pin);
   if (v !== s_door_reading) {
    print('Pin', pin, 'got south door interrupt: ', v);
    MQTT.pub(tr + 'contact/south_door', v === 0 ? 'false' : 'true');
   }
   s_door_reading = v;
}, null);
GPIO.enable_int(s_door_contact);

Timer.set(1000, true, function() {
  if (device_id === "unknown") {
    RPC.call(RPC.LOCAL, 'Sys.GetInfo', null, function(resp, ud) {
      device_id = resp.id;
      print('Response:', JSON.stringify(resp));
      print('device ID :', device_id);
    }, null);
  }

  let tempC = dht.getTemp();
  let tempF = SensorUtils.fahrenheit(tempC);
  let rh = dht.getHumidity();
  print('TempC:', tempC);
  print('TempF:', tempF);
  print('RHum%:', rh);
  print('dht_pin:', dht_pin);
  print('s_door_contact:', s_door_contact);
  print('device_id:', device_id);

  if (++counter % pubInt === 0) { 
    MQTT.pub(tr + 'dht22/rh', JSON.stringify(rh));
    MQTT.pub(tr + 'dht22/tempc', JSON.stringify(tempC));
    MQTT.pub(tr + 'dht22/tempf', JSON.stringify(tempF));

    let v = GPIO.read(s_door_contact);
    MQTT.pub(tr + 'south_door/open', v == 0 ? 'false' : 'true');
    v = GPIO.read(n_door_contact);
    MQTT.pub(tr + 'north_door/open', v == 0 ? 'false' : 'true');
  }
}, null);

RPC.addHandler('Temp.Read', function(args) {
  return { value: dht.getTemp() };
});

RPC.addHandler('TempF.Read', function(args) {
  return { value: SensorUtils.fahrenheit(dht.getTemp()) };
});

RPC.addHandler('RH.Read', function(args) {
  return { value: dht.getHumidity() };
});

RPC.addHandler('SouthDoor.Activate', function(args) {
  GPIO.write(s_door_activate, 0);
  // Toggle the pin after the activation interval
  Timer.set(door_activate_millis, 0, function() {
    GPIO.toggle(s_door_activate);
    print('Activate state off');
  }, null);
  return { value: "Activated" };
});