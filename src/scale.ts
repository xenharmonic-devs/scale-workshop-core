import {ExtendedMonzo} from './monzo';
import {Interval, type IntervalOptions, type IntervalType} from './interval';
import {
  Fraction,
  kCombinations,
  mmod,
  PRIMES,
  PRIME_CENTS,
  valueToCents,
} from 'xen-dev-utils';

/** Musical scale consisting of Interval instances repeated at octaves or generic equaves. */
export class Scale {
  intervals: Interval[];
  equave: Interval;
  baseFrequency: number;

  /**
   * Construct a new musical scale.
   * @param intervals Intervals of the scale including 1/1, but not the interval of equivalence.
   * @param equave The interval of equivalence.
   * @param baseFrequency Base frequency of plain 1/1.
   */
  constructor(intervals: Interval[], equave: Interval, baseFrequency: number) {
    this.intervals = intervals;
    this.equave = equave;
    this.baseFrequency = baseFrequency;
  }

  /**
   * Construct a new musical scale from an array of intervals.
   * @param intervals Intervals of the scale including the interval of equivalence, but not 1/1.
   * @param baseFrequency Base frequency of plain 1/1.
   * @returns A new musical scale with the given intervals.
   */
  static fromIntervalArray(intervals: Interval[], baseFrequency = 440) {
    if (intervals.length < 1) {
      throw new Error('At least one interval is required');
    }
    intervals = [...intervals];
    const equave = intervals.pop()!;
    intervals.unshift(equave.zeroed());
    return new Scale(intervals, equave, baseFrequency);
  }

  /**
   * Construct a new musical scale that equally divides an interval in pitch-space.
   * @param divisions Number of notes per equave.
   * @param equave Equave to divide.
   * @param numberOfComponents Number of components in monzo vector parts.
   * @param baseFrequency Base frequency of unison.
   * @returns A new musical scale that equally divides the given equave.
   */
  static fromEqualTemperament(
    divisions: number,
    equave: Fraction,
    numberOfComponents: number,
    baseFrequency = 440
  ) {
    const options: IntervalOptions = {
      preferredEtDenominator: divisions,
      preferredEtEquave: equave,
    };
    const intervals: Interval[] = [];
    for (let i = 0; i < divisions; ++i) {
      intervals.push(
        new Interval(
          ExtendedMonzo.fromEqualTemperament(
            new Fraction(i, divisions),
            equave,
            numberOfComponents
          ),
          'equal temperament',
          undefined,
          options
        )
      );
    }
    const equaveInterval = new Interval(
      ExtendedMonzo.fromFraction(equave, numberOfComponents),
      'equal temperament',
      undefined,
      options
    );
    return new Scale(intervals, equaveInterval, baseFrequency);
  }

  /**
   * Construct a new musical scale by stacking a generating interval against a period.
   * @param generator The generating interval such as a fifth.
   * @param period The period of repetition such as a tritone.
   * @param size Size of the scale. Must be a multiple of the number of periods per equave.
   * @param down Number of steps to stack down. Stacking is distributed among the periods so `down` must be a multiple of the number of periods per equave.
   * @param numPeriods Number of periods per equave. (Equave = `period * numPeriods`, in pitch-space)
   * @param baseFrequency Base frequency of unison.
   * @returns A new musical scale resulting from stacking the generator, reducing by the period and stacking the result to fill the equave.
   */
  static fromRank2(
    generator: Interval,
    period: Interval,
    size: number,
    down: number,
    numPeriods = 1,
    baseFrequency = 440
  ) {
    if (down < 0) {
      throw new Error('Down must be non-negative');
    }
    if (down > size) {
      throw new Error('Down must be less than size');
    }
    if (size % numPeriods) {
      throw new Error('Size must be a multiple of the number of periods');
    }
    if (down % numPeriods) {
      throw new Error('Down must be a multiple of the number of periods');
    }
    size /= numPeriods;
    down /= numPeriods;
    if (generator.type === 'equal temperament') {
      const [genFraction, genEquave] = generator.monzo.toEqualTemperament();
      const options: IntervalOptions = {
        preferredEtDenominator: genFraction.d,
        preferredEtEquave: genEquave,
      };
      generator = generator.mergeOptions(options);
      period = period.mergeOptions(options);
      if (
        period.type === 'ratio' &&
        period.monzo.toFraction().mod(genEquave).equals(0)
      ) {
        period.type = 'equal temperament';
      }
    }
    const intervals: Interval[] = [];
    for (let i = 0; i < size; ++i) {
      intervals.push(generator.mul(i - down).mmod(period));
    }
    const result = new Scale(intervals, period, baseFrequency);
    result.sortInPlace();
    return result.repeat(numPeriods);
  }

