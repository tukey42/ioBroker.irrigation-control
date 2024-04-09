'use strict';

async function create_devices(gadapter, device_type, conflist, statelist, namelist) {
	try {
		for (const name of namelist) {
			const obj = await gadapter.createChannelAsync(device_type, name);
			if (obj != undefined) {
				gadapter.log.info(`Device ${name} created (${JSON.stringify(obj)})`);
				for (let s of statelist) {
					await gadapter.setObjectNotExistsAsync(`${obj.id}.${s.name}`, {
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
					//let v = conflist lookup return false for not found states (e.g. state);
					let v;
					if (v = conflist.find(x => (x.name == name))) {
						//special handling for certain values
						if (s.name == "zone_list") {  // zeit vergessen...:!!!!!!
							v.zone_list = JSON.stringify(v.zone_list);
						}
						gadapter.log.debug(`Setting ${s.name} to ${v[s.name]}`);
						if (v[s.name] == null || v[s.name] == undefined) v[s.name] = false;
						await gadapter.setStateAsync(`${obj.id}.${s.name}`, {val: v[s.name], ack: true});
					}
					
				}
			}
		}
	} catch (err) {
		gadapter.log.error(`Cannot create device, err: ${err}`);
	}

}

async function update_devices(gadapter, device, conflist, statelist, namelist, channels) {
	try {
		for (const name of namelist) {
			const obj = channels.find((x) => (name == x.common.name));
			if (obj != undefined) {
				gadapter.log.info(`Updating Device ${name}  (${JSON.stringify(obj)}), statelist: ${JSON.stringify(statelist)}`);
				for (let s of statelist) {
					//let v = conflist lookup return false for not found states (e.g. state);
					let v;
					gadapter.log.debug(`Conflist: ${JSON.stringify(conflist)}, s.name: ${s.name}`);
					if (v = conflist.find(x => (x.name == name))) {
						//special handling for certain values
						if (s.name == "zone_list") {
							v.zone_list = JSON.stringify(v.zone_list);
						}
						if (v[s.name] != undefined) {
							gadapter.log.debug(`Updating state ${s.name} of ${name}, value: ${v[s.name]}`);
							await gadapter.setStateAsync(`${obj._id}.${s.name}`, {val: v[s.name], ack: true});
						}
					}
				}
			}
		}
	} catch (err) {
		gadapter.log.error(`Cannot update device, err: ${err}`);
	}
}

async function delete_devices(gadapter, device, conflist, statelist, namelist) {
	try {
		for (const name of namelist) {
			await gadapter.deleteChannelAsync(device, name);
		}
	} catch (err) {
		gadapter.log.error(`Cannot delete device, err: ${err}`);
	}
}


async function config2object(gadapter, conflist, device, statelist) {

	if (conflist == null || typeof conflist[Symbol.iterator] !== 'function') {
		gadapter.log.info(`No ${device} configure`);
		return;
	}

	try {
		const actlist_long = await gadapter.getChannelsAsync(device);
		const actlist_names = actlist_long.map((x) => x.common.name);
		const conflist_names = conflist.map((x) => x.name);
		const names_inboth = actlist_names.filter(e => conflist_names.includes(e));
		const names_inactlist = actlist_names.filter(e => !conflist_names.includes(e));
		const names_inconflist = conflist_names.filter(e => !actlist_names.includes(e));

		/* create devices for names in names_inconflist */
		await create_devices(gadapter, device, conflist, statelist, names_inconflist);

		/* update devices for names in names_inboth and in names_inconflist*/
		await update_devices(gadapter, device, conflist, statelist, names_inboth.concat(names_inconflist), actlist_long);

		/* delete devices for names in names_inactlist */
		await delete_devices(gadapter, device, conflist, statelist, names_inactlist);
	} catch(err) {
		gadapter.log.error(`Cannot create config for ${device}`);
	}

}

module.exports = config2object;