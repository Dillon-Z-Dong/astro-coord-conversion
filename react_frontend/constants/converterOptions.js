// constants/converterOptions.js

export const FORMAT_OPTIONS = [
  { value: 'degrees', label: 'Decimal Degrees' },
  { value: 'hmsdms', label: 'HMS/DMS' },
  { value: 'casa', label: 'CASA Format' },
];

export const DELIMITER_OPTIONS = [
  { value: ' ', label: 'Space' },
  { value: ',', label: 'Comma' },
  { value: '\t', label: 'Tab' },
  { value: ' | ', label: 'Pipe' }
];

export const INTERNAL_DELIMITER_OPTIONS = [
  { value: ':', label: 'Colons' },
  { value: 'hms', label: 'Letters' },
  { value: ' ', label: 'Spaces' }
];

export const PRECISION_OPTIONS = [
  { value: "match", label: "Match input precision" },
  ...Array.from({ length: 11 }, (_, i) => ({
    value: String(i),
    label: `${i} digits`
  }))
];

export const PRECISION_MAP = {
  degrees: {
    0: "±0.5 deg",
    1: "±180 arcsec",
    2: "±18 arcsec",
    3: "±1.8 arcsec",
    4: "±180 mas",
    5: "±18 mas",
    6: "±1.8 mas",
    7: "±180 μas",
    8: "±18 μas",
    9: "±1.8 μas",
    10: "±0.18 μas"
  },
  hmsdms: {
    0: "±7.5 arcsec (RA), ±0.5 arcsec (Dec)",
    1: "±0.75 arcsec (RA), ±0.05 arcsec (Dec)",
    2: "±75 mas (RA), ±5 mas (Dec)",
    3: "±7.5 mas (RA), ±0.5 mas (Dec)",
    4: "±0.75 mas (RA), ±0.05 mas (Dec)",
    5: "±75 μas (RA), ±5 μas (Dec)",
    6: "±7.5 μas (RA), ±0.5 μas (Dec)",
    7: "±0.75 μas (RA), ±0.05 μas (Dec)",
    8: "±75 nas (RA), ±5 nas (Dec)",
    9: "±7.5 nas (RA), ±0.5 nas (Dec)",
    10: "±0.75 nas (RA), ±0.05 nas (Dec)"
  }
};