  /**
   * Construct a new musical scale from a slice of the harmonic series.
   * @param denominator Denominator of every interval in the scale.
   * @param greatestNumerator The largest numerator of an interval to include in the scale.
   * @param numberOfComponents Number of components in monzo vector parts.
   * @param baseFrequency Base frequency of unison.
   * @returns A new musical scale of the form `denominator / denominator`, `(denominator + 1) / denominator`, ..., `greatestNumerator / denominator`.
   */
  static fromHarmonicSeries(
    denominator: number,
    greatestNumerator: number,
    numberOfComponents: number,
    baseFrequency = 440
  ) {
    if (denominator <= 0) {
      throw new Error('The denominator must be positive');
    }
    if (greatestNumerator <= denominator) {
      throw new Error(
        'The greatest numerator must be larger than the denominator'
      );
    }
    const intervals: Interval[] = [];
    for (
      let numerator = denominator;
      numerator <= greatestNumerator;
      numerator++
    ) {
      intervals.push(
        new Interval(
          ExtendedMonzo.fromFraction(
            new Fraction(numerator, denominator),
            numberOfComponents
          ),
          'ratio',
          undefined,
          {preferredDenominator: denominator}
        )
      );
    }
    const equave = intervals.pop()!;
    return new Scale(intervals, equave, baseFrequency);
  }

  /**
   * Construct a new musical scale from a slice of the subharmonic series.
   * @param numerator Numerator of every interval in the scale.
   * @param leastDenominator The smallest denominator of an interval to include in the scale.
   * @param numberOfComponents Number of components in monzo vector parts.
   * @param baseFrequency Base frequency of unison.
   * @returns A new musical scale of the form `numerator / numerator`, `numerator / (numerator - 1)`, ..., `numerator / leastDenominator`.
   */
  static fromSubharmonicSeries(
    numerator: number,
    leastDenominator: number,
    numberOfComponents: number,
    baseFrequency = 440
  ) {
    if (numerator <= 1) {
      throw new Error('The numerator must be larger than one');
    }
    if (leastDenominator <= 0) {
      throw new Error('The least demoninator must be positive');
    }
    const intervals: Interval[] = [];
    for (
      let denominator = numerator;
      denominator >= leastDenominator;
      denominator--
    ) {
      intervals.push(
        new Interval(
          ExtendedMonzo.fromFraction(
            new Fraction(numerator, denominator),
            numberOfComponents
          ),
          'ratio',
          undefined,
          {preferredNumerator: numerator}
        )
      );
    }
    const equave = intervals.pop()!;
    return new Scale(intervals, equave, baseFrequency);
  }

  /**
   * Construct a musical scale from a chord in (assumed) root position.
   * @param chord Array of intervals in the chord not neccessarily starting from 1/1.
   * @param baseFrequency Base frequency of unison/root note of the chord.
   * @returns New musical scale transposed to start from 1/1.
   */
  static fromChord(chord: Interval[], baseFrequency = 440) {
    if (chord.length < 2) {
      throw new Error('Need at least two tones to enumerate a chord');
    }
    const root = chord[0];
    const intervals = chord.map(tone => tone.sub(root));
    const equave = intervals.pop()!;
    return new Scale(intervals, equave, baseFrequency);
  }

