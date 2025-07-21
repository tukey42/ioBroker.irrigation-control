'use strict';


let gadapter;

class Weather {
	static instance = undefined;
	rainingcallback = undefined;
	callbackinstance = undefined;
	rainSensor = "";
	weatherFactor;
	raining = 0;
	rainToday;

	/**
	 * @param {any} adapter
	 */
	constructor (adapter) {
		this.adapter = adapter;
		gadapter = adapter;
		this.rainSensor = adapter.config.rainSensor;
		this.weatherFactor = adapter.config.weatherFactor;
		this.rainToday = adapter.config.rainToday || "alias.0.Wetterstation.dailyrain";
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

		gadapter.log.debug(`(Weather) State change ${id}, state: ${JSON.stringify(state)}, rainsensor: ${this.rainSensor}, raining: ${this.raining}, state.val: ${state.val}, callback: ${this.rainingcallback}`);
		
		if (!state) return;

		if (id == this.rainSensor) {

			if (this.raining == 0 && state.val == 1 && this.rainingcallback) {
				gadapter.log.debug("Calling raining callback");
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

	async condition(days, override) {
		// return factor to correct irrigation time
		let ret = 1.0;
		const obj =  await this.adapter.getForeignStateAsync(this.weatherFactor);
		const raintoday =  await this.adapter.getForeignStateAsync("alias.0.Wetterstation.dailyrain");

		if (override > 0) {
			ret = override;
		} else {
			gadapter.log.debug(`ret is ${ret}, ${typeof obj.val}, ${typeof days}, ${days}`);
			if (obj && obj.val) {
				const oval = JSON.parse(obj.val);
				ret = 0;
				for (let i = 0; i < days; i++) {
					ret += oval[i];
				}
				ret /= days;
			}
			// subtract rain today
			if (raintoday && raintoday.val) {
				ret -= raintoday.val; // convert to mm
			}
			// limit value between 0% and 200%
			if (ret < 0) ret = 0;
			if (ret > 2) ret = 2;
		}
		gadapter.log.debug(`rain state: ${JSON.stringify(obj)}, weatherFactor: ${this.weatherFactor} ret: ${ret}`);
		return ret;
	}
}


module.exports = Weather;
