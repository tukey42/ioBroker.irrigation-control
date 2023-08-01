'use strict';

const { Programs, Program } = require('./lib/program.js');
const nodeSchedule = require('node-schedule');

let gadapter;

const device_name = "schedules";

const statelist = [
	{ "name" : "schedule", "type" : "string", "role" : "text" },
	{ "name" : "program", "type" : "string", "role" : "text" },
	{ "name" : "enabled", "type" : "boolean", "role" : "indicator" }
];

class Schedules {
	schedules = [];

	/*
	 * State List:
	 * name
	 * schedule
	 * program
	 * enabled
	 */

	/**
	 * @param {any} adapter
	 */
	constructor (adapter) {
		this.adapter = adapter;
		gadapter = adapter;
	}

	static getInstance(adapter) {
		if (!this.instance) {
			this.instance = new Schedules(adapter);
		}
		return this.instance;
	}

	async initialize() {
		try {
			const list = await this.adapter.getChannelsAsync(device_name);
            this.adapter.log.debug("channel list for schedules: " + JSON.stringify(list));
			for (let z of list) {
				this.adapter.log.debug(`Getting states for channel ${z.common.name}`);
				const slist = await this.adapter.getStatesOfAsync(device_name, z.common.name);
				//let zone = new Zone(z.common.name);
				//this.zonelist.push(zone);
				for (let s of slist) {
					this.adapter.log.info(`Getting value for state ${s.common.name}`);
					const obj = await this.adapter.getStateAsync(s._id);

					this.adapter.log.debug(`state value ${s._id}: ` + JSON.stringify(obj));
					zone[s.common.name] = obj.val;
				}
			}		
		} catch(err) {
			throw new Error(`Cannot initialize zones: ${err}`);
		}
	}


	getschedules() {
		return this.schedules;
	}

	getSchedule(id) {
		for (let z of this.zonelist) {
			gadapter.log.debug(`getSchedule, id=${id}, ${device_name}.${z.name}.state`);
			if (z.name == id || z.state_device == id || z.ontime_device == id || `${device_name}.${z.name}.state` == id) {
				return z;
			}
		}
		return 0;
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

	/**
	 * @param {this} adapter
	 * @param {Zone} zone
	 */
	static async create_schedule(adapter, schedule) {
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

class Schedule {
	name;



	constructor (name, state_device = null, ontime_device = null, default_ontime = 0, enabled = false) {
		this.name = name;
		this.state_device = state_device;
		this.ontime_device = ontime_device;
		this.default_ontime = default_ontime;
		this.enabled = enabled;
		this.timeout = null;
	}

	async start(timo = 0) {

		if (!this.enabled) return;
		if (timo == 0) timo = this.default_ontime;
		gadapter.log.info(`Zone ${this.name} start (timo=${timo})`);
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
