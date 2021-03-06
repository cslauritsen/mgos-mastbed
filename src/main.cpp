#include "all.h"

static void int_motion_cb(int pin, void *obj) {
  Thing *thing = (Thing *)obj;
  int reading = mgos_gpio_read(pin);
  LOG(LL_DEBUG, ("Int pin %d: %d", pin, reading));

  double interrupt_millis = mgos_uptime() * 1000.0;
  if (abs(interrupt_millis - thing->motionDebounce) > 400) {
    thing->motionProp->publish();
  } else {
    LOG(LL_DEBUG, ("interrupt debounced pin %d", pin));
  }
  thing->motionDebounce = interrupt_millis;
}

static void rh_cb(struct mg_rpc_request_info *ri, void *cb_arg,
                  struct mg_rpc_frame_info *fi, struct mg_str args) {
  Thing *thing = (Thing *)cb_arg;
  mg_rpc_send_responsef(ri, "{ value: %s }", thing->rhProp->read().c_str());
  (void)fi;
}

static void tempf_cb(struct mg_rpc_request_info *ri, void *cb_arg,
                     struct mg_rpc_frame_info *fi, struct mg_str args) {
  Thing *thing = (Thing *)cb_arg;
  mg_rpc_send_responsef(ri, "{ value: %s }", thing->tempFProp->read().c_str());
  (void)fi;
}

static void motion_cb(struct mg_rpc_request_info *ri, void *cb_arg,
                      struct mg_rpc_frame_info *fi, struct mg_str args) {
  Thing *thing = (Thing *)cb_arg;
  mg_rpc_send_responsef(ri, "{ value: %s }", thing->motionProp->read().c_str());
  (void)fi;
}

static void spam_cb(void *arg) {
  LOG(LL_DEBUG, ("mqtt bytes: %d", mgos_mqtt_num_unsent_bytes()));
}

static void repeat_cb(void *arg) {
  Thing *thing = (Thing *)arg;
  int qos = 1;
  thing->rhProp->publish(qos);
  thing->tempFProp->publish(qos);
  thing->motionProp->publish(qos);
  thing->inquireNetConfig();
  thing->publishWifi();
}

static void sys_ready_cb(int ev, void *ev_data, void *userdata) {
  LOG(LL_INFO, ("Got system event %d", ev));
  Thing *thing = (Thing *)userdata;

  if (mgos_sys_config_get_homie_enable()) {
    thing->setLifecycleState(homie::INIT);
    thing->introduce(); // may require tuning of mqtt.max_queue_length
    thing->setLifecycleState(homie::READY);
    thing->publish(thing->getLifecycleMsg());
  }
}

enum mgos_app_init_result mgos_app_init(void) {
  LOG(LL_INFO, ("Startup %s", __FILE__));

  std::string projectName = std::string(mgos_sys_config_get_project_name());
  const char *deviceId = mgos_sys_config_get_device_id();
  int ofs = strlen(deviceId) - 6;
  const char *suffix = deviceId + ofs;
  auto homieId = std::string(projectName);
  homieId += "-";
  homieId += std::string(suffix);

  Thing *thing = new Thing(homieId, std::string(build_version), projectName);

  mgos_sys_config_set_mqtt_will_topic(thing->getLifecycleTopic().c_str());

  mgos_gpio_enable_int(thing->motionPin);
  mgos_gpio_set_int_handler(thing->motionPin, MGOS_GPIO_INT_EDGE_ANY,
                            int_motion_cb, thing);

  mg_rpc_add_handler(mgos_rpc_get_global(), "rh.read", NULL, rh_cb, thing);
  mg_rpc_add_handler(mgos_rpc_get_global(), "tempf.read", NULL, tempf_cb,
                     thing);
  mg_rpc_add_handler(mgos_rpc_get_global(), "motion.read", NULL, motion_cb,
                     thing);

  mgos_set_timer(mgos_sys_config_get_time_main_loop_millis(), 1, repeat_cb,
                 thing);
  mgos_set_timer(1000, 1, spam_cb, thing);

  // Register callback when sys init is complete
  mgos_event_add_handler(MGOS_EVENT_INIT_DONE, sys_ready_cb, thing);

  return MGOS_APP_INIT_SUCCESS;
}