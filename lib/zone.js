'use strict';

const config2object = require('./config.js');

const statelist = [
	{ "name" : "state_device", "type" : "string", "role" : "text" },
	{ "name" : "ontime_device", "type" : "string", "role" : "text" },
	{ "name" : "default_ontime", "type" : "number", "role" : "value.interval" },
	{ "name" : "enabled", "type" : "boolean", "role" : "indicator" },
	{ "name" : "state",  "type" : "boolean", "role" : "state" }
];

let gadapter;

const device_name = "zones";

class Zones {
	zonelist = [];
	static instance;

	/*
	 * State List:
	 * name
	 * state_device
	 * ontime_device
	 * default_ontime
	 * enabled
	 * state
	 * timeout
	 */

	/**
	 * @param {any} adapter
	 */
	constructor (adapter) {
		this.adapter = adapter;
		gadapter = adapter;
	}

	static getInstance(adapter) {
		if (!Zones.instance) {
			Zones.instance = new Zones(adapter);
		}
		return Zones.instance;
	}

	async initialize() {
		try {
			const list = await this.adapter.getChannelsAsync(device_name);
            this.adapter.log.debug("channel list for zones: " + JSON.stringify(list));
			for (let z of list) {
				this.adapter.log.debug(`Getting states for channel ${z.common.name}`);
				const slist = await this.adapter.getStatesOfAsync(device_name, z.common.name);
				let zone = new Zone(z.common.name);
				this.zonelist.push(zone);
				for (let s of slist) {
					this.adapter.log.info(`Getting value for state ${s.common.name}`);
					const obj = await this.adapter.getStateAsync(s._id);
					if (s.common.name == 'state') {
						await this.adapter.subscribeStatesAsync(s._id);
					}
					if (s.common.name == 'state_device') {
						await this.adapter.subscribeForeignStatesAsync(obj.val);
					}
					this.adapter.log.debug(`state value ${s._id}: ` + JSON.stringify(obj));
					zone[s.common.name] = obj.val;
				}
			}		
		} catch(err) {
			throw new Error(`Cannot initialize zones: ${err}`);
		}
	}


	getzonelist() {
		return this.zonelist;
	}

	getZone(id) {
		/*
		for (let z of this.zonelist) {
			gadapter.log.debug(`getZone, id=${id}, ${device_name}.${z.name}.state`);
			if (z.name == id || z.state_device == id || z.ontime_device == id || `${device_name}.${z.name}.state` == id) {
				return z;
			}
		}
		return 0;
		*/
		return this.zonelist.find(z => (z.name == id || z.state_device == id || z.ontime_device == id || `${device_name}.${z.name}.state` == id));
	}

	async stateChange(id, state) {
		const z = this.getZone(id);
		gadapter.log.info(`(Zone) State change ${id}, zone: ${z.name}, state: ${state}`);
		
		if (!z || !state) return;

		if (id.startsWith(device_name)) {
			if (!state.ack) {
				gadapter.log.debug(`do zone: ${state.val}`);
				if (state.val) {
					z.start();
				} else {
					z.stop();
				}
			}
		} else {
			if (state.ack) {
				await this.adapter.setStateAsync(`${this.adapter.namespace}.${device_name}.${z.name}.state`, state.val, true);
			}
		}
	}


	async stopAll() {
		gadapter.log.info('Stopping all zones');
		for (let z of this.zonelist) {
			if (z.timeout) {
				clearTimeout(z.timeout);
				await this.adapter.setForeignStateAsync(z.state_device, false);
				z.timeout = null;
			}
		}
	}

	static async create_config(conflist) {
		gadapter.log.info("=============== Creating config for zones ============");
		await config2object(gadapter, conflist, device_name, statelist);
	}


	static async create_zone(adapter, zone) {
		try {
			const obj = await adapter.createChannelAsync(device_name, zone.name);
			if (obj != undefined) {
				adapter.log.info(`Zone ${zone.name} created (${JSON.stringify(obj)})`);
				for (let s of statelist) {
					await adapter.setObjectNotExistsAsync(`${obj.id}.${s.name}`, {
						type: 'state',
						common: {
							name: s.name,
							type: s.type,
							role: s.role,
							read: true,
							write: true,
						},
						native: {},
					});
					await adapter.setStateAsync(`${obj.id}.${s.name}`, {val: zone[s.name], ack: true});
				}
			}
		} catch (err) {
			adapter.log.error(`Cannot create zone ${zone.name}, err: ${err}`);
		}
	}
}

class Zone {
	name;
	state_device;
	ontime_device;
	default_ontime;
	enabled;
	timeout;


	constructor (name, state_device = null, ontime_device = null, default_ontime = 0, enabled = false) {
		this.name = name;
		this.state_device = state_device;
		this.ontime_device = ontime_device;
		this.default_ontime = default_ontime;
		this.enabled = enabled;
		this.timeout = null;
	}

	async start(timo = 0, factor = 1) {

		if (!this.enabled) return;
		if (timo == 0) timo = this.default_ontime;
		timo = timo * factor;
		gadapter.log.info(`Zone ${this.name} start (timo=${timo}), ontime=${this.ontime_device}`);
		if (this.ontime_device) {
			await gadapter.setForeignStateAsync(this.ontime_device, timo);
		}
		await gadapter.setForeignStateAsync(this.state_device, true);
		if (!this.ontime_device) {
			this.timeout = setTimeout(() =>  {  this.stop();}, timo * 1000);
		}
	}

	async stop() {
		gadapter.log.info(`Zone ${this.name} stopped`);
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		await gadapter.setForeignStateAsync(this.state_device, false);
	}

	zlog(str) {
		gadapter.log.debug(`########### ZLOG DEBUG (${this.name}): + ${str}`);
	}
}

module.exports = { Zones, Zone };
