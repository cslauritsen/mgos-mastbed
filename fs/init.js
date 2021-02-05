load('api_gpio.js');
load('api_config.js');
load('api_rpc.js');
load('api_dht.js');
load('api_timer.js');
load('api_sensor_utils.js');
load('api_log.js');

let tolowercase = function (s) {
  let ls = '';
  for (let i = 0; i < s.length; i++) {
      let ch = s.at(i);
      if (ch >= 0x41 && ch <= 0x5A)
          ch |= 0x20;
      ls += chr(ch);
  }
  return ls;
};


let nm = Cfg.get('project.name');
let device_id = Cfg.get('device.id');
let thing_id = nm + "-" + tolowercase(device_id.slice(device_id.length - 6, device_id.length));

// homie topic root
let tr = 'homie/' + thing_id + '/';
Cfg.set({mqtt: {will_topic: tr + '$state', will_message: "lost"}});
load('api_mqtt.js');

let dht_pin = Cfg.get('pins.dht');
let motion_pin = Cfg.get('pins.pir');
Log.info('dht_pin:'+ JSON.stringify(dht_pin));
Log.info('motion_pin:'+ JSON.stringify(motion_pin));
let pubInt = Cfg.get('project.mqttPubInterval');
let dht = DHT.create(dht_pin, DHT.DHT22);
let counter = 0;

let mgos_mqtt_num_unsent_bytes = ffi('int mgos_mqtt_num_unsent_bytes(void)');

let homie_setup_msgs = [
  {t: tr + '$homie', m: "4.0", qos: 1, retain: true},
  {t: tr + '$name',  m:nm, qos: 1, retain: true},
  {t: tr + '$state',  m:'init', qos: 1, retain: true},
  {t: tr + '$nodes',  m:'dht22,motion,system', qos: 1, retain: true},

  {t: tr + 'dht22/$name',  m:'DHT22 Temp & Humidity Sensor', qos: 1, retain: true},
  {t: tr + 'dht22/$type',  m:'DHT22', qos: 1, retain: true},
  {t: tr + 'dht22/$properties',  m:'tempc,tempf,rh', qos: 1, retain: true},

  {t: tr + 'dht22/tempf/$name',  m:'Temperature in Fahrenheit', qos: 1, retain: true},
  {t: tr + 'dht22/tempf/$datatype',  m:'float', qos: 1, retain: true},
  {t: tr + 'dht22/tempf/$settable',  m:'false', qos: 1, retain: true},
  {t: tr + 'dht22/tempf/$unit',  m:'°F', qos: 1, retain: true},

  {t: tr + 'dht22/tempc/$name',  m:'Temperature in Celsius', qos: 1, retain: true},
  {t: tr + 'dht22/tempc/$settable',  m:'false', qos: 1, retain: true},
  {t: tr + 'dht22/tempc/$datatype',  m:'float', qos: 1, retain: true},
  {t: tr + 'dht22/tempc/$unit',  m:'°C', qos: 1, retain: true},

  {t: tr + 'dht22/rh/$name',  m:'Relative Humidity', qos: 1, retain: true},
  {t: tr + 'dht22/rh/$settable',  m:'false', qos: 1, retain: true},
  {t: tr + 'dht22/rh/$datatype',  m:'float', qos: 1, retain: true},
  {t: tr + 'dht22/rh/$unit',  m:'%', qos: 1, retain: true},

  {t: tr + 'motion/$name',  m:'Motion Sensor', qos: 1, retain: true},
  {t: tr + 'motion/$type',  m:'motion', qos: 1, retain: true},
  {t: tr + 'motion/$properties',  m:'active', qos: 1, retain: true},
  {t: tr + 'motion/active/$name',  m:'Motion Detected?', qos: 1, retain: true},
  {t: tr + 'motion/active/$settable',  m:'false', qos: 1, retain: true},
  {t: tr + 'motion/active/$datatype',  m:'boolean', qos: 1, retain: true},

  {t: tr + 'system/$name',  m:'System Info', qos: 1, retain: true},
  {t: tr + 'system/$type',  m:'object', qos: 1, retain: true},
  {t: tr + 'system/$properties',  m:'ip', qos: 1, retain: true},
  {t: tr + 'system/ip/$name',  m:'IP Address?', qos: 1, retain: true},
  {t: tr + 'system/ip/$settable',  m:'false', qos: 1, retain: true},
  {t: tr + 'system/ip/$datatype',  m:'string', qos: 1, retain: true},

  {t: tr + '$state',  m:'ready', qos: 1, retain: true}
];

