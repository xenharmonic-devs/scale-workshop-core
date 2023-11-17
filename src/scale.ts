import {mmod} from 'xen-dev-utils';

/** Musical scale designed to calculate frequencies repeated at octaves or generic equaves. */
export class Scale {
  intervalRatios: number[];
  equaveRatio: number;
  baseFrequency: number;
  baseMidiNote: number;

  /**
   * Construct a new musical scale.
   * @param intervalCents Intervals of the scale including 1/1, but not the interval of equivalence.
   * @param equaveCents The interval of equivalence.
   * @param baseFrequency Base frequency of 1/1.
   */
  constructor(
    intervalRatios: number[],
    equaveRatio: number,
    baseFrequency: number,
    baseMidiNote: number
  ) {
    this.intervalRatios = intervalRatios;
    this.equaveRatio = equaveRatio;
    this.baseFrequency = baseFrequency;
    this.baseMidiNote = baseMidiNote;
  }

  /** Number of intervals in the scale. */
  get size() {
    return this.intervalRatios.length;
  }

  /**
   * Obtain the ratio agains the base MIDI note.
   * @param index MIDI index of a note.
   * @returns Ratio associated with the MIDI index.
   */
  getRatio(index: number) {
    index -= this.baseMidiNote;
    const baseIndex = mmod(index, this.size);
    const numEquaves = (index - baseIndex) / this.size;
    return this.intervalRatios[baseIndex] * this.equaveRatio ** numEquaves;
  }

  /**
   * Obtain the frequency of an interval in the scale (repeats at equaves).
   * @param index MIDI index of a note.
   * @returns The frequency of an interval in the scale with equaves factored in as necessary.
   */
  getFrequency(index: number) {
    return this.baseFrequency * this.getRatio(index);
  }

  /**
   * Obtain a range of frequencies in the scale.
   * More efficient to compute than getting individual frequencies.
   * @param start The MIDI index of the lowest note to include.
   * @param end The MIDI index of the end point `end` itself not included.
   * @returns An array of frequencies corresponding to the specified range.
   */
  getFrequencyRange(start: number, end: number) {
    start -= this.baseMidiNote;
    end -= this.baseMidiNote;
    const numEquaves = Math.floor(start / this.size);
    let referenceFrequency =
      this.baseFrequency * this.equaveRatio ** numEquaves;
    let index = start - numEquaves * this.size;
    const result = [];
    for (let i = start; i < end; ++i) {
      result.push(referenceFrequency * this.intervalRatios[index]);
      index++;
      if (index >= this.size) {
        index -= this.size;
        referenceFrequency *= this.equaveRatio;
      }
    }
    return result;
  }
}