  /**
   * Construct a musical scale from a combination product set.
   * @param factors Factors in the original set.
   * @param numElements Number of elements to multiply together in frequency-space in each combination.
   * @param addUnity Add 1/1 into the scale along with the combinations. If `false` the scale will be transposed to include a combination at unison.
   * @param equave Interval of equivalence.
   * @param baseFrequency Base frequency of unison or the least product before reduction by the equave.
   * @returns A new combination product set reduced to fit inside the equave and sorted by size.
   */
  static fromCombinations(
    factors: Interval[] | Set<Interval>,
    numElements: number,
    addUnity: boolean,
    equave: Interval,
    baseFrequency = 440
  ) {
    if (factors instanceof Set) {
      factors = [...factors.values()];
    }
    if (numElements > factors.length) {
      throw new Error(
        'Number of elements in a combination must be less than or equal to the number of factors'
      );
    }
    const unity = equave.zeroed();
    let intervals: Interval[] = [];
    kCombinations(factors, numElements).forEach(combination => {
      intervals.push(
        combination.reduce((a: Interval, b: Interval) => a.add(b), unity)
      );
    });
    if (addUnity) {
      intervals.push(unity);
    } else {
      intervals.sort((a, b) => a.compare(b));
      const root = intervals[0];
      intervals = intervals.map(interval => interval.sub(root));
    }
    intervals = intervals.map(interval => interval.mmod(equave));
    intervals.sort((a, b) => a.compare(b));
    return new Scale(intervals, equave, baseFrequency);
  }

  /**
   * Construct a new musical scale from finite slice of a multi-dimensional interval lattice.
   * @param basis Basis intervals of the lattice.
   * @param dimensions Dimensions of the slice. Each integer determines how many times to stack a basis vector.
   * @param equave Interval of equivalence.
   * @param baseFrequency Base frequency of unison.
   * @returns A new musical scale of the lattice slice reduced by the equave and sorted by sice.
   */
  static fromLattice(
    basis: Interval[],
    dimensions: number[],
    equave: Interval,
    baseFrequency = 440
  ) {
    let intervals: Interval[] = [];
    function span(accumulator: Interval, index: number) {
      if (index >= dimensions.length || index >= basis.length) {
        intervals.push(accumulator);
        return;
      }
      for (let i = 0; i < dimensions[index]; ++i) {
        span(accumulator.add(basis[index].mul(i)), index + 1);
      }
    }
    span(equave.mul(0), 0);
    intervals = intervals.map(interval => interval.mmod(equave));
    intervals.sort((a, b) => a.compare(b));
    return new Scale(intervals, equave, baseFrequency);
  }

  static fromCube(basis: Interval[], equave: Interval, baseFrequency = 440) {
    return this.fromLattice(
      basis,
      Array(basis.length).fill(2),
      equave,
      baseFrequency
    );
  }

  /**
   * Construct a new musical scale from an array of intervals and their inverses.
   * @param basis Basis intervals of the cross polytope.
   * @param addUnity Include the center of the polytope.
   * @param equave Interval of equivalence.
   * @param baseFrequency Base frequency of 1/1 or the least of interval of the polytope before reduction by the equave.
   * @returns A new musical in the form of a generalized octahedron in monzo space.
   */
  static fromCrossPolytope(
    basis: Interval[] | Set<Interval>,
    addUnity: boolean,
    equave: Interval,
    baseFrequency = 440
  ) {
    if (basis instanceof Set) {
      basis = [...basis.values()];
    }
    let intervals: Interval[] = [];
    basis.forEach(basisInterval => {
      intervals.push(basisInterval);
      intervals.push(basisInterval.neg());
    });
    if (addUnity) {
      intervals.push(equave.mul(0));
    } else {
      intervals.sort((a, b) => a.compare(b));
      const root = intervals[0];
      intervals = intervals.map(interval => interval.sub(root));
    }
    intervals = intervals.map(interval => interval.mmod(equave));
    intervals.sort((a, b) => a.compare(b));
    return new Scale(intervals, equave, baseFrequency);
  }

