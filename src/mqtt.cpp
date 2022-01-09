#include "all.h"

void homie::Device::publish(Message m)
{
    mgos_mqtt_pub(m.topic.c_str(), m.payload.c_str(), m.payload.length(), m.qos, m.retained);
    LOG(LL_DEBUG, ("pub t=%s", m.topic.c_str()));
}