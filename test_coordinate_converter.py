import unittest
from math import isclose
from coordinate_parser import ra_dec_converter

class TestCoordinateParser(unittest.TestCase):
    """Test suite for coordinate parsing with explicit format specification"""
    
    def assertCoordsEqual(self, coord1, coord2, input_format='hmsdms', rel_tol=1e-7):
        """Helper to compare coordinate strings after conversion to decimal"""
        # Convert both to decimal degrees
        val1 = ra_dec_converter(coord1, input_format=input_format, output_format='degrees')
        val2 = ra_dec_converter(coord2, input_format=input_format, output_format='degrees')
        
        # Split into RA and Dec
        ra1, dec1 = map(float, val1.split(', '))
        ra2, dec2 = map(float, val2.split(', '))
        
        # Compare with relative tolerance
        self.assertTrue(
            isclose(ra1, ra2, rel_tol=rel_tol) and isclose(dec1, dec2, rel_tol=rel_tol),
            f"Coordinates not equal within tolerance:\n{coord1} -> ({ra1}, {dec1})\n{coord2} -> ({ra2}, {dec2})"
        )

    def test_casa_format(self):
        """Test CASA format handling"""
        # Test CASA format equivalence
        casa_coord = "09:54:56.823626 +17.43.31.22243"
        standard_coord = "09:54:56.823626 +17:43:31.22243"
        
        self.assertCoordsEqual(casa_coord, standard_coord, input_format='hmsdms')
        
        # Test CASA format with negative declination
        casa_neg = "09:54:56.823626 -17.43.31.22243"
        standard_neg = "09:54:56.823626 -17:43:31.22243"
        
        self.assertCoordsEqual(casa_neg, standard_neg, input_format='hmsdms')
        
        # Test that CASA format is rejected with degrees input_format
        with self.assertRaises(ValueError):
            ra_dec_converter(casa_coord, input_format='degrees')

    def test_format_equivalence(self):
        """Test that different format representations of the same coordinates are equivalent"""
        # Test cases with HMS format (input_format='hmsdms')
        hms_equivalents = [
            ("18:04:20.99 -29:31:08.9",
             "18 04 20.99 -29 31 08.9",
             "18h04m20.99s -29d31m08.9s",
             "18h 04m 20.99s -29° 31' 08.9\"",
             "J180420.99-293108.9")
        ]
        
        for equiv_group in hms_equivalents:
            base = equiv_group[0]
            for other in equiv_group[1:]:
                self.assertCoordsEqual(base, other, input_format='hmsdms')

        # Test CASA format equivalence separately (only for HMS input)
        hms_casa_equivalents = [
            ("18:04:20.99 -29:31:08.9",
             "18:04:20.99 -29.31.08.9")
        ]
        
        for equiv_group in hms_casa_equivalents:
            base = equiv_group[0]
            for other in equiv_group[1:]:
                self.assertCoordsEqual(base, other, input_format='hmsdms')

        # Test cases with degree format (input_format='degrees')
        deg_equivalents = [
            ("271.087458 -29.519139",
             "271:05:14.85 -29:31:08.9",
             "271d05m14.85s -29d31m08.9s")
        ]
        
        for equiv_group in deg_equivalents:
            base = equiv_group[0]
            for other in equiv_group[1:]:
                self.assertCoordsEqual(base, other, input_format='degrees')

    def test_format_types(self):
        """Test both HMS/DMS and degree format inputs"""
        # Test pairs of equivalent coordinates in different formats
        test_cases = [
            # (hmsdms_format input, degree_format input)
            ("23:24:59.00 +61:11:14.79", "351:14:45.00 +61:11:14.79"),
            ("23h24m59.00s +61d11m14.79s", "351d14m45.00s +61d11m14.79s"),
            ("23 24 59.00 +61 11 14.79", "351 14 45.00 +61 11 14.79")
        ]
        
        for hmsdms_coord, degree_coord in test_cases:
            # Convert both to decimal and compare
            hmsdms_result = ra_dec_converter(hmsdms_coord, input_format='hmsdms', output_format='degrees')
            degree_result = ra_dec_converter(degree_coord, input_format='degrees', output_format='degrees')
            
            ra1, dec1 = map(float, hmsdms_result.split(', '))
            ra2, dec2 = map(float, degree_result.split(', '))
            
            self.assertTrue(
                isclose(ra1, ra2, rel_tol=1e-7) and isclose(dec1, dec2, rel_tol=1e-7),
                f"Format mismatch:\nHMS/DMS: {hmsdms_coord} -> ({ra1}, {dec1})\n"
                f"Degrees: {degree_coord} -> ({ra2}, {dec2})"
            )

    def test_precision_handling(self):
        """Test that output respects precision specifications"""
        coord = "23:24:59.00 +61:11:14.79"
        
        # Test degrees output with different precisions
        test_cases = [
            # (ra_prec, dec_prec, expected_ra_decimals, expected_dec_decimals)
            (3, 2, 3, 2),
            (5, 4, 5, 4),
            (7, 6, 7, 6),
            (2, 1, 2, 1)
        ]
        
        for ra_prec, dec_prec, expected_ra_dec, expected_dec_dec in test_cases:
            result = ra_dec_converter(
                coord,
                input_format='hmsdms',
                output_format='degrees',
                ra_precision=ra_prec,
                dec_precision=dec_prec
            )
            ra_str, dec_str = result.split(', ')
            
            # Check number of decimal places in RA
            ra_decimals = len(ra_str.split('.')[-1])
            self.assertEqual(ra_decimals, expected_ra_dec, 
                f"RA precision mismatch. Expected {expected_ra_dec} decimals, got {ra_decimals}")
            
            # Check number of decimal places in Dec
            dec_decimals = len(dec_str.split('.')[-1])
            self.assertEqual(dec_decimals, expected_dec_dec,
                f"Dec precision mismatch. Expected {expected_dec_dec} decimals, got {dec_decimals}")

    def test_delimiter_options(self):
        """Test various delimiter options for output"""
        coord = "18:04:20.99 -29:31:08.9"
        
        # Test different delimiter combinations
        results = [
            (", ", " ", "18 04 20.99, -29 31 08.90"),  # Default
            (" ", ":", "18:04:20.99 -29:31:08.90"),    # Colon internal
            (", ", ".", "18.04.20.99, -29.31.08.90"),  # CASA-style output
        ]
        
        for ra_dec_delim, internal_delim, expected in results:
            result = ra_dec_converter(
                coord,
                input_format='hmsdms',
                output_format='hmsdms',
                ra_dec_delimiter=ra_dec_delim,
                internal_delimiter=internal_delim
            )
            self.assertEqual(result, expected)

if __name__ == '__main__':
    unittest.main(verbosity=2)