  /**
   * Construct a new musical scale in the shape of a 4D octaplex/24-cell.
   * @param basis The four basis intervals of the octaplex.
   * @param addUnity Include the center of the octaplex.
   * @param equave Interval of equivalence.
   * @param baseFrequency Base frequency of 1/1 or the least of interval of the octaplex before reduction by the equave.
   * @returns A new musical scale in the form of an octaplex in monzo space.
   */
  static fromOctaplex(
    basis: Interval[] | Set<Interval>,
    addUnity: boolean,
    equave: Interval,
    baseFrequency = 440
  ) {
    let basis_: Interval[]; // Deals with typescript weirdness.
    if (basis instanceof Set) {
      basis_ = [...basis.values()];
    } else {
      basis_ = basis;
    }
    if (basis_.length !== 4) {
      throw new Error('Octaplex can only be generated using 4 basis vectors');
    }
    let intervals: Interval[] = [];
    [-1, 1].forEach(sign1 => {
      [-1, 1].forEach(sign2 => {
        intervals.push(basis_[0].mul(sign1).add(basis_[1].mul(sign2)));
        intervals.push(basis_[0].mul(sign1).add(basis_[2].mul(sign2)));
        intervals.push(basis_[0].mul(sign1).add(basis_[3].mul(sign2)));
        intervals.push(basis_[1].mul(sign1).add(basis_[3].mul(sign2)));
        intervals.push(basis_[2].mul(sign1).add(basis_[3].mul(sign2)));
        intervals.push(basis_[1].mul(sign1).add(basis_[2].mul(sign2)));
      });
    });
    if (addUnity) {
      intervals.push(equave.mul(0));
    } else {
      intervals.sort((a, b) => a.compare(b));
      const root = intervals[0];
      intervals = intervals.map(interval => interval.sub(root));
    }
    intervals = intervals.map(interval => interval.mmod(equave));
    intervals.sort((a, b) => a.compare(b));
    return new Scale(intervals, equave, baseFrequency);
  }

  // All Euler-Fokker genera can be generated using Scale.fromLattice,
  // but a single-parameter generator is conceptually simpler.
  /**
   * Construct a new Euler-Fokker genus.
   * @param guideTone Positive integer whose positive factors make up the scale.
   * @param equave Interval of equivalence. Anything other than `2` results in a generalized genus.
   * @param numberOfComponents Number of components in monzo vector parts.
   * @param baseFrequency Base frequency of 1/1.
   * @returns A new Euler-Fokker scale.
   */
  static fromEulerGenus(
    guideTone: number,
    equave: number,
    numberOfComponents: number,
    baseFrequency = 440
  ) {
    const factors: number[] = [];
    for (let remainder = 1; remainder < equave; ++remainder) {
      for (let n = remainder; n <= guideTone; n += equave) {
        if (guideTone % n === 0) {
          factors.push(n);
        }
      }
    }
    const equaveMonzo = ExtendedMonzo.fromFraction(equave, numberOfComponents);
    const intervals = factors.map(factor =>
      ExtendedMonzo.fromFraction(factor, numberOfComponents).mmod(equaveMonzo)
    );
    intervals.sort((a, b) => a.compare(b));
    return new Scale(
      intervals.map(interval => new Interval(interval, 'ratio')),
      new Interval(equaveMonzo, 'ratio'),
      baseFrequency
    );
  }

  /**
   * Construct a new Dwarf scale.
   * @param val Patent val.
   * @param equave Interval of equivalence. Anything other than `2` results in a generalized scale.
   * @param numberOfComponents Number of components in monzo vector parts.
   * @param baseFrequency Base frequency of 1/1.
   * @returns A new Dwarf scale.
   */
  static fromDwarf(
    val: number,
    equave: number,
    numberOfComponents: number,
    baseFrequency = 440
  ) {
    const valPerEquaveCents = val / valueToCents(equave);
    const degrees = new Set();
    const members: number[] = [];
    let n = 1;
    while (members.length < val) {
      let degree = 0;
      let m = n;
      let i = 0;
      while (m > 1) {
        let component = 0;
        while (m % PRIMES[i] === 0) {
          m /= PRIMES[i];
          component++;
        }
        if (component !== 0) {
          degree += component * Math.round(PRIME_CENTS[i] * valPerEquaveCents);
        }
        i++;
      }
      degree = degree % val;
      if (!degrees.has(degree)) {
        degrees.add(degree);
        members.push(n);
      }
      n++;
    }
    const equaveMonzo = ExtendedMonzo.fromFraction(equave, numberOfComponents);
    const intervals = members.map(member =>
      ExtendedMonzo.fromFraction(member, numberOfComponents).mmod(equaveMonzo)
    );
    intervals.sort((a, b) => a.compare(b));
    return new Scale(
      intervals.map(interval => new Interval(interval, 'ratio')),
      new Interval(equaveMonzo, 'ratio'),
      baseFrequency
    );
  }

