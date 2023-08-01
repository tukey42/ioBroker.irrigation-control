![Logo](admin/irrigation-control.png)
# ioBroker.irrigation-control

[![NPM version](https://img.shields.io/npm/v/iobroker.irrigation-control.svg)](https://www.npmjs.com/package/iobroker.irrigation-control)
[![Downloads](https://img.shields.io/npm/dm/iobroker.irrigation-control.svg)](https://www.npmjs.com/package/iobroker.irrigation-control)
![Number of Installations](https://iobroker.live/badges/irrigation-control-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/irrigation-control-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.irrigation-control.png?downloads=true)](https://nodei.co/npm/iobroker.irrigation-control/)

**Tests:** ![Test and Release](https://github.com/tukey42/ioBroker.irrigation-control/workflows/Test%20and%20Release/badge.svg)

## irrigation-control adapter for ioBroker

This adapter is able to define and control irrigation schedules.

It allows to define zones which are mapped to ioBroker devices and will uses ON_TIME or similar if possible to avoid flooding your garden, if the system crashes or similar.
Multiple zones can run in parallel if needed. In addition it allows to define programs, which will control the zones.
In a later phase the weather will influence the length of watering.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* (Stefan Köhler) initial release

## License
MIT License

Copyright (c) 2023 Stefan Köhler <tukey42@t-online.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.