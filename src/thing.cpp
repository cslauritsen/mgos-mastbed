#include "all.h"

Thing::Thing(std::string aid, std::string aVersion, std::string aname, std::string aLocalIp, std::string aMac)
{
    id = aid;
    this->version = aVersion;
    name = aname;
    this->localIp = aLocalIp;
    this->setMac(aMac);
    topicBase = std::string("homie/") + id + "/";
    this->computePsk();
    extensions.push_back(std::string("org.homie.legacy-firmware:0.1.1:[4.x]"));
    lifecycleState = homie::INIT;

    this->motionPin = mgos_sys_config_get_pins_pir();
    mgos_gpio_set_mode(this->motionPin, MGOS_GPIO_MODE_INPUT);
    mgos_gpio_setup_input(this->motionPin, MGOS_GPIO_PULL_UP);

    this->dhtPin = mgos_sys_config_get_pins_dht();

    this->dht = mgos_dht_create(this->dhtPin, DHT22);

    this->dhtNode = new homie::Node(this, NODE_NM_DHT, "DHT22 Temp/Humidity Sensor", "DHT22");
    this->tempfProp = new homie::Property(this->dhtNode, PROP_NM_TEMPF, "Temp in Fahrenheit", homie::FLOAT, false);
    this->tempfProp->setUnit(homie::DEGREE_SYMBOL + "F");
    this->tempcProp = new homie::Property(dhtNode, PROP_NM_TEMPC, "Temp in Celsius", homie::FLOAT, false);
    this->tempcProp->setUnit(homie::DEGREE_SYMBOL + "C");
    this->rhProp = new homie::Property(this->dhtNode, PROP_NM_RH, "Relative Humidity", homie::FLOAT, false);
    this->rhProp->setUnit("%");

    this->pirNode = new homie::Node(this, NODE_NM_PIR, "Motion Detector", "PIR");
    this->motionProp = new homie::Property(this->pirNode, PROP_NM_MOTION, "Motion Detected", homie::BOOLEAN, false);
}

Thing::~Thing()
{
    mgos_dht_close(this->dht);
    this->dht = NULL;
    LOG(LL_INFO, ("Closed dht"));
}

bool Thing::readMotion()
{
    return mgos_gpio_read(this->motionPin) == 0 ? true : false;
}

void Thing::takeReading()
{
    float reading = mgos_dht_get_humidity(this->dht);
    if (isnan(reading))
    {
        LOG(LL_ERROR, ("rh read returned NaN"));
    }
    else
    {
        LOG(LL_DEBUG, ("rh read %2.1f", reading));
        this->rhProp->setValue(reading);
    }

    reading = mgos_dht_get_temp(this->dht);
    if (isnan(reading))
    {
        LOG(LL_ERROR, ("rh read returned NaN"));
    }
    else
    {
        LOG(LL_DEBUG, ("tempc read %2.1f", reading));
        this->tempcProp->setValue(reading);
        this->tempfProp->setValue(reading * 9.0f / 5.0f + 32.0f);
    }
    this->motionProp->setValue(readMotion());
}