  /**
   * Construct a new musical scale from a subset of an equal temperament.
   * @param steps Intervals to include in the scale. The last step determines the EDO / ED of EDJI.
   * @param equave Interval to equally divide.
   * @param baseFrequency Base frequency of unison.
   * @returns A new musical scale consisting of `s1\N<equave>`, `s2\N<equave>`, ..., `N\N<equave>`.
   */
  static fromEqualTemperamentSubset(
    steps: number[],
    equave: Interval,
    baseFrequency = 440
  ) {
    const equaveSteps = steps[steps.length - 1];
    equave = equave.mergeOptions({preferredEtDenominator: equaveSteps});
    if (equave.monzo.isFractional()) {
      equave.options.preferredEtEquave = equave.monzo.toFraction();
      equave.type = 'equal temperament';
    }

    return Scale.fromIntervalArray(
      steps.map(step => equave.mul(new Fraction(step, equaveSteps))),
      baseFrequency
    );
  }

  /** Number of intervals in the scale. */
  get size() {
    return this.intervals.length;
  }

  /** Number of components in the monzo vector part of the scale's intervals. */
  get numberOfComponents() {
    return this.equave.monzo.numberOfComponents;
  }

  /**
   * Obtain an {@link Interval} of the scale (repeats at equaves).
   * @param index Zero-based index of the interval.
   * @returns An interval of the scale with equaves added as necessary.
   */
  getInterval(index: number) {
    const numEquaves = Math.floor(index / this.size);
    index -= numEquaves * this.size;
    return this.intervals[index].add(this.equave.mul(numEquaves));
  }

  /**
   * Obtain the ExtendedMonzo of an interval in the scale (repeats at equaves).
   * @param index Zero-based index of the interval.
   * @returns An {@link ExtendedMonzo} of the scale with equaves added as necessary.
   */
  getMonzo(index: number) {
    const numEquaves = Math.floor(index / this.size);
    index -= numEquaves * this.size;
    return this.intervals[index].monzo.add(this.equave.monzo.mul(numEquaves));
  }

  /**
   * Obtain the frequency of an interval in the scale (repeats at equaves).
   * @param index Zero-based index of the interval.
   * @returns The frequency of an interval in the scale with equaves factored in as necessary.
   */
  getFrequency(index: number) {
    return this.baseFrequency * this.getMonzo(index).valueOf();
  }

  /**
   * Obtain a range of frequencies in the scale.
   * More efficient to compute than getting individual frequencies.
   * @param start The smallest index to include.
   * @param end The end point `end` itself not included.
   * @returns An array of frequencies corresponding to the specified range.
   */
  getFrequencyRange(start: number, end: number) {
    const values = this.intervals.map(interval => interval.monzo.valueOf());
    const equaveValue = this.equave.monzo.valueOf();
    const numEquaves = Math.floor(start / this.size);
    let referenceFrequency = this.baseFrequency * equaveValue ** numEquaves;
    let index = start - numEquaves * this.size;
    const result = [];
    for (let i = start; i < end; ++i) {
      result.push(referenceFrequency * values[index]);
      index++;
      if (index >= this.size) {
        index -= this.size;
        referenceFrequency *= equaveValue;
      }
    }
    return result;
  }

