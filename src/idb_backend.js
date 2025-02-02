/* eslint no-undef: "off", no-param-reassign: "off", no-alert: "off", no-fallthrough: "off", no-dupe-args: "warn", no-irregular-whitespace: "warn", max-len: "off", key-spacing: ["warn", {beforeColon: false, afterColon: true}], comma-dangle: ["warn", "always-multiline"], quotes: ["warn", "double"], indent: ["warn", "tab", {SwitchCase: 1}], id-length: "off", brace-style: ["warn", "1tbs"] */

/*
 * "simple" indexedDB backend for storing save data, working similarly to existing webStorage system
 * indexedDB works faster, has virtually unlimited storage, but does not work properly in private mode. then again, localStorage doesn't persist in private mode either
 * indexedDB operates asynchronously, by making requests that may be fulfilled or rejected later, without blocking the rest of the code, but also without a guarantee that requested values will be available when that rest of the code runs. this requires some working around.
 * unlike old synchronous operations, most functions do not return the value immediately, but a promise to return it when it's completed. these promises can then be used to retrieve that data by calling Promise.then() callback function
 * for example, `idb.getItem(0).then((value) => console.log(value))` will first attempt to retrieve save data from slot 0, and then when that is done - the then() function triggers, in this case printing retrieved value to the console
 *
 * this implementation doesn't rely on caches, doesn't compress save data in any way, and separates save details store from save data store to speed up building the save list and allow extra features like timestamp highlighting at minimal processing cost
 * as a consequence, it requires more disk space, and a completely separate namespace that might need extra setup for games that override the default save list appearance
 * generally though, just adding a "saveList" id or class to the div element where the saves should appear and replacing the function/macro that populates that div with "if (idb.active) idb.saveList(); else old-custom-way-of-building-save-menu" should be enough to make it work.
 */

/* global State, Story, Save, clone */

