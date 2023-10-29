/* eslint no-undef: "off", no-param-reassign: "off", no-alert: "off", no-fallthrough: "off", no-dupe-args: "warn", no-irregular-whitespace: "warn", max-len: "off", key-spacing: ["warn", {beforeColon: false, afterColon: true}], comma-dangle: ["warn", "always-multiline"], quotes: ["warn", "double"], indent: ["warn", "tab", {SwitchCase: 1}], id-length: "off", prefer-template: "off", brace-style: ["warn", "1tbs"] */

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

const idb = (() => {
	"use strict";

	if (window.indexedDB == null) return Object.freeze({ active: false, lock: true }); // return early if indexedDB is unavailable

	let lock = true; // don't allow multiple operations at the same time, majority of sugarcube is not async
	let active = false; // whether to use indexedDB or the old localStorage
	let dbName = "idb"; // database name
	let footerHTML = ""; // add some text to fill empty space at the deleteAll button
	let migrationNeeded = false; // flag to migrate old saves

	let db; // database to be

	let openRequest = null;
	// open the database. should stay open while the page is open.
	function openDB(name = dbName) {
		dbName = name;
		openRequest = indexedDB.open(dbName);
		// bring the database up to date
		openRequest.onupgradeneeded = event => {
			console.log("updating idb", event.oldVersion);
			switch (event.oldVersion) {
				case 0: // 0 means we're creating a new database from scratch
					// create an object store for saves, containing lots of data
					openRequest.result.createObjectStore("saves", { keyPath: "slot" });
					// and a separate store for small details, that should be fast to access
					openRequest.result.createObjectStore("details", { keyPath: "slot" });
					// flag old saves from localStorage for migration
					migrationNeeded = true;
				case 1:
					break; // put db upgrade code here if it's ever needed
			}
		};
		// errors most often happen in private browsing mode. nothing to do here.
		openRequest.onerror = () => {
			console.log("error opening idb");
		};
		// indexedDB is opened, mark the rest of the system as active
		openRequest.onsuccess = () => {
			db = openRequest.result;
			console.log("idbOpen success");
			lock = false;
			active = true;
			// this only triggers after initial db creation, but can't be put into onupgradeneeded because you need database to be successfully open before putting stuff into it
			if (migrationNeeded) {
				importFromLocalStorage();
				migrationNeeded = false;
			}
		};
		// this actually should never happen, but none can say that i'm not thorough
		openRequest.onblocked = () => console.log("something went wrong");
	}

	/**
	 * generate reasonably unique saveId
	 * use math.random to not trip prng
	 */
	function genSaveId() {
		if (!V.saveId) V.saveId = Math.floor(Math.random() * 90000) + 10000;
	}

	/**
	 * scan and stringify functions that wormed their way into story vars
	 * and other objects with custom toJSON revivals
	 *
	 * @param {object} target to scan
	 * @param {object} path to report
	 */
	const baddies = [];
	function funNuke(target = V, path = "", verbose = true) {
		for (const key in target) {
			const value = target[key];
			const newPath = path + "['" + key + "']";
			if (value == null) continue;
			else if (typeof value === "function" || value.toJSON) {
				// we've got a baddie, round him up!
				if (verbose && V.idbTest) {
					console.log("Warn: " + newPath + " of type " + typeof value + " shouldn't be in STORY variables!!!");
				}
				target[key] = JSON.stringify(value);
				baddies.push(newPath);
			} else if (typeof value === "object") funNuke(value, newPath, verbose);
		}
	}
	window.funNuke = funNuke;

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
		while (path = paths[0]) {
			try {
				revive(target, path);
			} catch (ex) {
				console.log("WARN: couldn't restore story var function", path);
			}
			paths.shift();
		}
	}
	window.ekuNnuf = ekuNnuf;

	/**
	 * copy saves from localStorage into indexedDB, without regard to what's already in there
	 *
	 * @returns {boolean} success of the operation
	 */
	async function importFromLocalStorage() {
		const oldSaves = Save.get();
		const autoSave = oldSaves.autosave;
		if (autoSave != null) {
			// autosave was moved from a separate slot in old system to just 0 in new
			const save = autoSave.state;
			// there is no need for delta-compression in indexedDB, restore real history
			if (save.jdelta) save.history = State.jdeltaDecode(save.delta, save.jdelta);
			else if (save.delta) save.history = State.deltaDecode(save.delta);
			delete save.jdelta;
			delete save.delta;
			// no need for json-compression either
			if (window.DoLSave) DoLSave.decompressIfNeeded({ state: save });
			// remove known function-type vars from old save data because indexedDB can not store them
			save.history.forEach(s => delete s.variables.currentFurnishing);

			const data = {
				date: autoSave.date,
				id: autoSave.id,
				title: autoSave.title,
				metadata: autoSave.metadata || { saveId: save.history.last().variables.saveId, saveName: save.history.last().variables.saveName },
			};
			// setItem only allows one operation at a time to prevent possible exploits, so wait for it to finish
			await setItem(0, save, { slot: 0, data });
		}
		for (let i = 0; i < 8; i++) {
			const slotSave = oldSaves.slots[i];
			if (slotSave != null) {
				const save = slotSave.state;
				// same as for autosave
				if (save.jdelta) save.history = State.jdeltaDecode(save.delta, save.jdelta);
				else if (save.delta) save.history = State.deltaDecode(save.delta);
				delete save.jdelta;
				delete save.delta;
				if (window.DoLSave) DoLSave.decompressIfNeeded({ state: save });
				// remove known functions from old save data because indexedDB can not store them
				save.history.forEach(s => delete s.variables.currentFurnishing);
				const data = {
					date: slotSave.date,
					id: slotSave.id,
					title: slotSave.title,
					metadata: slotSave.metadata || { saveId: save.history.last().variables.saveId, saveName: save.history.last().variables.saveName },
				};
				await setItem(i + 1, save, { slot: i + 1, data });
			}
		}
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
				lock = false;
				return resolve(transaction.result);
			};
			transaction.oncomplete = () => {
				lock = false;
				return resolve(transaction.result);
			};
			transaction.onfailure = () => {
				lock = false;
				return reject(transaction.error);
			};
			transaction.onabort = () => {
				lock = false;
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
	function getItem(slot) {
		const transactionRequest = db.transaction("saves", "readonly");
		const item = transactionRequest.objectStore("saves").get(slot);

		return makePromise(item);
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
	function setItem(slot, saveObj, details) {
		if (lock) return;
		if (saveObj == null || !Object.hasOwn(saveObj, "history")) return false;
		lock = true;

		// prepare save details
		const savesItem = { slot, data: saveObj };
		const saveVars = saveObj.history[saveObj.index].variables;
		const metadata = { saveId: saveVars.saveId, saveName: saveVars.saveName };
		const detailsItem = details || {
			slot,
			data: { id: Story.domId, title: Story.get(State.passage).description(), date: Date.now(), metadata },
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

			// open a request to set or replace an existing slot
			const transactionRequest = db.transaction(["saves", "details"], "readwrite");
			transactionRequest.objectStore("saves").delete(slot);
			transactionRequest.objectStore("saves").add(savesItem);
			transactionRequest.objectStore("details").delete(slot);
			transactionRequest.objectStore("details").add(detailsItem);

			return makePromise(transactionRequest);
		} catch (ex) {
			// admit the defeat and go home
			if (window.Errors) Errors.report("idb.setItem failure unknown. Couldn't complete the save in slot " + slot);
			else alert("idb.setItem failure unknown. Couldn't complete the save in slot " + slot);
			lock = false;
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
	function deleteItem(slot) {
		if (lock) return;
		lock = true;

		const transactionRequest = db.transaction(["saves", "details"], "readwrite");
		transactionRequest.objectStore("saves").delete(slot);
		transactionRequest.objectStore("details").delete(slot);

		return makePromise(transactionRequest);
	}

	/**
	 * actually load a save from idb
	 *
	 * @param {number} slot
	 */
	function loadState(slot) {
		if (lock) return;
		return getItem(slot).then(value => {
			if (value == null) return false;
			value.data.history.forEach(s => {
				// restore story var functions
				if (s.baddies) {
					ekuNnuf(s.variables, s.baddies);
					delete s.baddies;
				}
			});
			Save.onLoad.handlers.forEach(fn => fn({ state: value.data }));
			State.unmarshalForSave(value.data);
			State.show();
			// set V.saveId for saves without one
			// should probably be done after State.show in case a game implements it's own ID assignment in passageHeader
			genSaveId();
		});
	}

	/**
	 * save current game into idb
	 *
	 * @param {number} slot
	 */
	function saveState(slot) {
		if (lock) return;
		const saveObj = State.marshalForSave();
		Save.onSave.handlers.forEach(fn => fn({ state: saveObj, date: Date.now() }, { type: slot <= 0 ? "autosave" : "slot" })); // run onSave handlers
		// window.onSave({ state: saveObj }); // run onSave handlers
		if (saveObj != null) return setItem(slot, saveObj);
		return false;
	}

	/**
	 * get all elements from details db
	 * details db mirrors metadata for real saves in saves db
	 *
	 * @returns {Array} list of details for all saves in idb
	 */
	function getSaveDetails() {
		const transactionRequest = db.transaction(["details"], "readonly");
		const details = transactionRequest.objectStore("details").getAll();

		return makePromise(details);
	}

	/**
	 * mercilessly clear all object stores one step short from outright deleting the db itself
	 *
	 * @returns {Promise | undefined} promise to maybe report when the deed is done or return early
	 */
	function clearAll() {
		if (lock) return;
		const transactionRequest = db.transaction(["saves", "details"], "readwrite");
		transactionRequest.objectStore("saves").clear();
		transactionRequest.objectStore("details").clear();

		return makePromise(transactionRequest);
	}

	let listLength; // store save list length in idb
	let listPage; // same with the current page
	const listLengthMax = 20; // maximum number of rows
	const listPageMax = 20; // maximum number of pages
	let latestSave = { slot: 1, date: 0 }; // keep track of the most recent save, separately from autosave on slot 0

	/**
	 * construct a saves list page, with configurable length
	 *
	 * @param {number} page
	 * @param {number} length
	 * @returns {DocumentFragment};
	 */
	function showSavesList(page = listPage - 1, length = listLength) {
		const listContainer = document.createElement("div");
		listContainer.id = "savesListContainer";
		// create a header row for the table
		const header = document.createElement("div");
		header.className = "savesListRow";
		header.innerHTML =
			"<div class=saveGroup><div class=\"saveId\">#</div><div class=\"saveButton\">Save/Load</div><div class=\"saveName\">ID/Name</div><div class=\"saveDetails\">Details</div><div class=\"deleteButton\"></div></div>";
		listContainer.appendChild(header);

		// request save details from indexedDB, then populate the list when request is fulfilled
		idb.getSaveDetails().then(details => {
			if (!Array.isArray(details)) return;

			const saveUnlock = !Story.get(State.passage).tags.includes("nosave") && V.replayScene === undefined;

			// find the most recent save that is not autosave
			latestSave = { slot: 1, date: 0 }; // re-init latest slot every time
			let autoSaveDate; // store timestamp for the autosave separately
			details.forEach(d => {
				if (d.slot === 0) autoSaveDate = d.data.date;
				else if (d.data.date > latestSave.date) {
					latestSave.slot = d.slot;
					latestSave.date = d.data.date;
				}
			});
			// default list length is set here
			if (!listLength) {
				// idb is indexed by slot, so the highest is always last
				const slot = details.length ? details.last().slot : 0;
				// adjust list length to include saves in the highest slot
				for (listLength = 10; slot > listLength * listPageMax && listLength < listLengthMax; listLength++);
				length = listLength;
			}
			// if not set to a correct value, show the page with the most recent save
			if (!Number.isInteger(page)) {
				// autosave is shown on every page, so if autosave is the most recent save - open the page with the most recent non-autosave with the same ID
				const latestSlot = details.find(d => d.slot === latestSave.slot);
				if (latestSlot) {
					const autoSaveExists = details[0].slot === 0;
					const ignoreAutoSave = latestSlot.data.date > autoSaveDate || latestSlot.data.metadata.saveId === details[0].data.metadata.saveId;
					if (!autoSaveExists || ignoreAutoSave) page = Math.floor((latestSave.slot - 1) / length);
					else page = 0;
				} else page = 0;
				listPage = page + 1;
			}
			// default object details for an empty slot
			const defaultDetailsObj = { date: "", title: "", metadata: { saveId: "", saveName: "" } };

			// always show autosave on top
			const autoDetailsObj = details[0] && details[0].slot === 0 ? details[0].data : clone(defaultDetailsObj);
			if (autoSaveDate > latestSave.date) autoDetailsObj.latestSlot = true;
			autoDetailsObj.slot = 0;
			// don't show if autosaves are disabled by the engine
			if (Save.autosave.ok())	listContainer.appendChild(generateSaveRow(autoDetailsObj));

			// main loop for adding the save rows
			for (let slot = length * page + 1; slot < length * (page + 1) + 1; slot++) {
				// create default details
				let detailsObj = clone(defaultDetailsObj);
				// if a save exists in idb, replace the details with recorded ones
				const detailsIndex = details.findIndex(d => d.slot === slot);
				if (detailsIndex !== -1) {
					detailsObj = details[detailsIndex].data;
					// add a flag to highlight the most recent save
					if (Number(latestSave.slot) === slot) detailsObj.latestSlot = true;
				}
				detailsObj.slot = slot;
				detailsObj.saveUnlock = saveUnlock;
				listContainer.appendChild(generateSaveRow(detailsObj));
			}

			// append a footer row
			const footer = document.createElement("div");
			footer.className = "savesListRow";
			// TODO: this should not be dol-specific by default
			footer.innerHTML = "<div class=saveGroup><span style='margin: 0'>Special thanks to all those who <a class='link-external' target='_blank' href='https://subscribestar.adult/vrelnir'>Support Degrees of Lewdity</span><div class='saveId'></div><div class='saveButton'></div><div class='saveName'></div><div class='saveDetails'></div></div>";
			if (footerHTML) footer.firstChild.firstChild.innerHTML = footerHTML;
			listContainer.appendChild(footer);
			const clearButton = document.createElement("input");
			Object.assign(clearButton, {
				type: "button",
				className: "saveButton saveMenuButton right",
				value: "Delete All",
				onclick: () => saveList("confirm clear"),
			});
			listContainer.lastChild.appendChild(clearButton);
		});
		return listContainer;
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
		group.appendChild(saveId);

		// save/load buttons container
		const saveload = document.createElement("div");
		saveload.className = "saveButton";

		// save button
		const saveButton = document.createElement("input");
		saveButton.type = "button";
		saveButton.value = "Save";
		if (details.saveUnlock) {
			saveButton.className = "saveMenuButton";
			saveButton.onclick = () => saveList("confirm save", details);
		} else {
			saveButton.disabled = true;
		}

		// load button
		const loadButton = document.createElement("input");
		loadButton.type = "button";
		loadButton.value = "Load";
		if (details.date) {
			loadButton.className = "saveMenuButton";
			loadButton.onclick = () => saveList("confirm load", details);
		} else {
			loadButton.disabled = true;
		}
		if (details.slot !== 0) saveload.appendChild(saveButton);
		saveload.appendChild(loadButton);
		group.appendChild(saveload);

		// save name
		const saveName = document.createElement("div");
		saveName.className = "saveName";
		// highlight saves with currently loaded save's id
		if (V.saveId === details.metadata.saveId) saveName.classList.add("gold");
		saveName.innerText = details.metadata.saveName ? details.metadata.saveName.slice(0, 10) : details.metadata.saveId;
		group.appendChild(saveName);

		// save details
		const saveDetails = document.createElement("div");
		saveDetails.className = "saveDetails";
		// description
		const description = document.createElement("span");
		description.innerText = details.title;
		// date stamp
		const date = document.createElement("span");
		date.className = "datestamp";
		if (details.date) {
			// highlight (most) recent save(s)
			if (details.latestSlot) date.classList.add("green");
			else if (details.date > Date.now() - 1800000) date.classList.add("gold");
			date.innerText = new Date(details.date).toLocaleString();
		}
		saveDetails.appendChild(description);
		saveDetails.appendChild(date);
		group.appendChild(saveDetails);

		// delete button
		const deleteButton = document.createElement("input");
		Object.assign(deleteButton, {
			className: "deleteButton right",
			type: "button",
			value: "Delete",
		});
		if (details.date) {
			deleteButton.classList.add("saveMenuButton");
			deleteButton.onclick = () => saveList("confirm delete", details);
		} else {
			deleteButton.disabled = true;
		}

		row.appendChild(group);
		row.appendChild(deleteButton);

		return row;
	}

	// alias for closing the saves menu
	if (typeof window.closeOverlay === "undefined") window.closeOverlay = Dialog.close;

	/**
	 * replace contents of saveList div with something useful
	 *
	 * @param {string} mode switch for displaying saves list or confirmations
	 * @param {object} details save details for confirmations
	 */
	function saveList(mode = "show saves", details) {
		// const savesDiv = document.getElementById("saveList");
		const savesDiv = document.getElementById("saveList") || document.getElementsByClassName("saveList")[0] || document.getElementsByClassName("saves")[0];
		const list = document.createDocumentFragment();

		// prepare a re-usable cancel button
		const cancelButton = document.createElement("input");
		Object.assign(cancelButton, {
			type: "button",
			className: "saveMenuButton saveMenuConfirm",
			value: "Cancel",
			onclick: () => saveList("show saves"),
		});

		// prepare old save info (if provided)
		const oldSaveDescription = document.createDocumentFragment();
		if (details && details.date) {
			oldSaveDescription.appendChild(document.createElement("p"));
			oldSaveDescription.lastChild.innerText = "Title: " + details.title;
			oldSaveDescription.appendChild(document.createElement("p"));
			oldSaveDescription.lastChild.innerText =
				(details.metadata.saveName ? "Save Name: " + details.metadata.saveName : "Save Id: " + details.metadata.saveId) +
				", Date: " +
				new Date(details.date).toLocaleString();
		}

		switch (mode) {
			case "show saves": {
				// print saves list
				// show the warnings
				if (V.replayScene || Story.get(State.passage).tags.includes("nosave")) {
					list.appendChild(document.createElement("h3"));
					list.lastChild.className = "red";
					if (V.replayScene) list.lastChild.innerText = "The scene viewer is currently in use, preventing the use of the save system.";
					else list.lastChild.innerText = "You can't save here!";
				}
				list.appendChild(document.createElement("p"));
				list.lastChild.innerText =
					"Saves here will be lost if your browser cache is cleared. Exporting is recommended to prevent the loss of saves from occurring.";

				const lostSaves = document.createElement("p");
				lostSaves.innerHTML = "<i class=\"description\"><u>Where are my saves?</u></i> ";
				const lostSavesTooltip = document.createElement("mouse");
				lostSavesTooltip.classList.add("tooltip", "linkBlue");
				lostSavesTooltip.innerText = "(?)";
				lostSavesTooltip.appendChild(document.createElement("span"));
				lostSavesTooltip.lastChild.innerText = `If you can't find your saves, it's possible you saved them using a different storage method. Try toggling the "Use old legacy storage" option below the saves list.`;
				lostSaves.appendChild(lostSavesTooltip);
				list.appendChild(lostSaves);


				// THE SAVES LIST
				list.appendChild(showSavesList());

				// add pager
				// previous page button
				const prevPage = document.createElement("input");
				Object.assign(prevPage, {
					type: "button",
					value: " < ",
					disabled: listPage === 1,
					onclick: () => {
						if (listPage > 1) listPage--;
						saveList();
					},
				});

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
						saveList();
					},
				});

				// next page button
				const nextPage = document.createElement("input");
				Object.assign(nextPage, {
					type: "button",
					value: " > ",
					disabled: listPage >= listPageMax,
					onclick: () => {
						if (listPage < listPageMax) listPage++;
						saveList();
					},
				});

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
						saveList();
					},
				});

				// jump to most recent save button
				const jumpToLatest = document.createElement("input");
				Object.assign(jumpToLatest, {
					type: "button",
					value: " Jump to most recent manual save ",
					onclick: () => {
						// potentially exploitable to allow saving to slots way above the limit, but the limit is arbitrary to begin with, and idb doesn't actually suffer one bit from going beyond that limit
						listPage = Math.floor((latestSave.slot - 1) / listLength + 1);
						saveList();
						setTimeout(() => {
							const el = document.getElementById("latestSaveRow");
							if (el != null) {
								el.classList.remove("jumpToSaveTransition");
								el.classList.add("jumpToSaveTransition");
							}
						}, Engine.minDomActionDelay);
					},
				});

				const pager = document.createElement("div");
				pager.append("Page: ");
				pager.appendChild(prevPage);
				pager.appendChild(pageNum);
				pager.appendChild(nextPage);
				pager.append(" Saves per page: ");
				pager.appendChild(pageLen);
				pager.appendChild(jumpToLatest);

				list.appendChild(pager);

				// add confirmation toggles
				const reqSave = document.createElement("input");
				Object.assign(reqSave, {
					type: "checkbox",
					checked: V.confirmSave,
					onchange: () => V.confirmSave = reqSave.checked,
				});
				list.appendChild(document.createElement("label"));
				list.lastChild.append(reqSave);
				list.lastChild.append(" Require confirmation on Save ");
				list.append(document.createElement("br"));

				const reqLoad = document.createElement("input");
				Object.assign(reqLoad, {
					type: "checkbox",
					checked: V.confirmLoad,
					onchange: () => V.confirmLoad = reqLoad.checked,
				});
				list.appendChild(document.createElement("label"));
				list.lastChild.append(reqLoad);
				list.lastChild.append(" Require confirmation on Load ");
				list.append(document.createElement("br"));

				const reqDelete = document.createElement("input");
				Object.assign(reqDelete, {
					type: "checkbox",
					checked: V.confirmDelete,
					onchange: () => V.confirmDelete = reqDelete.checked,
				});
				list.appendChild(document.createElement("label"));
				list.lastChild.append(reqDelete);
				list.lastChild.append(" Require confirmation on Delete ");
				list.append(document.createElement("br"));

				// add instant idb switcher
				const idbToggle = document.createElement("input");
				Object.assign(idbToggle, {
					type: "checkbox",
					checked: !idb.active,
					onchange: () => {
						idb.active = !idbToggle.checked;
						if (!idb.active) {
							if (window.DoLSave)	Wikifier.wikifyEval("<<replace #saveList>><<saveList>><</replace>>");
							else UI.buildSaves();
						}
					},
				});
				list.appendChild(document.createElement("label"));
				list.lastChild.append(idbToggle);
				list.lastChild.append(" Use old legacy save storage ");

				setTimeout(() => {
					savesDiv.innerHTML = "";
					savesDiv.append(list);
					const pageField = document.getElementById("pageNum");
					if (pageField != null) pageField.value = listPage;
					const lengthField = document.getElementById("pageLen");
					if (lengthField != null) lengthField.value = listLength;
					Dialog.resize(); // fix dialog size
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm save": {
				// skip confirmation if the slot is empty, but do not skip on saveId mismatch, even if confirmation not required
				if (!details.date || !V.confirmSave && details.metadata.saveId === V.saveId) return saveState(details.slot).then(window.closeOverlay());
				const confirmSave = document.createElement("div");
				confirmSave.className = "saveBorder";
				confirmSave.appendChild(document.createElement("h3"));
				confirmSave.lastChild.className = "red";
				if (details.date === "") {
					confirmSave.lastChild.innerText = "Save on slot " + details.slot;
				} else {
					confirmSave.lastChild.innerText = "Overwrite save in slot " + details.slot;
					confirmSave.appendChild(oldSaveDescription);
				}
				if (details.date && V.saveId !== details.metadata.saveId) {
					confirmSave.appendChild(document.createElement("span"));
					confirmSave.lastChild.className = "red";
					confirmSave.lastChild.innerText = "Save ID does not match, continue with overwrite?";
				}

				const saveButton = document.createElement("input");
				Object.assign(saveButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: "Save",
					onclick: () => saveState(details.slot).then(() => window.closeOverlay()),
				});
				confirmSave.appendChild(document.createElement("div"));
				confirmSave.lastChild.appendChild(saveButton);
				confirmSave.lastChild.appendChild(cancelButton);

				list.appendChild(confirmSave);
				setTimeout(() => {
					savesDiv.innerHTML = "";
					savesDiv.append(list);
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm delete": {
				// skip confirmation if corresponding toggle is off
				if (!V.confirmDelete) return deleteItem(details.slot).then(() => saveList());
				const confirmDelete = document.createElement("div");
				confirmDelete.className = "saveBorder";
				confirmDelete.appendChild(document.createElement("h3"));
				confirmDelete.lastChild.className = "red";
				confirmDelete.lastChild.innerText = "Delete save in slot " + (details.slot === 0 ? "auto" : details.slot);
				confirmDelete.appendChild(oldSaveDescription);

				const deleteButton = document.createElement("input");
				Object.assign(deleteButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: "Delete",
					onclick: () => deleteItem(details.slot).then(() => saveList()),
				});
				confirmDelete.appendChild(document.createElement("div"));
				confirmDelete.lastChild.append(deleteButton);
				confirmDelete.lastChild.appendChild(cancelButton);

				list.appendChild(confirmDelete);
				setTimeout(() => {
					savesDiv.innerHTML = "";
					savesDiv.append(list);
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm load": {
				// skip confirmation if corresponding toggle is off
				if (!V.confirmLoad) return loadState(details.slot).then(() => window.closeOverlay());
				const confirmLoad = document.createElement("div");
				confirmLoad.className = "saveBorder";
				confirmLoad.appendChild(document.createElement("h3"));
				confirmLoad.lastChild.className = "red";
				confirmLoad.lastChild.innerText = "Load slot " + (details.slot === 0 ? "auto" : details.slot);
				confirmLoad.appendChild(oldSaveDescription);

				const loadButton = document.createElement("input");
				Object.assign(loadButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: "Load",
					onclick: () => idb.loadState(details.slot).then(() => window.closeOverlay()),
				});
				confirmLoad.appendChild(document.createElement("div"));
				confirmLoad.lastChild.append(loadButton);
				confirmLoad.lastChild.appendChild(cancelButton);

				list.appendChild(confirmLoad);
				setTimeout(() => {
					savesDiv.innerHTML = "";
					savesDiv.append(list);
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm clear": {
				// storage wipes always require confirmation
				const confirmClear = document.createElement("div");
				confirmClear.className = "saveBorder";
				confirmClear.appendChild(document.createElement("h2"));
				confirmClear.lastChild.className = "red";
				confirmClear.lastChild.innerText = "WARNING - Are you sure you would like to delete all saves?";

				const clearButton = document.createElement("input");
				Object.assign(clearButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: "Clear All Saves",
					onclick: () => clearAll().then(() => saveList()),
				});
				confirmClear.appendChild(document.createElement("div"));
				confirmClear.lastChild.append(clearButton);
				confirmClear.lastChild.appendChild(cancelButton);

				list.appendChild(confirmClear);
				setTimeout(() => {
					savesDiv.innerHTML = "";
					savesDiv.append(list);
				}, Engine.minDomActionDelay);
				break;
			}
		}
	}

	return Object.freeze({
		get dbName() {
			return dbName;
		},
		set dbName(val) {
			dbName = val;
		},
		get lock() {
			return lock;
		},
		set lock(val) {
			lock = Boolean(val);
		},
		get active() {
			return active;
		},
		set active(val) {
			active = val;
		},
		get listLength() {
			return listLength;
		},
		set listLength(val) {
			listLength = val;
		},
		get listPage() {
			return listPage;
		},
		set listPage(val) {
			listPage = val;
		},
		getItem,
		setItem,
		deleteItem,
		clearAll,
		getSaveDetails,
		saveState,
		loadState,
		importFromLocalStorage,
		saveList,
		footerHTML,
		init(dbName) {
			return openDB(dbName);
		},
		baddies,
	});
})();
window.idb = idb;
