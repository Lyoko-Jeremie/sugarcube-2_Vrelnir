/***********************************************************************************************************************

	lib/prngwrapper.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

var PRNGWrapper = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		PRNGWrapper Class.
	*******************************************************************************************************************/
	class PRNGWrapper {
		constructor(seed, options) {
			/* Create the Math.seedrandom initialisation to use the state object. */
			/* Pass seed through the constructor to return either a copy of itself, or a new generated seed. */
			const seeder = new Math.seedrandom(seed, { state: false }, (prng, seed) => ({seed}));
			const prngObj = new Math.seedrandom(seeder.seed, options);
			/* eslint-disable new-cap */
			Object.defineProperties(this, {
				_prng: {
					value: prngObj
				},
				seed: {
					writable: true,
					value: seeder.seed
				},
				pull: {
					writable: true,
					value: 0
				},
				state: {
					value: prngObj.state
				},
				random: {
					value() {
						this.pull++;
						return this._prng();
					}
				}
			});
			/* eslint-enable new-cap */
		}

		static marshal(prng) {
			/* Modify warning message so that it instead checks for only the new state property. */
			if (!prng || !prng.hasOwnProperty('state')) {
				throw new Error('PRNG is missing required data');
			}

			/* Only return the state of the PRNG object.
				Old: seed : prng.seed,
					 pull : prng.pull */
			return {
				prng: prng.state(),
				seed: prng.seed,
				pull: prng.pull
			};
		}

		static unmarshal(prngObj) {
			/* Modify warning message so that it instead checks for only the new state property. */
			if (!prngObj || !prngObj.hasOwnProperty('state')) {
				throw new Error('PRNG object is missing required state data');
			}

			/*
				Create a new PRNG using the original seed and pull values from it until it
				has reached the original pull count.
			*/
			/* Create new PRNGWrapper with the state object of the old PRNG object. */
			const prng = new PRNGWrapper(prngObj.seed, { state: prngObj.state });
			prng.pull = prngObj.pull;
			return prng;
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return PRNGWrapper;
})();
