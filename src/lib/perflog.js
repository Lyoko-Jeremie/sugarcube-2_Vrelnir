/* eslint-disable id-length */
/* eslint-disable strict */
/*
	global Perflog, State
*/
const Perflog = {};

Perflog.millitime = () => performance.now();

/**
 * Widget performance records for one passage.
 * Key = widget name, value = {
 *  name: widget name,
 * 	n: number of widget calls,
 *  total: Sum of execution times including internal widget calls, milliseconds
 *  own: Sum of execution times excluding internal widget calls, milliseconds
 * }.
 */
let wpRec = {}; // Widget performance records
const wpSelf = { name : '__perflog_logWidgetEnd', n : 0, total : 0, own : 0 };
wpRec[wpSelf.name] = wpSelf;
/**
 * Global widget performance records.
 */
Perflog.globalRec = {};
Perflog.lastRec = {};
Perflog.enabled = true;
Perflog.self = true; // Record own performance
/**
 * Performance stack entry = { t0: widget start time, i: internal widget duration }.
 */
const wpStack = []; // Widget performance stack
Perflog.nPassages = 0;

$(document).on(':passageend', () => {
	if (!Perflog.enabled || !State.variables.debug) return;
	try {
		if (Perflog.self) Perflog.logWidgetStart('__perflog_passageEnd');
		Perflog.nPassages++;
		for (const name in wpRec) {
			if (!Object.prototype.hasOwnProperty.call(wpRec, name)) continue;
			const rec = wpRec[name];
			const grec = Perflog.globalRec[name];
			if (!grec) Perflog.globalRec[name] = rec;
			else {
				grec.n += rec.n;
				grec.total += rec.total;
				grec.own += rec.own;
			}
		}
		Perflog.lastRec = wpRec;
		wpRec = {};
	}
	finally {
		if (Perflog.self) Perflog.logWidgetEnd('__perflog_passageEnd');
	}
});

Perflog.logWidgetStart = function (widgetName) {
	if (!Perflog.enabled || !State.variables.debug) return;
	wpStack.push({ name : widgetName, t0 : Perflog.millitime(), i : 0 });
};

Perflog.logWidgetTime = function (widgetName, totaltime, internaltime) {
	const it = typeof internaltime === 'number' ? internaltime : 0;
	const prev = wpStack[wpStack.length - 1];
	if (prev) prev.i += totaltime;
	let perfrec = wpRec[widgetName];
	if (!perfrec) {
		perfrec = { name : widgetName, n : 0, total : 0, own : 0 };
		wpRec[widgetName] = perfrec;
	}
	perfrec.n++;
	perfrec.total += totaltime;
	perfrec.own += totaltime - it;
};

Perflog.logWidgetEnd = function (widgetName) {
	if (!Perflog.enabled || !State.variables.debug) return;
	const time = Perflog.millitime();
	const top = wpStack[wpStack.length - 1];
	if (!top || top.name !== widgetName) {
		console.error('Inconsistent widget performance stack', wpStack);
		return;
	}
	wpStack.pop();
	Perflog.logWidgetTime(widgetName, time - top.t0, top.i);
	if (Perflog.self) {
		const selfDt = Perflog.millitime() - time;
		wpSelf.n++;
		wpSelf.own += selfDt;
		wpSelf.total += selfDt;
	}
};

function niceround(x) {
	if (Math.floor(x) === x) return x;
	if (x > -1 && x < 1) return Math.round(x * 1000) / 1000;
	return Math.round(x * 10) / 10;
}

Perflog.report = function (options) {
	if (!State.variables.debug) {
		console.warn('Performance logging is disabled due to debug being turned off.');
		return;
	}
	const opts = Object.assign({ sort : 'own', limit : 20, global : true, round : true, filter : null }, options);
	const numfn = opts.round ? niceround : function (x) { return x; };
	let entries;
	if (opts.global) {
		const np = Perflog.nPassages || 1;
		entries = Object.values(Perflog.globalRec).map(e => ({
			name    : e.name,
			n       : e.n,
			total   : numfn(e.total),
			own     : numfn(e.own),
			npp     : numfn(e.n / np),
			totalpp : numfn(e.total / np),
			ownpp   : numfn(e.own / np),
			totalp1 : numfn(e.total / e.n),
			ownp1   : numfn(e.own / e.n)
		}));
	}
	else {
		entries = Object.values(Perflog.lastRec).map(e => ({
			name    : e.name,
			n       : e.n,
			total   : numfn(e.total),
			own     : numfn(e.own),
			totalp1 : numfn(e.total / e.n),
			ownp1   : numfn(e.own / e.n)
		}));
	}
	if (opts.filter) {
		const matcher = new RegExp(opts.filter);
		entries = entries.filter(x => typeof x.name === 'string' && matcher.test(x.name));
	}
	let comparator;
	const sort = opts.sort;
	switch (sort) {
	case 'own':
	case 'total':
	case 'n':
	case 'npp':
	case 'ownpp':
	case 'totalpp':
	case 'totalp1':
	case 'ownp1':
		comparator = (a, b) => b[sort] - a[sort];
		break;
	case 'name':
	default:
		comparator = function (a, b) {
			if (a.name < b.name) return -1;
			if (a.name > b.name) return 1;
			return 0;
		};
	}
	entries.sort(comparator);
	if (opts.limit > 0 && entries.length > opts.limit) entries.splice(opts.limit);
	return entries;
};

window.Perflog = Perflog;

