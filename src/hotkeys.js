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
	let disableNumbers = false;
	let disableRNGReload = false;
	let keyNumberMatcher;
	let maxKeyDescLength;
	let throttle = false;
	let skipElements = ".no-numberify, .no-numberify *"; // here, we match class "no-numberify", and then also all it's children
	let includeElements = ""; // here, we can set up a matcher for exceptions that shouldn't be skipped

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

	function generateLinkNumbers(content, visibility) {
		if (!enabled || disableNumbers || V.options && !V.options.numberify_enabled) return;

		// don't run this too often. ward off the worst outcomes of bad programming that would trigger massive <<replace>> spam
		const stamp = performance.now();
		if (throttle + 100 > stamp) {
			throttle = stamp;
			generateDebounce();
			return;
		}
		throttle = stamp;

		// find all visible .link-internal elements, then remove from them all skipElements unless they are also in includeElements
		if (visibility) {
			// using :hidden pseudo-class is preferred for telling actual visibility of the link, but it's not available at the passagerender time
			currentLinks = $(content).find(".link-internal").not(":hidden");
		} else {
			currentLinks = $(content).find(".link-internal").filter((i, link) => getComputedStyle(link).display !== "none");
		}
		if (skipElements && includeElements) {
			const goodies = $(content).find(includeElements);
			const baddies = $(content).find(skipElements).not(goodies);
			currentLinks = currentLinks.not(baddies);
		} else if (skipElements) {
			const baddies = $(content).find(skipElements);
			currentLinks = currentLinks.not(baddies);
		}

		for (let i = 0; i < currentLinks.length; i++) {
			const el = currentLinks[i];
			if (i === 40) {
				// we don't have enough shortcuts
				if (enabled === "debug") console.log("Links: there's too many! found", currentLinks.length, "matches, exiting after the 40th one.\n time spent: ", performance.now() - stamp)
				return;
			}
			const keyNumber = numberPrepend + getPrettyKeyNumber(i + 1) + numberAppend;
			if (keyNumberMatcher.test(el.innerHTML.slice(0, maxKeyDescLength))) {
				// replace previously assigned number
				el.innerHTML = el.innerHTML.replace(keyNumberMatcher, keyNumber);
			} else {
				el.prepend(keyNumber);
			}
		}
		if (enabled === "debug") console.log("Links: generated", currentLinks.length, "links, took", performance.now() - stamp, "ms");
	}

	// this is a mostly user-triggered function that is almost guaranteed to have the passage already rendered
	function generate() {
		return generateLinkNumbers(document.getElementsByClassName("passage")[0] || document, true);
	}

	// and this is our bouncer that we employ to prevent unwanted spam
	const generateDebounce = $.debounce(200, generate);

	function linkFollow(index) {
		if (disableNumbers) return;
		if ($(currentLinks).length >= index) $(currentLinks[index - 1].click());
	}

	function inputFocused() {
		if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && !["radio", "button", "checkbox", "submit", "reset", "image"].includes(document.activeElement.type)) return true;
		return false;
	}

	function init() {
		// collect all links and assign their numbers
		$(document).on(":passagerender", ev => {
			currentLinks = [];
			throttle = 0;
			generateLinkNumbers(ev.content);
		});

		// prevent numpad keys from triggering browser's default shortcuts
		$(document).on("keydown", ev => {
			if (inputFocused()) return;
			if (ev.code.startsWith("Numpad")) ev.preventDefault();
		});

		// assign shortcuts
		$(document).on("keyup", ev => {
			if (!enabled || V.tempDisable || V.options && !V.options.numberify_enabled || inputFocused()) return;
			if (Dialog.isOpen()) return ev.code === "Escape" ? Dialog.close() : false;

			let offset = 0;
			if (ev.shiftKey) offset = 10;
			else if (ev.code.startsWith("Numpad") && ev.keyCode < 90) offset = 10; // windows must die
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
					// reload current page with different rng
					if (disableRNGReload) break; // let game devs disable potentially cheaty option
					State.restore(true);
					// State.unmarshalForSave(State.marshalForSave()); // save and immediately reload current state
					if (State.prng.isEnabled()) { // hack for predictable rng
						State.random(); // update rng pool
						const frame = State.history[State.activeIndex]; // active history frame
						frame.pull = State.prng.pull; // update pull
					}
					Engine.show();
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
		generateLinkNumbers: { value: generateLinkNumbers },
		pushTheButton:       { value: linkFollow },
		numberPrepend:       { get() { return numberPrepend;    }, set(val) { numberPrepend = val; keyNumberMatcherUpdate(); } },
		numberAppend:        { get() { return numberAppend;     }, set(val) { numberAppend = val; keyNumberMatcherUpdate(); } },
		skipElements:        { get() { return skipElements;     }, set(val) { skipElements = val; } },
		includeElements:     { get() { return includeElements;  }, set(val) { includeElements = val; } },
		enabled:             { get() { return enabled;          }, set(val) { enabled = val; } },
		disableRNGReload:    { get() { return disableRNGReload; }, set(val) { disableRNGReload = val; } },
		disableNumbers:      { get() { return disableNumbers;   }, set(val) { disableNumbers = val; } },
		throttle:            { get() { return throttle;         }, set(val) { throttle = val; } },
		currentLinks:        { get() { return currentLinks;     } },

	}));
})();
window.Links = Links;
