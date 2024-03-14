'use strict';


let gadapter;

class Weather {
	static instance = undefined;
	rainingcallback = undefined;
	callbackinstance = undefined;
	rainSensor = "";
	weatherFactor;
	raining = false;

	/**
	 * @param {any} adapter
	 */
	constructor (adapter) {
		this.adapter = adapter;
		gadapter = adapter;
		this.rainSensor = adapter.config.rainSensor;
		this.weatherFactor = adapter.config.weatherFactor;
	}

	static getInstance(adapter) {
		if (!Weather.instance) {
			// @ts-ignore
			Weather.instance = new Weather(adapter);
		}
		return Weather.instance;
	}

	async initialize() {
		try {
			if (this.rainSensor) {
				await this.adapter.subscribeForeignStatesAsync(this.rainSensor);
				const obj = await this.adapter.getForeignStateAsync(this.rainSensor);
				gadapter.log.debug(`rain state: ${JSON.stringify(obj)}, rainSensor: ${this.rainSensor}`);
				if (obj) this.raining = obj.val;
				gadapter.log.debug(`Rainsensor: ${this.rainSensor}, raining: ${this.raining}, obj: ${JSON.stringify(obj)}`);
			}
		} catch(err) {
			gadapter.log.error(`Cannot initialize weather: ${err}`);
		}
	}

	async stateChange(id, state) {

		gadapter.log.info(`(Weather) State change ${id}, state: ${JSON.stringify(state)}, rainsensor: ${this.rainSensor}, raining: ${this.raining}, state.val: ${state.val}, callback: ${this.rainingcallback}`);
		
		if (!state) return;

		if (id == this.rainSensor) {

			if (this.raining === false && state.val === true && this.rainingcallback) {
				gadapter.log.info("Calling raining callback");
				// @ts-ignore
				this.rainingcallback();
			} 
			this.raining = state.val;	
		} 
	}

	setRainingCallback(func) {
		this.rainingcallback = func;
	}

	isRaining() {
		return this.raining;
	}

	async condition() {
		// return factor to correct irrigation time
		let ret = 1.0;
		const obj =  await this.adapter.getForeignStateAsync(this.weatherFactor);
		gadapter.log.debug(`ret is ${ret}, ${typeof obj.val}`);
		if (obj && obj.val) {
			const oval = JSON.parse(obj.val);
			ret = oval[0];
		}
		gadapter.log.debug(`rain state: ${JSON.stringify(obj)}, weatherFactor: ${this.weatherFactor} ret: ${ret}`);
		return ret;
	}
}


module.exports = Weather;
