#include "all.h"

static std::string f2s(float f) {
    char buf[10];
    sprintf(buf, "%5.1f", f);
    return std::string(buf);
}

Thing::Thing(std::string aid, std::string aVersion, std::string aname)
    : homie::Device(aid, aVersion, aname)
{
    this->motionPin = mgos_sys_config_get_pins_pir();
    mgos_gpio_set_mode(this->motionPin, MGOS_GPIO_MODE_INPUT);
    mgos_gpio_setup_input(this->motionPin, MGOS_GPIO_PULL_UP);

    this->dhtPin = mgos_sys_config_get_pins_dht();
    mgos_gpio_set_mode(this->dhtPin, MGOS_GPIO_MODE_INPUT);

    this->dht = mgos_dht_create(this->dhtPin, DHT22);

    this->dhtNode = new homie::Node(this, NODE_NM_DHT, "DHT22 Temp/Humidity Sensor", "DHT22");

    // Fahrenheit
    this->tempfProp = new homie::Property(this->dhtNode, PROP_NM_TEMPF, "Temp in Fahrenheit", homie::FLOAT, false);
    this->tempfProp->valueFunction = [this]()
    {
        float reading = mgos_dht_get_temp(this->dht);
        std::string ret;
        if (isnan(reading))
        {
            LOG(LL_ERROR, ("tempf read returned NaN"));
        }
        else
        {
            LOG(LL_ERROR, ("tempf read %2.1f", reading));
            reading = homie::to_fahrenheit(reading);
            ret = f2s(reading);
        }
        return ret;
    };
    this->tempfProp->setUnit(homie::DEGREE_SYMBOL + "F");

    // Celsius
    this->tempcProp = new homie::Property(dhtNode, PROP_NM_TEMPC, "Temp in Celsius", homie::FLOAT, false);
    this->tempcProp->valueFunction = [this]()
    {
        std::string ret;
        float reading = mgos_dht_get_temp(this->dht);
        if (isnan(reading))
        {
            LOG(LL_ERROR, ("tempc read returned NaN"));
        }
        else
        {
            LOG(LL_DEBUG, ("tempc read %2.1f", reading));
            ret = f2s(reading);
        }
        return ret;
    };
    this->tempcProp->setUnit(homie::DEGREE_SYMBOL + "C");

    // Humidity
    this->rhProp = new homie::Property(this->dhtNode, PROP_NM_RH, "Relative Humidity", homie::FLOAT, false);
    this->rhProp->valueFunction = [this]()
    {
        float reading = mgos_dht_get_humidity(this->dht);
        std::string ret;
        if (isnan(reading))
        {
            LOG(LL_ERROR, ("rh read returned NaN"));
        }
        else
        {
            LOG(LL_DEBUG, ("rh read %2.1f", reading));
            ret = f2s(reading);
        }
        return ret;
    };
    this->rhProp->setUnit("%");

    this->pirNode = new homie::Node(this, NODE_NM_PIR, "Motion Detector", "PIR");
    this->motionProp = new homie::Property(this->pirNode, PROP_NM_MOTION, "Motion Detected", homie::BOOLEAN, false);
    this->motionProp->valueFunction = [this]()
    { return std::string(mgos_gpio_read(this->motionPin) == 0 ? "false" : "true"); };
}

Thing::~Thing()
{
    mgos_dht_close(this->dht);
    this->dht = NULL;
    LOG(LL_INFO, ("Closed dht"));
}