  /**
   * Obtain the name of an interval in the scale.
   * @param index Zero-based index of the interval.
   * @returns Name of an on interval in the scale without equaves factored in. The unison is named after the equave.
   */
  getName(index: number) {
    index = mmod(index, this.size);
    if (index === 0) {
      return this.equave.name;
    }
    return this.intervals[index].name;
  }

  /**
   * Sort the scale in-place.
   * @returns The scale with intervals sorted from smallest to largest without touching the equave.
   */
  sortInPlace() {
    this.intervals.sort((a, b) => a.compare(b));
    return this;
  }

  /**
   * Construct a variant of the scale with new intervals, but the same equave and base frequency.
   * @param intervals New intervals for the scale.
   * @returns A new scale with new intervals.
   */
  variant(intervals: Interval[]) {
    return new Scale(intervals, this.equave.clone(), this.baseFrequency);
  }

  /**
   * Construct a sorted copy of the scale. scale in-place.
   * @param deep Create new copies of the intervals instead just a new array with the old instances.
   * @returns The scale with intervals sorted from smallest to largest without touching the equave.
   */
  sorted(deep = false) {
    let intervals: Interval[];
    if (deep) {
      intervals = this.intervals.map(interval => interval.clone());
    } else {
      intervals = [...this.intervals];
    }
    intervals.sort((a, b) => a.compare(b));
    return this.variant(intervals);
  }

  /**
   * Reduce intervals in the scale by the equave.
   * @returns A variant of the scale where all intervals fit inside the equave.
   */
  reduce() {
    const intervals = this.intervals.map(interval =>
      interval.mmod(this.equave)
    );
    return this.variant(intervals);
  }

  /**
   * Repeat the scale at the equave and replace the old equave. Produces the same frequencies as the old scale.
   * @param numRepeats Number of repeats.
   * @param deep Create new copies of the Interval instances.
   * @returns A new scale repeated `numRepeats` times.
   */
  repeat(numRepeats = 2, deep = false) {
    if (numRepeats === 0) {
      return new Scale(
        [this.intervals[0]],
        this.equave.zeroed(),
        this.baseFrequency
      );
    }
    let intervals: Interval[];
    if (deep) {
      intervals = this.intervals.map(interval => interval.clone());
    } else {
      intervals = [...this.intervals];
    }
    for (let i = 1; i < numRepeats; ++i) {
      this.intervals.forEach(interval => {
        intervals.push(interval.add(this.equave.mul(i)));
      });
    }
    return new Scale(
      intervals,
      this.equave.mul(numRepeats),
      this.baseFrequency
    );
  }

  /**
   * Rotate the scale to a new mode.
   * @param numSteps Number of steps to rotate by.
   * @returns Another mode of the scale.
   */
  rotate(numSteps = 1) {
    numSteps = mmod(numSteps, this.size);
    const root = this.intervals[numSteps];
    const intervals: Interval[] = [];
    for (let i = numSteps; i < this.size + numSteps; ++i) {
      if (i >= this.size) {
        intervals.push(
          this.intervals[i - this.size].sub(root).add(this.equave)
        );
      } else {
        intervals.push(this.intervals[i].sub(root));
      }
    }
    return this.variant(intervals);
  }

  /**
   * Obtain a subset of the scale.
   * @param indices Indices of the intervals to include.
   * @param deep Create new copies of the Interval instances.
   * @returns A new scale with only the specified subset included.
   */
  subset(indices: number[], deep = false) {
    if (!indices.includes(0)) {
      throw new Error('Subset must include unison');
    }
    let intervals: (Interval | undefined)[] = indices.map(
      i => this.intervals[i]
    );
    if (intervals.includes(undefined)) {
      throw new Error('Subset index out of bounds');
    }
    if (deep) {
      intervals = intervals.map(interval => interval!.clone());
    }
    return this.variant(intervals as Interval[]);
  }

  /**
   * Obtain a subset of the scale up to the given index.
   * @param end Last index to include.
   * @returns A new scale with only the specified subset included.
   */
  head(end: number) {
    return this.variant(this.intervals.slice(0, end));
  }

