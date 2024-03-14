'use strict';

const { Programs, Program } = require('./program.js');
const nodeSchedule = require('node-schedule');
const config2object = require('./config.js');

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
	 * job
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
			for (let sc of list) {
				this.adapter.log.debug(`Getting states for channel ${sc.common.name}`);
				const slist = await this.adapter.getStatesOfAsync(device_name, sc.common.name);

				var a = {};
				for (let s of slist) {
					this.adapter.log.debug(`Getting value for s ${s.common.name}`);
					const obj = await this.adapter.getStateAsync(s._id);

					this.adapter.log.info(`state value ${s._id}: ` + JSON.stringify(obj));
					a[s.common.name] = obj.val;
				}
				if (a.hasOwnProperty('schedule') && a.hasOwnProperty('program') && a.hasOwnProperty('enabled')) {
					let sched = new Schedule(sc.common.name, a.schedule, a.program, a.enabled);
					this.schedules.push(sched);	
					this.adapter.log.info(`Schedule ${sched.name} created`);				
				} else {
					this.adapter.log.error(`Cannot create schedule ${sc.common.name}, because some values are missing`);					
				}
			}		
		} catch(err) {
			this.adapter.log.error(`Cannot initialize schedules: ${err}`);
			return;
		}
		await this.startAll();
	}


	getschedules() {
		return this.schedules;
	}

	getSchedule(id) {
		for (let z of this.schedules) {
			gadapter.log.debug(`getSchedule, id=${id}, ${device_name}.${z.name}`);
			if (z.name == id || `${device_name}.${z.name}` == id) {
				return z;
			}
		}
		return 0;
	}

	async startAll() {
		gadapter.log.info('Starting all schedules');
		this.schedules.forEach(function(s) { s.start();});
	}

	async stopAll() {
		gadapter.log.info('Stopping all schedules');
		await nodeSchedule.gracefulShutdown();
	}

	static async create_config(conflist) {
		gadapter.log.info("=============== Creating config for schedules ============");
		await config2object(gadapter, conflist, device_name, statelist);
	}

	static async create_schedule(adapter, schedule) {
		try {
			const obj = await adapter.createChannelAsync(device_name, schedule.name);
			if (obj != undefined) {
				adapter.log.info(`Schedule ${schedule.name} created (${JSON.stringify(obj)})`);
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
					await adapter.setStateAsync(`${obj.id}.${s.name}`, {val: schedule[s.name], ack: true});
				}
			}
		} catch (err) {
			adapter.log.error(`Cannot create schedule ${schedule.name}, err: ${err}`);
		}
	}
}

class Schedule {
	name;
	schedule;
	program;
	enabled;
	job;

	constructor (name, schedule, program, enabled = false) {
		this.name = name;
		this.schedule = schedule;
		let programs = Programs.getInstance();
		this.program = programs.getProgram(program);
		this.enabled = enabled;
		this.job = null;
	}

	async scheduler(job) {
		gadapter.log.debug(`Queueing program ${this.name}`);
		let programs = Programs.getInstance();
		await programs.startProgram(programs.getProgram(this.name));
	}

	async start() {

		if (!this.enabled || !this.schedule || !this.program) return;

		if (this.job) {
			gadapter.log.error('Scheduler for ${this.name} already running');
			return;
		}

		gadapter.log.info(`Schedule ${this.name} started (${this.schedule})`);
		this.job = nodeSchedule.scheduleJob(this.program.name, this.schedule, this.scheduler);
		if (this.job) {
			let d = this.job.nextInvocation();
			gadapter.log.info(`Next Job invocation is: ${d.toDate().toString()}`);
		} else {
			gadapter.log.error('Cannot create job scheduler');
		}
	}

	async stop() {
		gadapter.log.info(`Schedule ${this.name} stopped`);
		if (this.job) {
			this.job.cancel();
			this.job = null;
		}

	}
}

module.exports = { Schedules, Schedule };