let homie_msg_ix = 0;
let homie_init = false;

let homie_setup_timer = 0;

// Asynchronously advance through the homie setup stuff until done
homie_setup_timer = Timer.set(Cfg.get("homie.pubinterval"), true, function() {
  if (!MQTT.isConnected()) {
    print('Waiting for MQTT connect...');
    return;
  }
  let br = mgos_mqtt_num_unsent_bytes();
  let maxbr = Cfg.get("mqtt.max_unsent");
  if (br > maxbr) {
    print('home setup: waiting for MQTT queue to clear: ', br);
  }
  if (homie_msg_ix >= 0 && homie_msg_ix < homie_setup_msgs.length) {
    let msg = homie_setup_msgs[homie_msg_ix];
    let ret = MQTT.pub(msg.t, msg.m, 2, msg.retain);
    if (ret === 0) {
      Log.error("homie pub failed");
    }
    else {
      // if publication was successful, on the next go around, send the next message
      homie_msg_ix += 1;
    }
  }
}, null);

GPIO.set_pull(motion_pin, GPIO.PULL_UP);
GPIO.set_mode(motion_pin, GPIO.MODE_INPUT);
GPIO.set_int_handler(motion_pin, GPIO.INT_EDGE_ANY, function(pin) {
  MQTT.pub(tr + 'motion/active', JSON.stringify(GPIO.read(pin) ? true : false));
}, null);
GPIO.enable_int(motion_pin); 

Timer.set(Cfg.get('time.main_loop_millis'), true, function() {
  let sdata = {
    dht22: {
      celsius: dht.getTemp(),
      fahrenheit: SensorUtils.fahrenheit(dht.getTemp()),
      rh: dht.getHumidity(),
    },
    motion: {
      active: (GPIO.read(motion_pin) ? true : false)
    }
  };

  Log.print(Log.INFO, "Motion: " + JSON.stringify(sdata.motion.active)
    + " TempF: " + JSON.stringify(sdata.dht22.fahrenheit)); 

  // don't publish data until the homie setup is finished
  if (homie_msg_ix >= homie_setup_msgs.length - 1) {
    MQTT.pub(tr + '$state', 'ready', 1, true);
    MQTT.pub(tr + 'dht22/rh', JSON.stringify(sdata.dht22.rh));
    MQTT.pub(tr + 'dht22/tempc', JSON.stringify(sdata.dht22.celsius));
    MQTT.pub(tr + 'dht22/tempf', JSON.stringify(sdata.dht22.fahrenheit));
    MQTT.pub(tr + 'motion/active', JSON.stringify(sdata.motion.active));

    // Cancel the other timer, as it's no longer needed
    if (homie_setup_timer !== 0) {
      Log.info("Homie setup timer finished, canceling");
      Timer.del(homie_setup_timer);
      homie_setup_timer = 0;
    }
  }
}, null);

// *****************************************************************
// RPC Handler Registration 
//
RPC.addHandler('Temp.Read', function(args) {
  return { value: dht.getTemp() };
});

RPC.addHandler('TempF.Read', function(args) {
  return { value: SensorUtils.fahrenheit(dht.getTemp()) };
});

RPC.addHandler('RH.Read', function(args) {
  return { value: dht.getHumidity() };
});

RPC.addHandler('Motion.Read', function(args) {
  return { value: GPIO.read(motion_pin) ? true : false };
});