'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { Zones, Zone } = require('./lib/zone.js');
const { Programs, Program } = require('./lib/program.js');

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

        this.zones = Zones.getInstance(this);
        await this.zones.initialize();
        this.log.info(`Get Zone list: ${JSON.stringify(this.zones.getzonelist())}`);

        this.progs = Programs.getInstance(this);
        await this.progs.initialize();

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info('config option1: ' + this.config.option1);
        //this.log.info('config option2: ' + this.config.option2);

        // Zones.create_zone(this, new Zone('Rasen hinten links', 'statedev', 'ontimedev', 60, true));
        // Zones.create_zone(this, new Zone('Rasen hinten rechts', 'statedev', 'ontimedev', 60, true));
        //Programs.create_program(this, new Program('Rasenflächen', ['Rasen hinten links', ['Rasen hinten rechts', 100]], false, true));
        //Programs.create_program(this, new Program('Rasenflächen', [{ 'name': 'Rasen hinten links', 'duration' : 0  }, 
        //                                                           { 'name': 'Rasen hinten rechts', 'duration': 100} ]));
        this.setState('info.connection', true, true);

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
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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
            this.zones.stateChange(id, state);
        }
    }

    onObjectChange(id, obj) {
        if (obj) {
            this.log.info(`object ${id} changed:  (${JSON.stringify(obj)})`);
            // Objekt geändert
        } else {
            this.log.info(`object ${id} deleted`);
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