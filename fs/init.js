load('api_gpio.js');
load('api_config.js');
load('api_rpc.js');
load('api_dht.js');
load('api_timer.js');
load('api_sensor_utils.js');
load('api_mqtt.js');
load('api_adc.js');

let dht_pin = Cfg.get('garage.dht_pin');
print('dht_pin:', dht_pin);
let pubInt = Cfg.get('garage.mqttPubInterval');
let dht = DHT.create(dht_pin, DHT.DHT22);
let counter = 0;

let n_door_contact = Cfg.get('garage.north_door_contact');
let s_door_contact = Cfg.get('garage.south_door_contact');
let s_door_activate = Cfg.get('garage.south_door_activation_pin');
let door_activate_millis = Cfg.get('garage.door_activate_millis');

let device_id = Cfg.get('device.id');

// Garage relay is activated by shorting to ground
GPIO.set_pull(s_door_activate, GPIO.PULL_UP);
GPIO.setup_output(s_door_activate, 1);

GPIO.set_pull(n_door_contact, GPIO.PULL_UP);
GPIO.set_mode(n_door_contact, GPIO.MODE_INPUT);
let n_door_reading = GPIO.read(n_door_contact);
MQTT.pub(device_id + '/contact/south_door', JSON.stringify(n_door_contact));
GPIO.set_int_handler(n_door_contact, GPIO.INT_EDGE_ANY, function(pin) {
  let v = GPIO.read(pin);
  if (v !== n_door_reading) {
    print('Pin', pin, 'got north door interrupt: ', v);
    let okrh = MQTT.pub(device_id + '/contact/north_door', JSON.stringify(v)); 
  }
  n_door_reading = v;
}, null);
GPIO.enable_int(n_door_contact); 

GPIO.set_pull(s_door_contact, GPIO.PULL_UP);
GPIO.set_mode(s_door_contact, GPIO.MODE_INPUT);
let s_door_reading = GPIO.read(s_door_contact);
MQTT.pub(device_id + '/contact/south_door', JSON.stringify(s_door_reading));
GPIO.set_int_handler(s_door_contact, GPIO.INT_EDGE_ANY, function(pin) {
   let v = GPIO.read(pin);
   if (v !== s_door_reading) {
    print('Pin', pin, 'got south door interrupt: ', v);
    let okrh = MQTT.pub(device_id + '/contact/south_door', JSON.stringify(v));
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

  //device_id = "garage";

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
    let okrh = MQTT.pub(device_id + '/sensor/rh', JSON.stringify(rh));
    print('rh mqtt message sent?', okrh);
    let oktempf = MQTT.pub(device_id + '/sensor/tempF', JSON.stringify(tempF));
    print('tempf mqtt message sent?', oktempf);
  }
}, null);

RPC.addHandler('Temp.Read', function(args) {
  return { value: dht.getTemp() };
});

RPC.addHandler('TempF.Read', function(args) {
  return { value: SensorUtils.fahrenheit(dht.getTemp()) };
});;

RPC.addHandler('RH.Read', function(args) {
  return { value: dht.getHumidity() };
});;

RPC.addHandler('SouthDoor.Activate', function(args) {
  GPIO.write(s_door_activate, 0);
  // Toggle the pin after the activation interval
  Timer.set(door_activate_millis, 0, function() {
    GPIO.toggle(s_door_activate);
    print('Activate state off');
  }, null);
  return { value: "Activated" };
});;