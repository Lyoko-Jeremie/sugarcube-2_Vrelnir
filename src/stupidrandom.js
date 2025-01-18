/* dumb predictable rng algorithm that i came up with as i was falling asleep yesterday */
/* copyleft anomajou, 2024 */
/* also, you owe author a beer now */

class PRNG {
	constructor(seed, pull) {
		// primes are a prime source of entropy in our generator. pun intended. intend your puns, people!
		this.primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
		// limiter makes sure that after multiplying all parts of a randomizer at their maximum theoretical values, we
		// are still below Number.MAX_SAFE_INTEGER, for better granularity.
		// incidentally, it ends up being 17623651, a prime number, which is perfect for our use
		this.limiter = Math.floor(Math.sqrt(Number.MAX_SAFE_INTEGER / this.primes[this.primes.length - 1]));
		// factor needs to consistently overflow the limiter in an inconsistent way when multiplied by integers in
		// increments of 1, so ideally it has to be another prime in the interval (limiter/2 .. limiter).
		// unlike the limiter, it is much harder to determine programmatically...
		// note: if Number.MAX_SAFE_INTEGER is NOT 9007199254740991 on your system - you need to adjust this factor!
		this.factor = 12345653;
		// pull is the number of times random() was called, and the main input of our generator.
		// it doesn't actually have to be an integer, just incrementable
		this.pull = Number(pull) || 0;

		// seed is the second input for the generator. it has to be below ~1 to stay within MAX_SAFE_INTEGER (although
		// it doesn't hurt much if it's not), and it shouldn't be below ~0.25, or the factor will have trouble
		// overflowing as often as it should. still, other values should be possible, for science
		switch (typeof seed) {
			case 'number': {
				if (seed < 0.25 || seed > 1) console.warn(`recommended seed value is between 0.25 and 1, got ${seed}`);
				this.seed = seed;
				break;
			}
			case 'string': {
				// map character codes onto an interval between 0.25 and 1
				// then at some point it came to me that original string is worth preserving, so let's do that
				this.seed = seed;
				this.seedInt = this.str2int(seed);
				break;
			}
			default: {
				this.seed = (Math.random() * 3 + 1) / 4;
			}
		}
	}

	/**
	 * stupid randomizer function
	 * @param {number} [peek=0] if set, predicts the number that is n steps ahead instead of advancing to the next one
	 * @returns {number (0, 1)} random number between 0 and 1, non-inclusive
	 */
	random(peek = 0) {
		if (!peek) ++this.pull;
		const limiter = this.limiter;
		// prefer seedInt before seed, allowing seed to stay a string
		const seed = this.seedInt || this.seed;
		// make sure seed matters more by affecting effective pull so the chaos can catch up
		// chaos in this case being the ability of tiny variation in seed to result in huge difference in the outcome
		// remember, the real this.pull is meant to represent the real number of times random() was called
		const pull = Math.floor((this.pull + peek + seed * 4327) % limiter) + 1;
		// get some extra entropy by alternating primes
		const extra = this.primes[pull % (this.primes.length - 1)];

		return pull * seed * extra * this.factor % (limiter - 1) / limiter;
	}

	/*
		Returns a pseudo-random whole number (integer) within the range of the given bounds.
	*/
	randomInt(/* [min], max, peek */) {
		let min = 0;
		let max;
		let peek = 0;

		switch (arguments.length) {
			case 0: throw new Error('randomInt called with insufficient parameters');
			case 1: max = Math.trunc(arguments[0]); break;
			default: min = Math.trunc(arguments[0]); max = Math.trunc(arguments[1]); peek = arguments[2] || 0; break;
		}
		if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(peek)) throw new Error(`randomInt called with invalid parameters, ${JSON.stringify(arguments)}`);

		return Math.floor(this.random(peek) * (max - min + 1)) + min;
	}

	/*
		Returns a pseudo-random real number (floating-point) within the range of the given bounds.

		NOTE: Unlike with its sibling function `random()`, the `max` parameter
		is exclusive, not inclusive—i.e. the range goes to, but does not include,
		the given value.
		actually, i'm not sure it's possible to ever roll min either.
	*/
	randomFloat(/* [min], max, peek */) {
		let min;
		let max;
		let peek = 0;

		switch (arguments.length) {
			case 0: throw new Error('randomFloat called with insufficient parameters');
			case 1: min = 0.0; max = Number(arguments[0]); break;
			default: min = Number(arguments[0]); max = Number(arguments[1]); peek = arguments[2] || 0; break;
		}
		if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isInteger(peek)) throw new Error(`randomFloat called with invalid parameters, ${JSON.stringify(arguments)}`);

		return this.random() * (max - min) + min;
	}

	/*
		Randomly shuffles an array and returns it.
	*/
	shuffle(array, mutate = true) {
		if (!Array.isArray(array)) throw new Error(`shuffle expected an array, got ${typeof array}`);
		if (array.length === 0) return;

		const arr = mutate ? array : clone(array);
		for (let i = arr.length - 1; i > 0; --i) {
			const j = this.randomInt(0, i);

			if (i === j) 	continue;

			// [arr[i], arr[j]] = [arr[j], arr[i]];
			const swap = arr[i];
			arr[i] = arr[j];
			arr[j] = swap;
		}

		return arr;
	}

	toShuffled(array) {
		return this.shuffle(array, false);
	}

	/*
		Returns a random value from its given arguments.
	*/
	either() {
		const arr = Array.prototype.concat.apply([], arguments);
		if (arr.length === 0) return;

		return arr[this.randomInt(arr.length - 1)];
	}

	/**
	 * function to peek into the list of n future random values without altering the pull value
	 * @param {number} depth how many numbers to return
	 * @returns {Array} list of predicted random numbers ahead
	 */
	peek(depth = 1) {
		if (!Number.isInteger(depth)) return console.error(`can't look ahead ${depth} times`);
		if (depth > 9000) return console.error('it\'s over 9000!');
		const result = [];
		for (let i = 1; i <= depth; ++i) result.push(this.random(i));
		return result;
	}

	/**
	 * string to seed converter
	 * @param {string} string to convert
	 * @returns {number [0.25, 1]} float between 0.25 and 1, inclusive
	 */
	str2int(string) {
		let sum = 0;
		let count = 0;
		for (const char of string) {
			const code = char.charCodeAt();
			// i don't want your emojis and non-ascii characters
			if (code < 32 || code > 127) continue;
			sum += code - 32;
			++count;
		}
		// some strings might lack valid characters to count, especially empty strings
		return count ? sum / count / 127 + 0.25 : 0.25;
	}

	/**
	 * test function to check the random distribution
	 * @param {number} count how many times to roll
	 * @param {number} granularity how many baskets to fill
	 * @param {boolean} advancerng increase the actual prng pull value
	 * @returns {Array} how many times each basket was hit
	 */
	test(count = 10, granularity = 10, advancerng) {
		const distribution = new Array(granularity).fill(0);
		for (let i = 1; i <= count; ++i) ++distribution[Math.floor(this.random(i) * granularity)];
		if (advancerng) this.pull += count;
		return distribution;
	}
}
window.PRNG = PRNG;