  /**
   * Stretch the scale using the given scaling factor.
   * @param scalar The scaling factor in pitch-space.
   * @returns A new streched scale.
   */
  stretch(scalar: number) {
    const intervals = this.intervals.map(interval => interval.stretch(scalar));
    return new Scale(
      intervals,
      this.equave.stretch(scalar),
      this.baseFrequency
    );
  }

  /**
   * Invert the intervals in the scale.
   * @returns A new inverted scale.
   */
  invert() {
    const intervals = [this.intervals[0].clone()];
    for (let i = this.intervals.length - 1; i >= 1; --i) {
      intervals.push(this.equave.sub(this.intervals[i]));
    }
    return this.variant(intervals);
  }

  /**
   * Add random variation to the intervals in the scale.
   * @param maxCents Maximum deviation in cents.
   * @param varyEquave Apply variation the the interval of equivalence.
   * @returns A new scale with variance added.
   */
  vary(maxCents: number, varyEquave = false) {
    const intervals = this.intervals.map(interval => interval.vary(maxCents));
    const result = this.variant(intervals);
    if (varyEquave) {
      result.equave = this.equave.vary(maxCents);
    }
    return result;
  }

  // Moves unison as well. Useful with merge, but not by itself.
  /**
   * Transpose the scale.
   * WARNING: Moves the unison as well and doesn't reduce by the equave.
   * @param offset Interval to transpose by.
   * @returns A new transposed scale.
   */
  transpose(offset: Interval) {
    const intervals = this.intervals.map(interval => interval.add(offset));
    return this.variant(intervals);
  }

  /**
   * Create a new scale with a degree of the scale replaced by another.
   * @param degree Index of the interval to replace.
   * @param replacement The interval to replace with.
   * @param deep Create new copies of the Interval instances.
   * @returns A new scale with the given interval spliced in.
   */
  replaceDegree(degree: number, replacement: Interval, deep = false) {
    if (degree === this.intervals.length) {
      return new Scale(this.intervals, replacement, this.baseFrequency);
    }
    let intervals: Interval[];
    if (deep) {
      intervals = this.intervals.map(interval => interval.clone());
    } else {
      intervals = [...this.intervals];
    }
    intervals[degree] = replacement;
    return this.variant(intervals);
  }

  /**
   * Create a new scale by concatenating this one with another.
   * Duplicates unison and other scale degrees if present.
   * @param other Another scale with the same equave and base frequency.
   * @param deep Create new copies of the Interval instances.
   * @returns A new scale that includes all the intervals from both scales.
   */
  concat(other: Scale, deep = false) {
    if (this.baseFrequency !== other.baseFrequency) {
      throw new Error('Base frequencies must match when concatenating');
    }
    if (!this.equave.strictEquals(other.equave)) {
      throw new Error('Equaves must match when concatenating');
    }
    let intervals: Interval[];
    if (deep) {
      intervals = this.intervals
        .map(interval => interval.clone())
        .concat(other.intervals.map(interval => interval.clone()));
    } else {
      intervals = this.intervals.concat(other.intervals);
    }
    return this.variant(intervals);
  }

  /**
   * Remove duplicate intervals in-place.
   * @returns This scale.
   */
  removeDuplicatesInPlace() {
    let i = 1;
    while (i < this.intervals.length) {
      for (let j = 0; j < i; ++j) {
        if (this.intervals[i].strictEquals(this.intervals[j])) {
          this.intervals.splice(i, 1);
          i--;
          break;
        }
      }
      i++;
    }
    return this;
  }

  /**
   * Merge this scale with another, removing duplicates and sorting the result.
   * @param other Another scale.
   * @returns A new scale with intervals from both without duplicates.
   */
  merge(other: Scale) {
    return this.concat(other).reduce().removeDuplicatesInPlace().sortInPlace();
  }

