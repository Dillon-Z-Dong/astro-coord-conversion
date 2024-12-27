// coordinateParser.test.js

import { raDecConverter } from './coordinateParser.js';

/**
 * Helper for approximate floating comparison.
 */
function isClose(a, b, relTol = 1e-7) {
  return Math.abs(a - b) <= relTol * Math.abs(b);
}

describe("Coordinate Parser Tests", () => {

  function raDecDegrees(input, inputFormat='hmsdms') {
    // Helper to convert to degrees and split into floats
    const out = raDecConverter(input, {
      inputFormat,
      outputFormat: 'degrees',
      raDecDelimiter: ', '
    });
    const [ra, dec] = out.split(', ').map(parseFloat);
    return { ra, dec };
  }

  test("CASA format input vs. standard hmsdms", () => {
    const casaCoord = "09:54:56.823626 +17:43:31.22243";
    const standard  = "09:54:56.823626 +17:43:31.22243";
    const out1 = raDecConverter(casaCoord, { inputFormat: 'hmsdms', outputFormat: 'degrees' });
    const out2 = raDecConverter(standard,  { inputFormat: 'hmsdms', outputFormat: 'degrees' });
    expect(out1).toEqual(out2);
  });

  test("CASA dotted Dec with input_format='degrees' should fail", () => {
    const dottedCasa = "09:54:56.823626 +17.43.31.22243";
    expect(() => {
      raDecConverter(dottedCasa, { inputFormat: 'degrees', outputFormat: 'degrees' });
    }).toThrow();
  });

  test("CASA output format test (with specified precision)", () => {
    const degreesInput = "148.73675 +17.72534";
    const result = raDecConverter(degreesInput, {
      inputFormat: 'degrees',
      outputFormat: 'casa',
      raPrecision: 2,
      decPrecision: 3
    });
    // e.g. might look like "09:54:56.82 +17.43.31.404"
    // We'll just do a basic check:
    expect(result).toMatch(/\+/);  // contains a plus sign
    expect(result).toMatch(/:/);   // RA with colons
    expect(result).toMatch(/\./);  // some decimals
  });

  test("hmsdms vs degrees input produce consistent results", () => {
    const hms = "23:24:59.00 +61:11:14.79";
    const deg = "351:14:45.00 +61:11:14.79";

    const { ra: ra1, dec: dec1 } = raDecDegrees(hms, 'hmsdms');
    const { ra: ra2, dec: dec2 } = raDecDegrees(deg, 'degrees');

    expect(isClose(ra1, ra2, 1e-6)).toBe(true);
    expect(isClose(dec1, dec2, 1e-6)).toBe(true);
  });

  test("Delimiter options - zero-padding check", () => {
    // e.g. input => "18:04:20.99 -29:31:08.9"
    const coord = "18:04:20.99 -29:31:08.9";
    // We'll just verify one scenario:
    const out = raDecConverter(coord, {
      inputFormat: 'hmsdms',
      outputFormat: 'hmsdms',
      raPrecision: 2,
      decPrecision: 2,
      raDecDelimiter: ", ",
      internalDelimiter: ":"
    });
    // e.g. "18:04:20.99, -29:31:08.90"
    expect(out).toBe("18:04:20.99, -29:31:08.90");
  });

  test("Missing components (e.g. '12 +45')", () => {
    const inp = "12 +45";
    const out = raDecConverter(inp, {
      inputFormat: 'hmsdms',
      outputFormat: 'hmsdms',
      raPrecision: 2,
      decPrecision: 2
    });
    // Expect => "12:00:00.00\t+45:00:00.00"
    expect(out).toBe("12:00:00.00\t+45:00:00.00");
  });

  test("Precision propagation checks", () => {
    // 1) If not specified, we pick precision from the input
    {
      const inp = "12:34:56.7890 +45:23:45.6789";
      const out = raDecConverter(inp, {
        inputFormat: 'hmsdms',
        outputFormat: 'degrees'
      });
      const [raStr, decStr] = out.split('\t');
      // Just check we produce at least some decimals. 
      // The exact # can vary (the code tries to match input).
      expect(raStr).toMatch(/\./);
      expect(decStr).toMatch(/\./);
    }

    // 2) If user specifies raPrecision=4, decPrecision=5 => must match exactly
    {
      const inp = "12:34:56.7890 +45:23:45.6789";
      const out = raDecConverter(inp, {
        inputFormat: 'hmsdms',
        outputFormat: 'degrees',
        raPrecision: 4,
        decPrecision: 5
      });
      const [raStr, decStr] = out.split('\t');
      const raDecCount = raStr.split('.')[1].length;
      const decDecCount = decStr.split('.')[1].length;
      expect(raDecCount).toBe(4);
      expect(decDecCount).toBe(5);
    }
  });

  test("Round-trip conversion: hmsdms -> degrees -> hmsdms", () => {
    const original = "12:34:56.789012345 +45:23:45.678901234";
    // 1) hmsdms -> degrees (7 decimals)
    const decimal = raDecConverter(original, {
      inputFormat: 'hmsdms',
      outputFormat: 'degrees',
      raPrecision: 7,
      decPrecision: 7
    });
    // 2) degrees -> hmsdms (5 decimals)
    const roundtrip = raDecConverter(decimal, {
      inputFormat: 'degrees',
      outputFormat: 'hmsdms',
      raPrecision: 5,
      decPrecision: 5
    });
    const [raStr, decStr] = roundtrip.split('\t');
    // Check that last portion (seconds) has 5 decimals
    const raSecs = raStr.split(':').pop();
    const decSecs = decStr.split(':').pop();

    expect(raSecs).toMatch(/\.\d{5}$/);  // e.g. "56.78901"
    expect(decSecs).toMatch(/\.\d{5}$/); // e.g. "45.67890"
  });

  test("Whitespace variations (tabs, newlines) yield same result", () => {
    const base = "12:34:56 +45:23:45";
    const expected = raDecConverter(base, {
      inputFormat: 'hmsdms',
      outputFormat: 'hmsdms',
      raPrecision: 2,
      decPrecision: 2
    });
    const variants = [
      "12:34:56    +45:23:45",
      "12:34:56\t+45:23:45",
      "12:34:56\n+45:23:45",
      "12:34:56  \t  +45:23:45",
      "12:34:56\r\n+45:23:45",
    ];
    for (const variant of variants) {
      const out = raDecConverter(variant, {
        inputFormat: 'hmsdms',
        outputFormat: 'hmsdms',
        raPrecision: 2,
        decPrecision: 2
      });
      expect(out).toBe(expected);
    }
  });

  test("Epoch markers (J2000, j2000.0) are removed", () => {
    const base = "12:34:56 +45:23:45";
    const expected = raDecConverter(base, {
      inputFormat: 'hmsdms',
      outputFormat: 'degrees',
      raDecDelimiter: ', '
    });
    const markers = ["J2000", "j2000", "J2000.0", "j2000.0", "J 2000", "j 2000.0"];
    for (const mk of markers) {
      const c = `${mk} ${base}`;
      const out = raDecConverter(c, {
        inputFormat: 'hmsdms',
        outputFormat: 'degrees',
        raDecDelimiter: ', '
      });
      expect(out).toBe(expected);
    }
  });

  test("Leading zeros in input should be normalized", () => {
    const pairs = [
      ["12:34:56 +45:23:45", "12:34:56 +45:23:45"],
      ["02:34:56 +05:23:45", "02:34:56 +05:23:45"],
      ["2:34:56 +5:23:45",   "02:34:56 +05:23:45"],
    ];
    for (const [raw, canonical] of pairs) {
      const outRaw = raDecConverter(raw, {
        inputFormat: 'hmsdms',
        outputFormat: 'hmsdms',
        raPrecision: 2,
        decPrecision: 2
      });
      const outCanon = raDecConverter(canonical, {
        inputFormat: 'hmsdms',
        outputFormat: 'hmsdms',
        raPrecision: 2,
        decPrecision: 2
      });
      expect(outRaw).toBe(outCanon);
    }
  });

  test("Boundary values for RA/Dec", () => {
    const coords = [
      ["00:00:00.000 +00:00:00.000", true],
      ["23:59:59.999 +89:59:59.999", true],
      ["24:00:00.000 +00:00:00.000", false],
      ["00:00:00.000 +90:00:00.000", true],
      ["00:00:00.000 +90:00:00.001", false],
      ["00:60:00.000 +00:00:00.000", false],
      ["00:00:60.000 +00:00:00.000", false],
    ];
    for (const [coord, shouldPass] of coords) {
      if (shouldPass) {
        expect(() => {
          raDecConverter(coord, {
            inputFormat: 'hmsdms',
            outputFormat: 'hmsdms'
          });
        }).not.toThrow();
      } else {
        expect(() => {
          raDecConverter(coord, {
            inputFormat: 'hmsdms',
            outputFormat: 'hmsdms'
          });
        }).toThrow();
      }
    }
  });
});
