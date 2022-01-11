#pragma once
#include "all.h"

class Thing : public homie::Device
{

public:
    uint8_t dhtPin;
    struct mgos_dht *dht;
    homie::Node *dhtNode;

    float tempC;
    void updateTempC();
    float rh;
    void updateRh();
    homie::Property *tempFProp;
    homie::Property *tempCProp;
    homie::Property *rhProp;
    homie::Node *pirNode;
    homie::Property *motionProp;
    uint8_t motionPin;
    void takeReading();
    bool readMotion();
    double motionDebounce;

    Thing(std::string aid, std::string aVersion, std::string aname);
    ~Thing();
};