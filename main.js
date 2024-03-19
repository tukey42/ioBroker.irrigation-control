'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { Zones, Zone } = require('./lib/zone.js');
const { Programs, Program } = require('./lib/program.js');
const { Schedules, Schedule } = require('./lib/schedule.js');
const Weather = require('./lib/weather.js');

/*
Zone:

Nummer
Name
STATE Device
ON_TIME Device
Standardmäßige Bewässerungszeit

Programm:
Name
Zonenliste
Liste Bewässerungszeit
Parallel/Sequentiell
enable/disable
program läuft


Schedule:
wochentag Uhrzeit, ....

Zonenliste:
program Nummer
Zonennummer
Order
mit/nach vorhergegangenen
Bewässerungszeit
Wetterabhängig

Wetterbeeinflussung:
Temperatur
Wind
Regen
Vorhersage
*/

class IrrigationControl extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'irrigation-control',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));

    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);

        this.log.debug('Config data: ' + JSON.stringify(this.config));

        this.zones = Zones.getInstance(this);
        this.progs = Programs.getInstance(this);
        this.schedules = Schedules.getInstance(this);
        this.weather = Weather.getInstance(this);

        await Zones.create_config(this.config.zones);
        await Programs.create_config(this.config.programs);
        await Schedules.create_config(this.config.schedules);

        await this.zones.initialize();
        await this.progs.initialize();
        await this.schedules.initialize();
        await this.weather.initialize();

        //Zones.create_zone(this, new Zone('Rasen hinten links', 'statedev', 'ontimedev', 60, true));
        //Zones.create_zone(this, new Zone('Rasen hinten rechts', 'statedev', 'ontimedev', 60, true));
        //Programs.create_program(this, new Program('Rasenflächen', [{ 'name': 'Rasen hinten links', 'duration' : 0  }, { 'name': 'Rasen hinten rechts', 'duration': 100} ], false, true));
        //Programs.create_program(this, new Program('Beete', [{ 'name': 'Rasen hinten links', 'duration' : 5  }, { 'name': 'Rasen hinten rechts', 'duration': 8} ], false, true));
        //Schedules.create_schedule(this, new Schedule('Test 1', '* * * * 0,10,20,30,40,50', 'Rasenflächen'));
        this.setState('info.connection', true, true);
        this.setState('info.active', 0, true);
        this.log.info('IrrigationControl adapter started');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            if (this.zones) this.zones.stopAll();
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.debug(`state ${id} deleted`);
        }
        if (!this.zones || !this.progs) return;
        if (id.startsWith(this.namespace)) {
            const comp = id.split('.');
            const i = id.substring(this.namespace.length+1);
            if (comp[2] == 'zones' && this.zones) {
                this.zones.stateChange(i, state);
                this.progs.zoneChange(i, state);
            }
            if (comp[2] == 'programs' && this.progs) this.progs.stateChange(i, state);
        } else {
            if (id == this.config.rainSensor) {
                this.weather.stateChange(id, state);
            } else {
                this.zones.stateChange(id, state);
            }
        }
    }

    onObjectChange(id, obj) {
        if (obj) {
            this.log.debug(`object ${id} changed:  (${JSON.stringify(obj)})`);
            // Objekt geändert
        } else {
            this.log.debug(`object ${id} deleted`);
            // Objekt gelöscht
        }
    }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new IrrigationControl(options);
} else {
    // otherwise start the instance directly
    new IrrigationControl();
}