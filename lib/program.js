'use strict';

const { Zones, Zone } = require('./zone.js');
const config2object = require('./config.js');
const Weather = require('./weather.js');

const statelist = [
	{ "name" : "zone_list", "type" : "array", "role" : "list" },
	{ "name" : "parallel", "type" : "boolean", "role" : "value.interval" },
	{ "name" : "weather", "type" : "boolean", "role" : "value.interval" },
	{ "name" : "enabled", "type" : "boolean", "role" : "indicator" },
	{ "name" : "running",  "type" : "boolean", "role" : "state" }
];


const device_name = "programs";
let gadapter;

class Programs {
	proglist = [];
	static instance;
	runqueue = [];
	weather;

	constructor (adapter) {
		this.adapter = adapter;
		gadapter = adapter;
	}

	static getInstance(adapter) {
		if (!Programs.instance) {
			Programs.instance = new Programs(adapter);
		}
		return Programs.instance;
	}

	async initialize() {
		try {
			this.weather = Weather.getInstance();
			this.weather.setRainingCallback(this.stop_all_programs.bind(this));
			const list = await this.adapter.getChannelsAsync(device_name);
            gadapter.log.debug("Channel list for programs: " + JSON.stringify(list));
			for (let p of list) {
				gadapter.log.debug(`Getting states for channel ${p.common.name}`);
				const slist = await this.adapter.getStatesOfAsync(device_name, p.common.name);
				//gadapter.log.info(`SObj: ${JSON.stringify(slist)}`);
				var a = {};
				for (let s of slist) {
					gadapter.log.debug(`Getting value for state ${s.common.name} (id: ${s._id})`);
					const obj = await this.adapter.getStateAsync(s._id);
					if (s.common.name == 'running') {
						await this.adapter.subscribeStatesAsync(s._id);
					}
					this.adapter.log.debug(`State value ${s._id}: ` + JSON.stringify(obj));
					a[s.common.name] = obj.val;
				}
				if (a.hasOwnProperty('zone_list') && a.hasOwnProperty('parallel') && a.hasOwnProperty('enabled') && a.hasOwnProperty('weather')) {
					let z = JSON.parse(a.zone_list);
					let prog = new Program(p.common.name, z, a.parallel, a.enabled, a.weather);
					this.proglist.push(prog);	
					gadapter.log.info(`Program ${prog.name} created`);				
				} else {
					gadapter.log.warn(`Cannot create program ${p.common.name}, because some values are missing`);					
				}
			}			
		} catch(err) {
			gadapter.log.error(`Cannot initialize programs: ${err}`);
		}
	}

	async stop_all_programs() {
		gadapter.log.info(`Stopping all programs: ${JSON.stringify(this.proglist)}`);
		for (let p of this.proglist) {
			this.stopProgram(p);
		}
	}

	/*
	dumpAllProgs(str) {
		for (let p of this.proglist) {
			const az = p.allZones();
			for (const z of az) {
				gadapter.log.debug(`DEBUG METHODS ${str} Program ${p.name} zone ${z.name} `+ JSON.stringify( Object.getOwnPropertyNames(Object.getPrototypeOf(z.zone))));
			}
	
		}
	}
	*/

	getProgram(id) {		
		const c = id.split('.');
		if (c.length == 3) id = c[1];
		for (let p of this.proglist) {
			if (p.name == id) {
				return p;
			}
		}
		return null;
	}

	async stateChange(id, state) {
		const p = this.getProgram(id);
		gadapter.log.info(`State change (program) ${id} (${p.name}), state: ` + JSON.stringify(state));
		
		if (!p || !state) {
			return;
		}

		if (state.val) {
			if (!p.isRunning())	this.startProgram(p, true);
		} else {
			if (p.isRunning()) this.stopProgram(p);
		} 
	}

	async zoneChange(id, state) {
		const p = this.activeProgram();
		if (p) {
			gadapter.log.info(`Zone Change (program) ${id} (${p.name}), state: ${state.val}`);
			if (state.val == false) {
				if (!await p.nextZone(id)) {
					gadapter.log.info(`Program ${p.name} finished, handle next in queue`);
					this.runqueue.shift();
					this.handlequeue();
				}
			}
		}
	}

	async startProgram(p, force = false) {
		if (!p.isEnabled()) {
			gadapter.log.info(`Program ${p.name} is disabled`);
			return;
		}
		// check weather
		if (!force && this.weather.isRaining()) {
			await gadapter.setStateAsync(`${gadapter.namespace}.${device_name}.${p.name}.running`, false, true);
			gadapter.log.info(`Program ${p.name} not started because auf rain`);
			return;
		}
		gadapter.log.info(`Queueing program ${p.name}`);
		this.runqueue.push(p);
		//await gadapter.setStateAsync(`${gadapter.namespace}.${device_name}.${p.name}.running`, true, true);
		p.active = 0;
		this.handlequeue();
	}

	activeProgram() {
		return this.runqueue[0];
	}

	async handlequeue() {
		const p = this.activeProgram();

		gadapter.log.debug(`Handle program queue, next program: ${p?p.name:'none'}, zone active: ${p?p.zoneActive():'none'}`);

		if (!p || p.zoneActive()) return;

		p.start(await this.weather.condition());


	}