  /**
   * Create a new scale where a single degree has been transposed.
   * @param degree Degree to transpose.
   * @param offset Amount to transpose by.
   * @param deep Create new copies of the Interval instances.
   * @returns A new scale with a transposed degree.
   */
  transposeDegree(degree: number, offset: Interval, deep = false) {
    degree = mmod(degree, this.size);
    let intervals: Interval[];
    if (deep) {
      intervals = this.intervals.map(interval => interval.clone());
    } else {
      intervals = [...this.intervals];
    }
    intervals[degree] = intervals[degree].add(offset);
    return this.variant(intervals);
  }

  /**
   * Create a new scale with a new interval inserted.
   * @param degree Degree to insert after.
   * @param interval Interval to insert.
   * @param deep Create new copies of the Interval instances.
   * @returns A new scale with the new interval inserted.
   */
  insertAfter(degree: number, interval: Interval, deep = false) {
    degree = mmod(degree, this.size);
    let intervals: Interval[];
    if (deep) {
      intervals = this.intervals.map(interval => interval.clone());
      intervals.splice(degree + 1, 0, interval.clone());
    } else {
      intervals = [...this.intervals];
      intervals.splice(degree + 1, 0, interval);
    }
    return this.variant(intervals);
  }

  /**
   * Create a new scale where every interval is replace with the closest approximation in the given EDO/EDJI.
   * @param divisions Number of divisions per equave.
   * @returns A new scale of approximations in equal temperament.
   */
  approximateEqualTemperament(divisions: number) {
    const options: IntervalOptions = {preferredEtDenominator: divisions};
    if (this.equave.monzo.isFractional()) {
      options.preferredEtEquave = this.equave.monzo.toFraction();
    }
    const equave = this.equave.mergeOptions(options);
    if (equave.type === 'ratio') {
      equave.type = 'equal temperament';
    }
    const step = equave.div(divisions).mergeOptions(options);
    const stepCents = step.totalCents();
    const intervals = this.intervals.map(interval => {
      const numSteps = Math.round(interval.totalCents() / stepCents);
      return step.mul(numSteps);
    });
    return new Scale(intervals, equave, this.baseFrequency);
  }

  /**
   * Create a new scale where every interval is replace with the closest approximation in a harmonic series.
   * @param denominator Denominator/root of the harmonic series slice.
   * @returns A new scale of harmonic approximations.
   */
  approximateHarmonics(denominator: number) {
    const equave = this.equave.approximateHarmonic(denominator);
    const intervals = this.intervals.map(interval =>
      interval.approximateHarmonic(denominator)
    );
    return new Scale(intervals, equave, this.baseFrequency);
  }

  /**
   * Create a new scale where every interval is replace with the closest approximation in a subharmonic series.
   * @param numerator Numerator/root of the subharmonic series slice.
   * @returns A new scale of subharmonic approximations.
   */
  approximateSubharmonics(numerator: number) {
    const equave = this.equave.approximateSubharmonic(numerator);
    const intervals = this.intervals.map(interval =>
      interval.approximateSubharmonic(numerator)
    );
    return new Scale(intervals, equave, this.baseFrequency);
  }

  /**
   * Merge existing formatting options with new ones.
   * @param options New options. Takes priority over existing keys.
   * @returns A new scale of intervals with the new formatting options.
   */
  mergeOptions(options: IntervalOptions) {
    const intervals = this.intervals.map(interval =>
      interval.mergeOptions(options)
    );
    const equave = this.equave.mergeOptions(options);
    return new Scale(intervals, equave, this.baseFrequency);
  }

  /**
   * Convert the intervals in the scale to another type.
   * @param type The new formatting type.
   * @param options New formatting options.
   * @returns A new scale of intervals with the new formatting type and options.
   */
  asType(type: IntervalType, options?: IntervalOptions) {
    const intervals = this.intervals.map(interval =>
      interval.asType(type, options)
    );
    const equave = this.equave.asType(type, options);
    return new Scale(intervals, equave, this.baseFrequency);
  }

  /**
   * Convert scale intervals to strings.
   * Also known as reverse parsing.
   * @returns An array of textual scale lines.
   */
  toStrings(): string[] {
    const result = this.intervals.slice(1).map(interval => interval.toString());
    result.push(this.equave.toString());
    return result;
  }
}
