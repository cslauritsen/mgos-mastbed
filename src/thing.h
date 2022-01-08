#pragma once
#include "all.h"

class Thing : public homie::Device
{

public:
    uint8_t dhtPin;
    struct mgos_dht *dht;
    homie::Node *dhtNode;
    homie::Property *tempfProp;
    homie::Property *tempcProp;
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