	async stopProgram(p) {
		p.stop();
	}

/*
	{ "name" : "zone_list", "type" : "array", "role" : "list" },
	{ "name" : "parallel", "type" : "boolean", "role" : "value.interval" },
	{ "name" : "weather", "type" : "boolean", "role" : "value.interval" },
	{ "name" : "enabled", "type" : "boolean", "role" : "indicator" },
	{ "name" : "running",  "type" : "boolean", "role" : "state" }
*/
	static async create_config(conflist) {
		// convert programs
		let newcl = [];
		// name, zone, duration, parallel, weather, enabled

		for (const p of conflist) {
			let np;
			if (np = newcl.find(x => x.name == p.name)) {
				np.zone_list.push({ name: p.zone, duration: p.duration});
			} else {
				newcl.push({ name: p.name, zone_list: [{ name: p.zone, duration: p.duration }], parallel: p.parallel, weather: p.weather, enabled: p.enabled});
			}
		}
		await config2object(gadapter, newcl, device_name, statelist);
	}

	static async create_program(adapter, prog) {
		try {
			const obj = await adapter.createChannelAsync(device_name, prog.name);
			if (obj != undefined) {
				adapter.log.info(`Program ${prog.name} created (${JSON.stringify(obj)})`);
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

					let v = prog[s.name];
					if (s.name == "zone_list") {
						for (let z of v) {
							delete z.zone;
						}
						v = JSON.stringify(prog[s.name]);
					}
					await adapter.setStateAsync(`${obj.id}.${s.name}`, {val: v, ack: true});
				}
			}
		} catch (err) {
			adapter.log.error(`Cannot create program ${prog.name}, err: ${err}`);
		}
	}
}
	

class Program {
	name;
	zone_list;
	parallel;
	enabled;
	active;
	weather;
	running;
	factor;


	/**
	 * @param {any} name
	 */
	constructor (name, zone_list = [], parallel = false, enabled = false, weather = false) {
		this.name = name;
		const zones = Zones.getInstance();
		this.zone_list = Array();
		for (let z of zone_list) {
			z.zone = zones.getZone(z.name);
			z.running = false;
			this.zone_list.push(z);
		}
		this.parallel = parallel;
		this.enabled = enabled;
		this.weather = weather;
		this.active = 0;
		this.running = false;
		this.factor = 1;
	}


	async start(factor) {
		gadapter.log.info(`Starting Program ${this.name} (${this.isParallel()?'parallel':'serial'}) (factor: ${factor})`);
		this.factor = this.weather ? factor : 1;
		if (this.isParallel()) {
			const az = this.allZones();
			for (const z of az) {
				z.zone.start(z.duration, this.factor);
				z.running = true;
			}
		} else {
			this.active = 1;
			const z = this.activeZone();
			if (z) {
				z.zone.start(z.duration, this.factor);
				z.running = true;
			}
		}
		this.running = true;
		await gadapter.setStateAsync(`${gadapter.namespace}.${device_name}.${this.name}.running`, true, true);
	}

	async stop() {
		if (this.isRunning()) {
			if (this.isParallel()) {
				const az = this.allZones();
				for (const z of az) {
					gadapter.log.info(`Program ${this.name} stopped, stopping zone ${z.name}`);
					z.zone.stop();
					z.running = false;
				}
			} else {
				const z = this.activeZone();
				if (z) {
					gadapter.log.info(`Program ${this.name} stopped, stopping zone ${z.name}`);
					z.zone.stop();
					z.running = false;
				}
			}
			this.running = false;
			this.active = 0;
			await gadapter.setStateAsync(`${gadapter.namespace}.${device_name}.${this.name}.running`, false, true);
		}
	}

	isRunning() {
		return this.running;
	}

	isWeather() {
		return this.weather;
	}


	zoneActive() {
		return this.active;
	}

	async nextZone(id) {
		const zl = this.zone_list;
		const c = id.split('.');
		if (c.length == 3) id = c[1];
		gadapter.log.debug("nextZone called with id: " + id);
		if (this.isParallel()) {
			for (const z of zl) {
				if (z.name == id) {
					z.running = false;
				}
				gadapter.log.debug(`nextZone parallel, zone ${z.name} is running ${z.running}`);
				if (z.running) return true; // wait until all zones stoped
			}
			this.active = 0;
			this.running = false;
			await gadapter.setStateAsync(`${gadapter.namespace}.${device_name}.${this.name}.running`, false, true);
			return false;
		} else {
			let act_zone = zl[this.active-1];
			if (act_zone.name != id) {
				gadapter.log.debug("nextZone called, but id (" + id + ") and act_zone (" +  act_zone.name + ") are different, ignoring");
				return true;
			}
			if (!act_zone.running) {
				gadapter.log.warn("nextZone called even if zone is not running" + act_zone.name);
			}
			act_zone.running = false;
			if (++this.active > zl.length) {
				this.active = 0;
				this.running = false;
				await gadapter.setStateAsync(`${gadapter.namespace}.${device_name}.${this.name}.running`, false, true);
				return false;
			} else {
				let new_zone = zl[this.active-1];
				gadapter.log.info(`Starting next zone of program ${this.name}: ${new_zone.name}`);
				new_zone.zone.start(new_zone.duration, this.factor);
				new_zone.running = true;
				return true;
			}
		}
	}

	isParallel() {
		return this.parallel;
	}

	isEnabled() {
		return this.enabled;
	}

	activeZone() {
		let zl = this.zone_list;
		if (this.active > 0 && zl.length >= this.active) {
			let a = zl[this.active-1];
			gadapter.log.debug("activeZone returns " + a.zone.name);
			return a;
		}
		return null;
	}

	allZones() {
		return this.zone_list;
	}
}


module.exports = { Programs, Program };
