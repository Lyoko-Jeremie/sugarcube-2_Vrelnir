/* eslint no-undef: "off", no-param-reassign: "off", no-alert: "off", no-fallthrough: "off", no-dupe-args: "warn", no-irregular-whitespace: "warn", max-len: "off", key-spacing: ["warn", {beforeColon: false, afterColon: true}], comma-dangle: ["warn", "always-multiline"], quotes: ["warn", "double"], indent: ["warn", "tab", {SwitchCase: 1}], id-length: "off", prefer-template: "off", brace-style: ["warn", "1tbs"] */
/**
 * hotkeys support for links and buttons
 */

const Links = (() => {
	"use strict";

	let currentLinks = [];
	let numberPrepend = "(";
	let numberAppend = ") ";
	let enabled = true;
	let disableRNGReload = false;
	let keyNumberMatcher;
	let maxKeyDescLength;
	const disableNumberifyInVisibleElements = ["#passage-testing-room"];

	function keyNumberMatcherUpdate() {
		keyNumberMatcher = new RegExp(RegExp.escape(numberPrepend) + "((Ctrl|Alt|Shift) \\+ )?\\d" + RegExp.escape(numberAppend));
		// limit the search to as little characters from the start of the line as possible to eliminate or at least reduce false-positives with custom append/prepend values
		maxKeyDescLength = numberAppend.length + numberPrepend.length + 9;
	}
	keyNumberMatcherUpdate();

	function getPrettyKeyNumber(counter) {
		let str = "";

		switch (Math.floor((counter - 1) / 10)) { // 10 should be counted as 0
			case 3: str = "Alt + "; break;
			case 2: str = "Ctrl + "; break;
			case 1: str = "Shift + "; break;
		}
		str += (counter % 10).toString();

		return str;
	}

	function generateLinkNumbers(content) {
		if (!Links.enabled || V.options && !V.options.numberify_enabled) return;

		for (let i = 0; i < disableNumberifyInVisibleElements.length; i++) {
			if ($(content).find(disableNumberifyInVisibleElements[i]).length || $(content).is(disableNumberifyInVisibleElements[i])) return; // simply skip this render
		}

		// find all .link-internal, then remove from them all .no-numberify unless they also have .yes-numberify
		currentLinks = $(content).find(".link-internal").not($(content).find(".no-numberify, .no-numberify *").not(".yes-numberify"));

		$(currentLinks).each((i, el) => {
			const keyNumber = numberPrepend + getPrettyKeyNumber(i + 1) + numberAppend;
			if (keyNumberMatcher.test(el.innerHTML.slice(0, maxKeyDescLength))) {
				el.innerHTML = el.innerHTML.replace(keyNumberMatcher, keyNumber);
			} else {
				$(el).html(keyNumber + $(el).html());
			}
		});
	}

	function generate() {
		return generateLinkNumbers(document.getElementsByClassName("passage")[0] || document);
	}

	function linkFollow(index) {
		if ($(currentLinks).length >= index) $(currentLinks[index - 1].click());
	}

	function init() {
		// collect all links and assign their numbers
		$(document).on(":passagerender", ev => {
			currentLinks = [];
			generateLinkNumbers(ev.content);
		});

		// prevent numpad keys from triggering browser's default shortcuts
		$(document).on("keydown", ev => {
			if (ev.code.startsWith("Numpad")) ev.preventDefault();
		});

		// assign shortcuts
		$(document).on("keyup", ev => {
			if (!enabled || V.tempDisable || V.options && !V.options.numberify_enabled) return;
			if (document.activeElement.tagName === "INPUT" && document.activeElement.type !== "radio" && document.activeElement.type !== "checkbox") return;

			let offset = 0;
			if (ev.shiftKey) offset = 10;
			else if (ev.ctrlKey) offset = 20;
			else if (ev.altKey) offset = 30;

			switch (ev.code) {
				case "Digit1": case "Numpad1": case "KeyN":
					linkFollow(offset + 1);
					break;
				case "Digit2": case "Numpad2":
					linkFollow(offset + 2);
					break;
				case "Digit3": case "Numpad3":
					linkFollow(offset + 3);
					break;
				case "Digit4": case "Numpad4":
					linkFollow(offset + 4);
					break;
				case "Digit5": case "Numpad5":
					linkFollow(offset + 5);
					break;
				case "Digit6": case "Numpad6":
					linkFollow(offset + 6);
					break;
				case "Digit7": case "Numpad7":
					linkFollow(offset + 7);
					break;
				case "Digit8": case "Numpad8":
					linkFollow(offset + 8);
					break;
				case "Digit9": case "Numpad9":
					linkFollow(offset + 9);
					break;
				case "Digit0": case "Numpad0":
					linkFollow(offset + 10);
					break;
				case "NumpadDivide":
					// go back in history, twice if shift is pressed
					if (ev.shiftKey) Engine.go(-2);
					else Engine.backward();
					break;
				case "NumpadMultiply":
					// reload current page
					if (disableRNGReload) break;
					if (Config.history.maxSessionStates < State.history.length) {
						// make sure you won't lose the history to maxSessionStates being too low
						const tmpMaxSessionStates = Config.history.maxSessionStates;
						Config.history.maxSessionStates = State.history.length;
						State.setSessionState(State.marshalForSave());
						Config.history.maxSessionStates = tmpMaxSessionStates;
					}
					if (!State.restore()) break; // restores the state, returns with nothing if failed
					if (State.prng.isEnabled()) {
						const sessionState = State.getSessionState(); // get game state from session storage
						const frame = sessionState.history[sessionState.index]; // current history frame
						State.random(); // re-roll rng
						frame.prng = State.prng.state; // save new rng state
						frame.pull++; // update pull counter
						State.setSessionState(sessionState); // send altered session data back into storage
						Engine.show(); // replay the passage with new rng
						break;
					}
					State.show();
					break;
				case "NumpadSubtract":
					// go forward in history
					if (ev.shiftKey) Engine.go(2);
					else Engine.forward();
					break;
			}
		});
	}

	return Object.freeze(Object.defineProperties({}, {
		init: { value: init },
		generate: { value: generate },
		currentLinks: {
			get() {
				return currentLinks;
			},
		},
		disableNumberifyInVisibleElements: { value: disableNumberifyInVisibleElements },
		generateLinkNumbers: { value: generateLinkNumbers },
		pushTheButton: { value: linkFollow },
		numberPrepend: {
			get() {
				return  numberPrepend;
			},
			set(value) {
				numberPrepend = value;
				keyNumberMatcherUpdate();
			},
		},
		numberAppend: {
			get() {
				return numberAppend;
			},
			set(value) {
				numberAppend = value;
				keyNumberMatcherUpdate();
			},
		},
		enabled: {
			get() {
				return enabled;
			},
			set(value) {
				enabled = value;
			},
		},
		disableRNGReload: {
			get() {
				return disableRNGReload;
			},
			set(value) {
				disableRNGReload = value;
			},
		},
	}));
})();
window.Links = Links;