const idb = (() => {
	"use strict";

	// return early if indexedDB is unavailable
	if (window.indexedDB == null) return Object.freeze({
		lock: true,
		/* eslint-disable brace-style */
		init() { return false; },
		get active() { return false; },
		set active(_) { return false; },
		get footerHTML() { return false; },
		set footerHTML(_) { return false; },
		/* eslint-enable brace-style */
	});

	let _lock = true; // don't allow multiple operations at the same time, majority of sugarcube is not async
	let _active = true; // whether to use indexedDB or the old localStorage
	let _dbName = "idb"; // database name
	let _migrationNeeded = false; // flag to migrate old saves
	let _settings = {}; // persistent db settings stored in localStorage
	updateSettings();
	let _saveDetails = []; // cache so we don't have to query all items from details store on every page change

	function log(description, data, useClone) {
		console.log(description, useClone ? clone(data) : data);
		if (window.Errors) Errors.report(description, data, useClone);
		else alert(`${description}\n${JSON.stringify(data)}`);
	}

	// bring the database up to date
	const _version = 1;
	function dbUpgrade(ev) {
		const db = ev.target.result;
		const ver = ev.oldVersion;
		console.log("updating idb", ver);
		switch (ver) {
			case 0:
				// first time opening, create stores for fat saves and slim details
				db.createObjectStore("saves", { keyPath: "slot" });
				db.createObjectStore("details", { keyPath: "slot" });
				_migrationNeeded = true; // flag localStorage saves for migration
				break;
			case 1:
				// reserved for upgrading from ver 1 in the future
		}
	}

	// open the database
	function openDB(name = _dbName, version = _version) {
		return new Promise((resolve, reject) => {
			_dbName = name;
			const openRequest = indexedDB.open(idb.dbName, version);
			openRequest.onupgradeneeded = dbUpgrade;
			openRequest.onerror = ev => {
				const err = ev.target.error;
				log("error opening idb", err);
				reject(err);
			};
			// indexedDB is opened, mark the rest of the system as active
			openRequest.onsuccess = ev => {
				_lock = false;
				if (navigator.storage && typeof navigator.storage.persist === "function") navigator.storage.persist();
				const db = ev.target;
				db.onclose = ev => {
					_active = false;
					log("ERROR: idb connection closed unexpectedly", ev);
				};
				db.onerror = ev => {
					_active = false;
					log("Database error", ev.target.errorCode);
				};
				if (_migrationNeeded) {
					importFromLocalStorage();
					_migrationNeeded = false;
				}
				resolve(db.result);
			};
			openRequest.onblocked = () => {
				console.log("something went wrong", openRequest.error);
				// reject(openRequest.error);
			};
		});
	}

	/**
	 * synchronize internal settings with persistent storage
	 * allowing them to survive page reload
	 *
	 * @param {string} setting accessor to modify
	 * @param {boolean} value to set
	 */
	function updateSettings(setting, value) {
		const storageName = "idb-settings";
		_settings = JSON.parse(localStorage.getItem(storageName)) || {
			warnSave: V.confirmSave || false,
			warnLoad: V.confirmLoad || false,
			warnDelete: V.confirmDelete || true,
			active: !window.FCHostPersistent,
			useDelta: true,
		};
		_active = _settings.active; // one-way sync, only change default when triggered by user, not by fail-safes
		if (!setting) return;
		if (!['warnSave', 'warnLoad', 'warnDelete', 'active', 'useDelta'].includes(setting)) return console.warn(`idbupdatesettings: invalid argument: ${setting}`);
		if (value == null) return _settings[setting];
		_settings[setting] = value;
		_active = _settings.active; // do it again
		localStorage.setItem(storageName, JSON.stringify(_settings));
	}
	updateSettings();

	const baddies = [];
	/**
	 * scan and stringify functions that wormed their way into story vars
	 * and other objects with custom toJSON revivals
	 *
	 * @param {object} target to scan
	 * @param {object} path to report
	 * @param {boolean} verbose flag to report objects too complex for idb
	 */
	function funNuke(target, path = "", verbose = true) {
		if (!target) return console.log("no target specified");
		for (const key in target) {
			const value = target[key];
			const newPath = `${path}['${key}']`;
			if (value == null) continue;
			else if (typeof value === "function" || value.toJSON) {
				// we've got a baddie, round him up!
				if (verbose && V.idbTest) {
					console.log(`Warn: ${newPath} of type ${typeof value} shouldn't be in STORY variables!!!`);
				}
				target[key] = JSON.stringify(value);
				baddies.push(newPath);
			} else if (typeof value === "object") funNuke(value, newPath, verbose);
		}
	}

	/**
	 * restore nuked functions and other nasty stuff
	 *
	 * @param {object} target store to alter
	 * @param {array} paths to restore
	 */
	function ekuNnuf(target = V, paths) {
		/**
		 * sub-function to revive specified path
		 *
		 * @param {object} target
		 * @param {string} path string in a format "['path']['to']['object']"
		 * @returns true on success
		 */
		function revive(target, path) {
			if (typeof path !== "string" || path === "") return console.log("Warn: invalid path", clone(path));
			const accessors = path.slice(2,-2).split("']['");
			let ref = target;
			for (let i = 0, destination = accessors.length - 1; i <= destination; i++) {
				if (i === destination) ref[accessors[i]] = JSON.parse(ref[accessors[i]]);
				else ref = ref[accessors[i]];
			}
			return true;
		}

		let path = "";
		while (path = paths.shift()) {
			try {
				revive(target, path);
			} catch (ex) {
				console.log("WARN: couldn't restore story var function", path);
			}
		}
	}

	/**
	 * copy saves from localStorage into indexedDB, without regard for what's already in there
	 *
	 * @returns {boolean} success of the operation
	 */
	async function importFromLocalStorage() {
		function processSave(fullSaveObj) {
			const save = fullSaveObj.state;
			if (save.jdelta) delete save.jdelta; // jdelta wasn't a great idea
			if (save.delta) save.history = State.deltaDecode(save.delta);
			delete save.delta;
			if (window.DoLSave) DoLSave.decompressIfNeeded({ state: save });

			const vars = save.history[save.index].variables;
			if (!vars.saveId) {
				// assign saveId, use Math.random() to not trip prng
				const saveId = Math.floor(Math.random() * 90000) + 10000;
				save.history.forEach(s => s.variables.saveId = saveId);
			}

			const details = {
				date: fullSaveObj.date,
				id: fullSaveObj.id,
				idx: fullSaveObj.idx,
				title: fullSaveObj.title,
				metadata: fullSaveObj.metadata || { saveId: vars.saveId, saveName: vars.saveName },
			};

			return [save, details];
		}

		let mtCount = 0;
		const oldSaves = Save.get();
		const autoSave = oldSaves.autosave;
		if (autoSave != null) {
			// autosave was moved from a separate slot in old system to just 0
			// if multiple autosaves are to be implemented, they can use negative slot numbers
			const saveData = processSave(save);
			// setItem only allows one operation at a time to prevent possible exploits, so wait for it to finish
			await setItem(0, saveData[0], { slot: 0, data: saveData[1] });
		} else mtCount++;
		for (let i = 0; i < oldSaves.slots.length; i++) {
			const slotSave = oldSaves.slots[i];
			if (slotSave != null) {
				const saveData = processSave(slotSave);
				await setItem(i + 1, saveData[0], { slot: i + 1, data: saveData[1] });
			} else mtCount++;
		}
		if (mtCount === oldSaves.slots.length + 1) { // all slots are empty, different storage method?
			const index = storage.get("index");
			if (index && index.slots) {
				// fc-like
				const autosave = storage.get("autosave");
				if (autosave) {
					const saveData = processSave(autosave);
					await setItem(0, saveData[0], { slot: 0, data: saveData[1] });
				}
				for (let i = 0; i < index.slots.length; i++) {
					const slotSave = storage.get("slot" + i); // eslint-disable-line prefer-template
					if (!slotSave) continue;
					const saveData = processSave(slotSave);
					await setItem(i + 1, saveData[0], { slot: i + 1, data: saveData[1] });
				}
			}
		}
		await getSaveDetails().then(d => _saveDetails = d);
		console.log("idb migration successful");
		return true;
	}

	/**
	 * turn transaction event handlers into promises
	 *
	 * @param {Request} transaction
	 */
	function makePromise(transaction) {
		return new Promise((resolve, reject) => {
			transaction.onsuccess = () => {
				_lock = false;
				return resolve(transaction.result);
			};
			transaction.oncomplete = () => {
				_lock = false;
				return resolve(transaction.result);
			};
			transaction.onerror = ev => {
				_lock = false;
				_active = false;
				console.log(transaction.error, ev, "error");
				return reject(transaction.error);
			};
			transaction.onabort = () => {
				_lock = false;
				console.log("aborted", transaction.error);
				return reject(transaction.error);
			};
		});
	}

	/**
	 * retrieve an item from indexedDB
	 *
	 * @param {number} slot
	 * @returns {Promise} promise to return a value some day
	 */
	async function getItem(slot) {
		const db = await openDB();
		const transactionRequest = db.transaction("saves", "readonly");
		const item = transactionRequest.objectStore("saves").get(slot);
		const result = await makePromise(item).catch(err => log(`couldn't retrieve idb item in slot ${slot}`, err));
		db.close();
		return result;
	}

	/**
	 * place a save object into saves store and a provided or calculated details object into details store
	 * will replace existing object in specified slot without a second thought
	 *
	 * @param {number} slot slot to write into
	 * @param {object} saveObj valid save object with unencoded history
	 * @param {object} details optional save details to override what's going into details store
	 * @returns {Promise | undefined} promise to report on success of this operation some day or return early
	 */
	async function setItem(slot, saveObj, details) {
		if (_lock) return;
		if (saveObj == null || !Object.hasOwn(saveObj, "history")) return false;
		_lock = true;

		// prepare save details
		const savesItem = { slot, data: saveObj };
		const saveVars = saveObj.history[saveObj.index].variables;
		const metadata = Object.assign({ saveId: saveVars.saveId, saveName: saveVars.saveName }, details?.metadata);
		details.metadata = metadata;
		const detailsItem = details
			? {
				slot,
				data: details,
			}
			: {
				slot,
				data: {
					id: Story.domId,
					idx: State.qc,
					title: Story.get(State.passage).description(),
					date: Date.now(),
					metadata,
				},
			};

		// expect failures here
		try {
			// sanitize complex data structures that can't be stored in idb
			let counter = 0; // only report problems for the first frame
			saveObj.history.forEach(s => {
				baddies.splice(0); // clear the baddies
				funNuke(s.variables, "", !counter++); // wrap up new baddies
				if (baddies.length) s.baddies = clone(baddies); // seal the records
			});
			if (_settings.useDelta && slot !== 0) {
				// compress the history, some games are really space-hungry
				// autosaves are exempt because performance reasons
				saveObj.delta = State.deltaEncode(saveObj.history);
				delete saveObj.history;
			}

			const db = await openDB();

			const transactionRequest = db.transaction(["saves", "details"], "readwrite");
			transactionRequest.objectStore("saves").delete(slot);
			transactionRequest.objectStore("saves").add(savesItem);
			transactionRequest.objectStore("details").delete(slot);
			transactionRequest.objectStore("details").add(detailsItem);

			const result = await makePromise(transactionRequest).catch(err => log(`couldn't put idb item in slot ${slot}`, err));
			db.close();
			return result;
		} catch (ex) {
			// admit the defeat and go home
			log(`idb.setItem failure unknown. Couldn't complete the save in slot ${slot}`);
			_lock = false;
			// return a promise, because some code down the line expects .then()
			return new Promise(resolve => resolve(false));
		}
	}

	/**
	 * delete save data in a specified slot
	 *
	 * @param {number} slot
	 * @returns {Promise | undefined} promise to report on success or return early
	 */
	async function deleteItem(slot) {
		if (_lock) return;
		const db = await openDB();

		_lock = true;
		const transactionRequest = db.transaction(["saves", "details"], "readwrite");
		transactionRequest.objectStore("saves").delete(slot);
		transactionRequest.objectStore("details").delete(slot);
		const result = await makePromise(transactionRequest);
		db.close();
		await getSaveDetails();
		return result;
	}

	/**
	 * actually load a save from idb
	 *
	 * @param {number} slot
	 */
	async function loadState(slot) {
		if (_lock) return;
		const data = await getItem(slot);
		if (data == null) return false;
		const state = data.data;
		// restore history
		if (state.delta) {
			state.history = State.deltaDecode(state.delta);
			delete state.delta;
		}
		// restore complex structures
		state.history.forEach(s => {
			if (s.baddies) {
				ekuNnuf(s.variables, s.baddies);
				delete s.baddies;
			}
		});
		// reconstruct fullSaveObj expected by onLoad
		const details = _saveDetails.find(d => d.slot === slot)?.data;
		state.idx = details.idx;
		const fullSaveObj = Object.assign({ state }, details);
		Save.onLoad.handlers.forEach(fn => fn(fullSaveObj));
		State.unmarshalForSave(state);
		State.show();
	}

	/**
	 * save current game into idb
	 *
	 * @param {number} slot
	 * @param {string} title
	 * @param {object} metadata
	 */
	async function saveState(slot, title, metadata) {
		if (_lock) return;

		// assign V.saveId if necessary
		if (!V.saveId) {
			const saveId = Math.floor(Math.random() * 90000) + 10000;
			V.saveId = saveId;
			State.history.forEach(s => s.variables.saveId = saveId);
		}

		// saveObj goes into saves db, the rest goes into details db
		const saveObj = State.marshalForSave();
		// we combine state and details into a single big object because that's what onSave expects
		const fullSaveObj = {
			state: saveObj,
			date: Date.now(),
			id: Story.domId,
			idx: State.qc,
			title: title || Story.get(State.passage).description(),
		};
		if (metadata != null) fullSaveObj.metadata = metadata;

		// run onSave handlers
		Save.onSave.handlers.forEach(fn => fn(fullSaveObj, { type: slot <= 0 ? "autosave" : "slot" }));

		// weird as object pointers are in js, it is now safe to remove .state from fullSaveObj, leaving only save details. so, let's rename it to reflect that
		const details = fullSaveObj;
		delete details.state;

		// finally, send everything to idb and synchronize _saveDetails
		if (saveObj != null) {
			await setItem(slot, saveObj, details);
			await getSaveDetails();
			return true;
		}
		return false;
	}

	/**
	 * retrieve details for all saves from idb and also cache them to _saveDetails for fast retrieval
	 *
	 * @returns {Promise<array>} list of details for all saves in idb
	 */
	async function getSaveDetails() {
		const db = await openDB();
		// const db = request.result;
		const transactionRequest = db.transaction(["details"], "readonly");
		const details = await makePromise(transactionRequest.objectStore("details").getAll());
		db.close();
		// warning: async quirks
		_saveDetails = details; // here, details is an array
		return details; // but the function returns a promise resolved to that array, not the array itself
	}

	/**
	 * get DATA for ALL saves in the db
	 * WILL fail if db is bigger than 2gb (and probably earlier)
	 *
	 * @returns {Array} list of data for all saves in idb
	 */
	async function getAllSaves() {
		const db = await openDB();
		const transactionRequest = db.transaction(["saves"], "readonly");
		const saves = transactionRequest.objectStore("saves").getAll();
		const result = await makePromise(saves)
		db.close();

		return result;
	}

	/**
	 * mercilessly clear all object stores one step short from outright deleting the db itself
	 *
	 * @returns {Promise | undefined} promise to maybe report when the deed is done or return early
	 */
	async function clearAll() {
		if (_lock) return;
		const db = await openDB();
		const transactionRequest = db.transaction(["saves", "details"], "readwrite");
		transactionRequest.objectStore("saves").clear();
		transactionRequest.objectStore("details").clear();
		_saveDetails = [];

		return makePromise(transactionRequest);
	}

	/**
	 * check if saves are allowed
	 */
	function savesAllowed() {
		return typeof Config.saves.isAllowed !== "function" || Config.saves.isAllowed();
	}

	/**
	 * define saveList variables
	 */

	let listLength; // store save list length in idb
	let listPage; // same with the current page
	const listLengthMax = 20; // maximum number of rows
	const listPageMax = 20; // maximum number of pages
	let latestSave = { slot: 1, date: 0 }; // keep track of the most recent save, separately from autosave on slot 0
	let extraSaveWarn;
	let footerHTML = ""; // add some text to fill empty space at the deleteAll button

	/**
	 * construct a saves list page, with configurable length
	 *
	 * @param {number} page
	 * @param {number} length
	 * @returns {DocumentFragment};
	 */
	function generateSavesPage(page = listPage - 1, length = listLength) {
		const listContainer = document.createElement("div");
		listContainer.id = "saves-list-container";
		listContainer.appendChild(generateHeaderRow());
		// cache whether saves are allowed
		const saveUnlock = savesAllowed();

		// find the most recent save that is not autosave
		latestSave = { slot: 1, date: 0 }; // re-init latest slot every time
		let autoSaveDate; // store timestamp for the autosave separately
		_saveDetails.forEach(d => {
			if (d.slot === 0) autoSaveDate = d.data.date;
			else if (d.data.date > latestSave.date) {
				latestSave.slot = d.slot;
				latestSave.date = d.data.date;
			}
		});
		// default list length is set here
		if (!listLength) {
			// idb is indexed by slot, so the highest is always last
			const slot = _saveDetails.length ? _saveDetails.last().slot : 0;
			// adjust list length to include saves in the highest slot
			// max pages is 20 (still too low if you're using 1080x1920 portrait mode)
			// by default, list length is 10, resulting into up to 200 slots across 20 pages
			// max list length is 20, resulting into up to 400 slots
			// having a save anywhere in slots > 200 shall increase list length so it won't disappear
			// it can also be used to increase default list length without any extra variables
			for (listLength = 10; slot > listLength * listPageMax && listLength < listLengthMax; listLength++);
			length = listLength;
		}
		// if not set to a correct value, show the page with the most recent save
		if (!Number.isInteger(page)) {
			// autosave is shown on every page, so if autosave is the most recent save - open the page with the most recent non-autosave with the same ID
			const latestSlot = _saveDetails.find(d => d.slot === latestSave.slot);
			if (latestSlot) {
				const autoSaveExists = Boolean(_saveDetails.find(d => d.slot === 0));
				const ignoreAutoSave = latestSlot.data.date > autoSaveDate || latestSlot.data.metadata.saveId === _saveDetails[0].data.metadata.saveId;
				if (!autoSaveExists || ignoreAutoSave) page = Math.floor((latestSave.slot - 1) / length);
				else page = 0;
			} else page = 0;
			listPage = page + 1;
		}

		// getSaveDetails can take longer to init listLength and listPage than it takes for their fields to be placed on page, gotta update them in such case
		const pageField = document.getElementById("pageNum");
		if (pageField != null) pageField.value = listPage;
		const lengthField = document.getElementById("pageLen");
		if (lengthField != null) lengthField.value = listLength;

		// default object details for an empty slot
		const defaultDetailsObj = { date: "", title: "", metadata: { saveId: "", saveName: "" } };

		// always show autosave on top
		const autoDetailsObj = _saveDetails.find(d => d.slot === 0)?.data ?? clone(defaultDetailsObj);
		if (autoSaveDate > latestSave.date) autoDetailsObj.latestSlot = true;
		autoDetailsObj.slot = 0;
		// don't show if autosaves are disabled by the engine
		if (Save.autosave.ok())	listContainer.appendChild(generateSaveRow(autoDetailsObj));

		// main loop for adding the save rows
		for (let slot = length * page + 1; slot < length * (page + 1) + 1; slot++) {
			// create default details
			let detailsObj = clone(defaultDetailsObj);
			// if a save exists in idb, replace the details with recorded ones
			const detailsIndex = _saveDetails.findIndex(d => d.slot === slot);
			if (detailsIndex !== -1) {
				detailsObj = _saveDetails[detailsIndex].data;
				// add a flag to highlight the most recent save
				if (Number(latestSave.slot) === slot) detailsObj.latestSlot = true;
			}
			detailsObj.slot = slot;
			detailsObj.saveUnlock = saveUnlock;
			listContainer.appendChild(generateSaveRow(detailsObj));
		}

		return listContainer;
	}

	/**
	 * construct the header row for the save list
	 * warning: unnecessarily complicated DOM manipulations
	 *
	 * @returns {DocumentFragment} header row
	 */
	function generateHeaderRow() {
		const frag = document.createDocumentFragment();
		const saveListHeader = document.createElement("div");
		saveListHeader.className = "savesListRow";
		frag.appendChild(saveListHeader);

		const headerSaveGroup = document.createElement("div");
		headerSaveGroup.className = "saveGroup";
		saveListHeader.appendChild(headerSaveGroup);

		const headerSaveId = document.createElement("div");
		headerSaveId.className = "saveId";
		headerSaveId.innerText = "#";
		headerSaveGroup.appendChild(headerSaveId);

		const headerSaveButton = document.createElement("div");
		headerSaveButton.className = "saveButton";
		headerSaveButton.innerText = L10n.get("savesHeaderSaveLoad");
		headerSaveGroup.appendChild(headerSaveButton);

		const headerSaveName = document.createElement("div");
		headerSaveName.className = "saveName";
		headerSaveName.innerText = L10n.get("savesHeaderIDName");
		headerSaveGroup.appendChild(headerSaveName);

		const headerSaveDetails = document.createElement("div");
		headerSaveDetails.className = "saveDetails";
		headerSaveDetails.innerText = L10n.get("savesHeaderDetails");
		headerSaveGroup.appendChild(headerSaveDetails);

		const headerDeleteButton = document.createElement("div");
		headerDeleteButton.className = "deleteButton";
		headerSaveGroup.appendChild(headerDeleteButton);

		return frag;
	}

	/**
	 * construct the footer row for the save list
	 * warning: unnecessarily complicated DOM manipulations
	 *
	 * @returns {HTMLUListElement} footer row
	 */
	function generateFooterRow() {
		const container = document.createElement("ul");
		container.className = "buttons";
		let li;

		// save to file button
		const exportButton = document.createElement("button");
		exportButton.id = "saves-export";
		exportButton.className = "ui-close";
		exportButton.innerText = L10n.get("savesLabelExport");
		if (savesAllowed()) {
			exportButton.onclick = () => Save.export();
			exportButton.classList.add("saveMenuButton");
		} else exportButton.disabled = true;
		li = document.createElement("li");
		li.appendChild(exportButton);
		container.appendChild(li);

		// save to clipboard button
		if (navigator.clipboard) {
			const toClipboardButton = document.createElement("button");
			toClipboardButton.id = "saves-toClipboard";
			toClipboardButton.className = "ui-close";
			toClipboardButton.innerText = L10n.get("savesLabelToClipboard");
			if (savesAllowed()) {
				toClipboardButton.onclick = () => {
					navigator.clipboard.writeText(Save.serialize());
					window.closeOverlay();
				};
				toClipboardButton.classList.add("saveMenuButton");
			} else toClipboardButton.disabled = true;
			li = document.createElement("li");
			li.appendChild(toClipboardButton);
			container.appendChild(li);
		}

		// load from file button
		const importButton = document.createElement("button");
		importButton.id = "saves-import";
		importButton.className = "saveMenuButton";
		importButton.innerText = L10n.get("savesLabelImport");
		importButton.onclick = () => {
			jQuery(document.createElement("input")).prop("type", "file").on("change", SugarCube.Save.import).trigger("click"); // gotta give it to anthaum for finding this
			window.closeOverlay();
		};
		li = document.createElement("li");
		li.appendChild(importButton);
		container.appendChild(li);

		// delete all saves button
		const clearAllButton = document.createElement("button");
		clearAllButton.className = "saves-clear saveMenuButton";
		clearAllButton.innerText = L10n.get("savesLabelClear");
		clearAllButton.onclick = () => saveList("confirm clear");
		li = document.createElement("li");
		li.appendChild(clearAllButton);
		container.appendChild(li);

		return container;
	}

	/**
	 * optional extra footer row
	 */
	function generateExtraFooterRow() {
		if (!footerHTML) return null;
		const container = document.createElement("ul");
		container.className = "buttons";
		container.innerHTML = footerHTML;

		return container;
	}

	/**
	 * all this to generate a single saves row from provided details
	 * pure js dom manipulations are ugly
	 *
	 * @param {object} details save details
	 * @returns {DocumentFragment}
	 */
	function generateSaveRow(details) {
		// save row to be returned
		const row = document.createElement("div");
		// add a fancy transition that would highlight the row with this id
		if (details.latestSlot && details.slot !== 0) row.id = "latestSaveRow";
		row.className = "savesListRow";

		// save group container
		const group = document.createElement("div");
		group.className = "saveGroup";

		// save ID
		const saveId = document.createElement("div");
		saveId.className = "saveId";
		saveId.innerText = details.slot === 0 ? "A" : details.slot;
		if (details.slot > listPageMax * listLengthMax || details.slot < 0) saveId.classList.add("red");

		// save/load buttons container
		const saveload = document.createElement("div");
		saveload.className = "saveButton";

		// save button
		const saveButton = document.createElement("button");
		saveButton.innerText = L10n.get("savesLabelSave");
		if (details.saveUnlock) {
			saveButton.className = "saveMenuButton";
			saveButton.onclick = () => saveList("confirm save", details);
		} else {
			saveButton.disabled = true;
		}

		// load button
		const loadButton = document.createElement("button");
		loadButton.innerText = L10n.get("savesLabelLoad");
		if (details.date) {
			loadButton.className = "saveMenuButton";
			loadButton.onclick = () => saveList("confirm load", details);
		} else {
			loadButton.disabled = true;
		}
		if (details.slot !== 0) saveload.appendChild(saveButton);
		saveload.appendChild(loadButton);

		// save name
		const saveName = document.createElement("div");
		saveName.className = "saveName";
		// highlight saves with currently loaded save's id
		if (V.saveId === details.metadata.saveId) saveName.classList.add("gold");
		saveName.innerText = details.metadata.saveName ? details.metadata.saveName.slice(0, 10) : details.metadata.saveId;

		// save details
		const saveDetails = document.createElement("div");
		saveDetails.className = "saveDetails";
		// description
		const description = document.createElement("span");
		description.innerText = details.title || "\xa0";
		// date stamp
		const date = document.createElement("span");
		date.className = "datestamp";
		if (details.date) {
			// highlight (most) recent save(s)
			if (details.latestSlot) date.classList.add("green");
			else if (details.date > Date.now() - 1800000) date.classList.add("gold");
			date.innerText = new Date(details.date).toLocaleString();
		} else date.innerText = "\xa0";
		saveDetails.appendChild(description);
		saveDetails.appendChild(date);

		// delete button
		const deleteButton = document.createElement("button");
		deleteButton.className = "deleteButton right";
		deleteButton.innerText = L10n.get("savesLabelDelete");
		if (details.date) {
			deleteButton.classList.add("saveMenuButton");
			deleteButton.onclick = () => saveList("confirm delete", details);
		} else {
			deleteButton.disabled = true;
		}

		group.append(saveId, saveload, saveName, saveDetails);
		row.appendChild(group);
		row.appendChild(deleteButton);

		return row;
	}

	/**
	 * @returns {HTMLUListElement}
	 */
	function generatePager() {
		const container = document.createElement("ul");
		container.className = "buttons";
		let li;

		li = document.createElement("li");
		li.append(L10n.get("savesPagerPage"));
		container.appendChild(li);

		// previous page button
		const prevPage = document.createElement("button");
		prevPage.append("<");
		if (listPage > 1) {
			prevPage.classList.add("saveMenuButton");
			prevPage.onclick = () => {
				--listPage;
				saveList("show saves");
			};
		} else prevPage.disabled = true;
		li = document.createElement("li");
		li.appendChild(prevPage);
		container.appendChild(li);


		// page number input
		const pageNum = document.createElement("input");
		Object.assign(pageNum, {
			id: "pageNum",
			type: "number",
			value: listPage,
			style: "width: 3em",
			min: 1,
			max: listPageMax,
			onchange: () => {
				listPage = Math.clamp(Math.round(pageNum.value), 1, listPageMax);
				saveList("show saves");
			},
		});
		container.appendChild(pageNum); // Not in a li to keep closer to buttons

		// next page button
		const nextPage = document.createElement("button");
		nextPage.append(">");
		if (listPage < listPageMax) {
			nextPage.classList.add("saveMenuButton");
			nextPage.onclick = () => {
				++listPage;
				saveList("show saves");
			};
		} else nextPage.disabled = true;
		nextPage.onclick = () => {
			if (listPage < listPageMax) listPage++;
			saveList("show saves");
		};
		li = document.createElement("li");
		li.appendChild(nextPage);
		container.appendChild(li);

		li = document.createElement("li");
		li.append(L10n.get("savesPagerSavesPerPage"));
		container.appendChild(li);

		// list length input
		const pageLen = document.createElement("input");
		Object.assign(pageLen, {
			id: "pageLen",
			type: "number",
			value: listLength,
			style: "width: 3em",
			min: 1,
			max: listLengthMax,
			onchange: () => {
				listLength = Math.clamp(pageLen.value, 1, listLengthMax);
				saveList("show saves");
			},
		});
		li = document.createElement("li");
		li.append(pageLen);
		container.appendChild(li);

		// jump to most recent save button
		const jumpToLatest = document.createElement("button");
		jumpToLatest.className = "saveMenuButton";
		jumpToLatest.innerText = L10n.get("savesPagerJump");
		jumpToLatest.onclick = () => {
			// potentially exploitable to allow saving to slots way above the limit, but the limit is arbitrary to begin with, and idb doesn't actually suffer one bit from going beyond that limit
			listPage = Math.floor((latestSave.slot - 1) / listLength + 1);
			saveList("show saves");
			setTimeout(() => {
				const el = document.getElementById("latestSaveRow");
				if (el != null) {
					el.classList.remove("jumpToSaveTransition");
					el.classList.add("jumpToSaveTransition");
				}
			}, Engine.minDomActionDelay + 100);
		};
		li = document.createElement("li");
		li.appendChild(jumpToLatest);
		container.appendChild(li);

		return container;
	}

	// itch app must die or at least update to kitch version, smh
	const replaceChildren = !!document.body.replaceChildren;

	// alias for closing the saves menu
	if (typeof window.closeOverlay === "undefined") window.closeOverlay = Dialog.close;

	/**
	 * replace contents of saveList div with something useful
	 *
	 * @param {string} mode switch for displaying saves list or confirmations
	 * @param {object} details save details for confirmations
	 */
	async function saveList(mode, details) {
		if (_active && !_settings.active) updateSettings("active", true); // for when it's called from old save menu
		if (!mode) {
			// update saveDetails every time menu opens with no options, in case game was saved in another tab
			await getSaveDetails();
			mode = "show saves";
		}

		await new Promise(r => setTimeout(() => r(true), 0)); // this actually ensures that #saveList had time to render into DOM
		const savesDiv = document.getElementById("saveList") || document.getElementsByClassName("saveList")[0] || document.getElementsByClassName("saves")[0];
		const list = document.createDocumentFragment();

		// prepare a re-usable cancel button
		const cancelButton = document.createElement("button");
		cancelButton.className = "saveMenuButton saveMenuConfirm";
		cancelButton.innerText = L10n.get("cancel");
		cancelButton.onclick = () => saveList("show saves");

		// prepare old save info (if provided)
		function generateOldSaveDescription(details) {
			const oldSaveDescription = document.createDocumentFragment();
			if (!details || !details.date) return oldSaveDescription;

			const oldSaveTitle = document.createElement("p");
			oldSaveTitle.innerText = `${L10n.get("savesDescTitle")} ${details.title}`;

			const oldSaveData = document.createElement("p");
			oldSaveData.innerText = `${details.metadata.saveName ? L10n.get("savesDescName") + details.metadata.saveName : L10n.get("savesDescId") + details.metadata.saveId} ${L10n.get("savesDescDate")} ${new Date(details.date).toLocaleString()}`;

			oldSaveDescription.append(oldSaveTitle, oldSaveData);

			return oldSaveDescription;
		}

		switch (mode) {
			case "show saves": {
				// print saves list
				// show the warnings
				if (!savesAllowed()) {
					const notAllowedWarning = document.createElement("h3");
					notAllowedWarning.className = "red";
					notAllowedWarning.innerText = V.replayScene ? L10n.get("savesDisallowedReplay") : L10n.get("savesDisallowed");
					list.appendChild(notAllowedWarning);
				}

				const exportReminder = document.createElement("p");
				exportReminder.id = "saves-export-reminder";
				exportReminder.innerText = L10n.get("savesExportReminder");
				list.appendChild(exportReminder);

				// extra saves warning
				if (extraSaveWarn) {
					const lostSaves = document.createElement("p");
					lostSaves.innerHTML = "<i class=\"description\"><u>Where are my saves?</u></i> ";
					const lostSavesTooltip = document.createElement("mouse");
					lostSavesTooltip.classList.add("tooltip", "linkBlue");
					lostSavesTooltip.innerText = "(?)";
					lostSavesTooltip.appendChild(document.createElement("span"));
					lostSavesTooltip.lastChild.innerText = "If you can't find your saves, it's possible you saved them using a different storage method. Try toggling the \"Use old legacy storage\" option below the saves list.";
					lostSaves.appendChild(lostSavesTooltip);
					list.appendChild(lostSaves);
				}

				// THE SAVES LIST
				list.appendChild(generateSavesPage());

				// button row
				list.appendChild(generateFooterRow());

				// optional footer row
				if (footerHTML) list.appendChild(generateExtraFooterRow());

				// add pager
				list.appendChild(generatePager());

				// add confirmation toggles
				let ul = document.createElement("ul");
				ul.className = "buttons";
				let li;
				li = document.createElement("li");
				li.append(L10n.get("savesOptionsConfirmOn"));
				ul.appendChild(li);

				const reqSaveLabel = document.createElement("label");
				reqSaveLabel.innerText = L10n.get("savesOptionsOverwrite");
				const reqSave = document.createElement("input");
				reqSave.type = "checkbox";
				reqSave.checked = _settings.warnSave;
				reqSave.onchange = () => updateSettings("warnSave", reqSave.checked);
				reqSaveLabel.appendChild(reqSave);
				li = document.createElement("li");
				li.appendChild(reqSaveLabel);
				ul.appendChild(li);

				const reqLoadLabel = document.createElement("label");
				reqLoadLabel.innerText = L10n.get("savesLabelLoad");
				const reqLoad = document.createElement("input");
				reqLoad.type = "checkbox";
				reqLoad.checked = _settings.warnLoad;
				reqLoad.onchange = () => updateSettings("warnLoad", reqLoad.checked);
				reqLoadLabel.appendChild(reqLoad);
				li = document.createElement("li");
				li.appendChild(reqLoadLabel);
				ul.append("|", li);

				const reqDeleteLabel = document.createElement("label");
				reqDeleteLabel.innerText = L10n.get("savesLabelDelete");
				const reqDelete = document.createElement("input");
				reqDelete.type = "checkbox";
				reqDelete.checked = _settings.warnDelete;
				reqDelete.onchange = () => updateSettings("warnDelete", reqDelete.checked);
				reqDeleteLabel.appendChild(reqDelete);
				li = document.createElement("li");
				li.appendChild(reqDeleteLabel);
				ul.append("|", li);

				// last element gets floated to the right. empty one doesn't matter
				ul.append(document.createElement("li"));

				list.append(ul);

				// add instant idb switcher
				ul = document.createElement("ul");
				ul.className = "buttons";
				const idbtoggle = document.createElement("button");
				idbtoggle.id = "saves-idb-toggle";
				idbtoggle.className = "saveMenuButton";
				idbtoggle.innerText = L10n.get("savesOptionsUseLegacy");
				idbtoggle.onclick = () => {
					updateSettings("active", false);
					if (window.DoLSave)	$.wiki("<<replace #saveList>><<saveList>><</replace>>");
					else UI.buildSaves();
				};
				li = document.createElement("li");
				li.appendChild(idbtoggle);
				ul.appendChild(li);
				list.appendChild(ul);

				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
					const pageField = document.getElementById("pageNum");
					if (pageField != null) pageField.value = listPage;
					const lengthField = document.getElementById("pageLen");
					if (lengthField != null) lengthField.value = listLength;
					Dialog.resize(); // fix dialog size
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm save": {
				// skip confirmation if the slot is empty, but do not skip on saveId mismatch, even if confirmation is not required
				if (!details.date || !_settings.warnSave && details.metadata.saveId === V.saveId) return saveState(details.slot).then(window.closeOverlay());
				const confirmSaveWarning = document.createElement("div");
				confirmSaveWarning.className = "saveBorder";

				const confirmSaveWarningTitle = document.createElement("h3");
				confirmSaveWarningTitle.className = "red";
				confirmSaveWarningTitle.innerText = `${details.date === "" ? L10n.get("savesWarningSaveOnSlot") : L10n.get("savesWarningOverwriteSlot")} ${details.slot}?`;

				if (details.date && V.saveId !== details.metadata.saveId) {
					const overwriteWarning = document.createElement("span");
					overwriteWarning.className = "red";
					overwriteWarning.innerText = L10n.get("savesWarningOverwriteID");
				}

				const saveButton = document.createElement("input");
				Object.assign(saveButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelSave"),
					onclick: () => saveState(details.slot).then(() => window.closeOverlay()),
				});
				confirmSaveWarning.append(confirmSaveWarningTitle, generateOldSaveDescription(details), saveButton, cancelButton);

				list.appendChild(confirmSaveWarning);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm delete": {
				// skip confirmation if corresponding toggle is off
				if (!_settings.warnDelete) return deleteItem(details.slot).then(() => saveList("show saves"));
				const confirmDeleteWarning = document.createElement("div");
				confirmDeleteWarning.className = "saveBorder";
				const confirmDeleteWarningTitle = document.createElement("h3");
				confirmDeleteWarningTitle.className = "red";
				confirmDeleteWarningTitle.innerText = `${L10n.get("savesWarningDeleteInSlot") + (details.slot === 0 ? "auto" : details.slot)}?`;

				const deleteButton = document.createElement("input");
				Object.assign(deleteButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelDelete"),
					onclick: () => deleteItem(details.slot).then(() => saveList("show saves")),
				});

				confirmDeleteWarning.append(confirmDeleteWarningTitle, generateOldSaveDescription(details), deleteButton, cancelButton);

				list.appendChild(confirmDeleteWarning);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm load": {
				// skip confirmation if corresponding toggle is off
				if (!_settings.warnLoad) return loadState(details.slot).then(() => window.closeOverlay());
				const confirmLoad = document.createElement("div");
				confirmLoad.className = "saveBorder";
				const confirmLoadTitle = document.createElement("h3");
				confirmLoadTitle.className = "red";
				confirmLoadTitle.innerText = `${L10n.get("savesWarningLoad") + (details.slot === 0 ? "auto" : details.slot)}?`;

				const loadButton = document.createElement("input");
				Object.assign(loadButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelLoad"),
					onclick: () => idb.loadState(details.slot).then(() => window.closeOverlay()),
				});
				confirmLoad.append(confirmLoadTitle, generateOldSaveDescription(details), loadButton, cancelButton);

				list.appendChild(confirmLoad);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm clear": {
				// storage wipes always require confirmation
				const confirmClear = document.createElement("div");
				confirmClear.className = "saveBorder";
				const confirmClearTitle = document.createElement("h2");
				confirmClearTitle.className = "red";
				confirmClearTitle.innerText = L10n.get("savesWarningDeleteAll");

				const clearButton = document.createElement("input");
				Object.assign(clearButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelClear"),
					onclick: () => clearAll().then(() => saveList("show saves")),
				});
				confirmClear.append(confirmClearTitle, clearButton, cancelButton);

				list.appendChild(confirmClear);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
		}
	}

	return Object.freeze(Object.defineProperties({}, {
		/* eslint-disable brace-style */
		dbName:         { get() { return _dbName;    }, set(val) { _dbName = val; } },
		lock:           { get() { return _lock;      }, set(val) { _lock = Boolean(val); } },
		active:         { get() { return _active;    }, set(val) { _active = Boolean(val); } },
		listLength:     { get() { return listLength; }, set(val) { listLength = val; } },
		listPage:       { get() { return listPage;   }, set(val) { listPage = val; } },
		footerHTML:     { get() { return footerHTML; }, set(val) { footerHTML = val; } },
		baddies:        { get() { return baddies; } },
		init:           { value(dbName) { return openDB(dbName); } },
		getSaveDetails: { value: getSaveDetails },
		getAllSaves:    { value: getAllSaves },
		saveList:       { value: saveList },
		saveState:      { value: saveState },
		loadState:      { value: loadState },
		setItem:        { value: setItem },
		getItem:        { value: getItem },
		deleteItem:     { value: deleteItem },
		clearAll:       { value: clearAll },
		updateSettings: { value: updateSettings },
		funNuke:        { value: funNuke },
		ekuNnuf:        { value: ekuNnuf },
		importFromLocalStorage: { value: importFromLocalStorage },
	}));
})();
window.idb = idb;
