import re

def ra_dec_converter(input_string, input_format='hmsdms', output_format='degrees', 
                     ra_dec_delimiter=', ', internal_delimiter=' ', 
                     ra_only=False, dec_only=False,
                     ra_precision=None, dec_precision=None):
    """
    Converts RA and Dec from various formats to decimal degrees or HMS/DMS format.

    Parameters:
        input_string (str): A string containing RA and Dec coordinates
        input_format (str): Format of the input - either 'hmsdms' or 'degrees'
        output_format (str): 'degrees' or 'hmsdms' for output format
        ra_dec_delimiter (str): Delimiter between RA and Dec in the output
        internal_delimiter (str): Delimiter within RA and within Dec in the output
        ra_only (bool): If True, output only RA
        dec_only (bool): If True, output only Dec
        ra_precision (int): Number of decimal places for RA output
        dec_precision (int): Number of decimal places for Dec output

    Returns:
        str: Formatted coordinate string
    """
    # Validate input format parameter
    if input_format not in ['hmsdms', 'degrees']:
        raise ValueError("input_format must be either 'hmsdms' or 'degrees'")

    # Set default precisions
    if output_format == 'degrees':
        ra_precision = 7 if ra_precision is None else ra_precision
        dec_precision = 6 if dec_precision is None else dec_precision
    elif output_format == 'hmsdms':
        ra_precision = 2 if ra_precision is None else ra_precision
        dec_precision = 2 if dec_precision is None else dec_precision
    else:
        raise ValueError("Invalid output format specified. Use 'degrees' or 'hmsdms'.")

    # Clean input string
    input_string = input_string.strip()
    input_string = re.sub(r'\b[Jj]\s*2000\.?0?\b\s*', '', input_string).strip()

    # Regular expressions for different formats
    patterns = [
        # Decimal degrees: ddd.dddd [+-]dd.dddd
        r'^([+-]?\d{1,3}\.?\d*)\s*[,\s]+([+-]?\d{1,2}\.?\d*)$',
        
        # HMS/DMS with colons
        r'^(\d{1,3})\s*:\s*(\d{1,2})\s*:\s*([\d\.]+)\s*[,\s]+([+-]?\d{1,3})\s*:\s*(\d{1,2})\s*:\s*([\d\.]+)$',
        
        # HMS/DMS with spaces
        r'^(\d{1,3})\s+(\d{1,2})\s+([\d\.]+)\s*[,\s]+([+-]?\d{1,3})\s+(\d{1,2})\s+([\d\.]+)$',
        
        # HMS/DMS with unit markers
        r'^(\d{1,3})\s*([hHdD°])\s*(\d{1,2})\s*[mM\']\s*([\d\.]+)\s*[sS"]\s*[,\s]+([+-]?\d{1,3})\s*[dD°]\s*(\d{1,2})\s*[mM\']\s*([\d\.]+)\s*[sS"]$',
        
        # Compact format
        r'^[JjEe]?\s*(\d{2})\s*(\d{2})\s*(\d+\.?\d*)\s*([+-])\s*(\d{2})\s*(\d{2})\s*(\d+\.?\d*)$',
        
        # CASA format (only for HMS/DMS input)
        r'^(\d{2}):(\d{2}):(\d+\.?\d*)\s+([+-]?\d{1,3})\.(\d{1,2})\.(\d{1,2}\.?\d*)$'
    ]

    for pattern in patterns:
        match = re.match(pattern, input_string, re.IGNORECASE)
        if match:
            groups = match.groups()
            
            if len(groups) == 2:
                # Decimal format - validate against specified input format
                if input_format == 'hmsdms':
                    raise ValueError("Input appears to be in decimal degrees but input_format='hmsdms' specified")
                ra, dec = map(float, groups)
            
            elif len(groups) == 6:
                # Basic sexagesimal format (no explicit markers) or CASA format
                # Check if this is CASA format by looking for proper decimal point pattern in declination part
                dec_part = input_string.split()[1]
                # CASA dec format should match exactly: [+-]dd.dd.dd.d* (no other delimiters)
                casa_dec_pattern = r'^[+-]?\d+\.\d+\.\d+(?:\.\d+)?$'
                is_casa_format = bool(re.match(casa_dec_pattern, dec_part))
                
                # Check for HMS format indicators
                is_hms = (0 <= float(groups[0]) < 24) and (':' in input_string or ' ' in input_string.strip())
                
                if input_format == 'hmsdms' and not is_hms:
                    raise ValueError("Input appears to be in DMS format but input_format='hmsdms' specified")
                elif input_format == 'degrees' and is_hms:
                    raise ValueError("Input appears to be in HMS format but input_format='degrees' specified")
                
                if is_casa_format and input_format != 'hmsdms':
                    raise ValueError("CASA format is only valid with input_format='hmsdms'")
                
                if is_hms or is_casa_format:
                    ra = hms_to_degrees(groups[0], groups[1], groups[2])
                    dec = dms_to_degrees(groups[3], groups[4], groups[5])
                else:
                    ra = dms_to_degrees(groups[0], groups[1], groups[2])
                    dec = dms_to_degrees(groups[3], groups[4], groups[5])
            
            elif len(groups) == 7:
                # Handle both marked format and compact format cases
                if groups[1] in ['h', 'H', 'd', 'D', '°']:  # Marked format
                    has_hour_marker = any(marker in groups[1].lower() for marker in ['h'])
                    has_degree_marker = any(marker in groups[1] for marker in ['d', 'D', '°'])
                    
                    if input_format == 'hmsdms' and not has_hour_marker:
                        raise ValueError(f"Expected HMS format for RA when input_format='hmsdms', got: {input_string}")
                    elif input_format == 'degrees' and not has_degree_marker:
                        raise ValueError(f"Expected degree format for RA when input_format='degrees', got: {input_string}")
                    
                    if has_hour_marker:
                        ra = hms_to_degrees(groups[0], groups[2], groups[3])
                    else:
                        ra = dms_to_degrees(groups[0], groups[2], groups[3])
                    dec = dms_to_degrees(groups[4], groups[5], groups[6])
                else:  # Compact format (J/E prefix)
                    if input_format == 'hmsdms':
                        # For compact format in HMS, assume hours
                        ra = hms_to_degrees(groups[0], groups[1], groups[2])
                    else:
                        # For compact format in degrees, assume degrees
                        ra = dms_to_degrees(groups[0], groups[1], groups[2])
                    # Dec is always in DMS format for compact notation
                    dec = dms_to_degrees(groups[3] + groups[4], groups[5], groups[6])
            else:
                continue

            # Convert RA from hours to degrees only for HMS input
            if input_format == 'hmsdms':
                ra *= 15

            # Validate ranges
            if output_format == 'degrees':
                if not 0 <= ra < 360:
                    raise ValueError(f"RA must be between 0 and 360 degrees: {ra}")
            else:  # hmsdms output
                ra = ra / 15  # Convert degrees to hours
                if not 0 <= ra < 24:
                    raise ValueError(f"RA must be between 0 and 24 hours: {ra}")
            
            if not -90 <= dec <= 90:
                raise ValueError(f"Dec must be between -90 and +90 degrees: {dec}")

            # Format output
            if output_format == 'degrees':
                ra_str = f"{ra:.{ra_precision}f}"
                dec_str = f"{dec:+.{dec_precision}f}"
            else:  # hmsdms
                ra_str = degrees_to_hms(ra, ra_precision, internal_delimiter)
                dec_str = degrees_to_dms(dec, dec_precision, internal_delimiter)

            if ra_only:
                return ra_str
            elif dec_only:
                return dec_str
            else:
                return f"{ra_str}{ra_dec_delimiter}{dec_str}"

    raise ValueError("Input string format not recognized.")

def hms_to_degrees(hours, minutes, seconds):
    """Convert HH:MM:SS to decimal hours."""
    hours, minutes = float(hours), float(minutes)
    seconds = float(seconds)
    
    if not (0 <= hours < 24):
        raise ValueError(f"Hours must be between 0 and 24: {hours}")
    if not (0 <= minutes < 60):
        raise ValueError(f"Minutes must be between 0 and 60: {minutes}")
    if not (0 <= seconds < 60):
        raise ValueError(f"Seconds must be between 0 and 60: {seconds}")
    
    return hours + minutes/60 + seconds/3600

def dms_to_degrees(degrees, minutes, seconds):
    """Convert DD:MM:SS to decimal degrees."""
    try:
        degrees = float(degrees)
    except ValueError:
        if isinstance(degrees, str) and (degrees.startswith('+') or degrees.startswith('-')):
            sign = -1 if degrees.startswith('-') else 1
            degrees = sign * float(degrees[1:])
        else:
            degrees = float(degrees)
    
    minutes, seconds = float(minutes), float(seconds)
    
    sign = -1 if degrees < 0 else 1
    degrees = abs(degrees)
    
    if not (0 <= minutes < 60):
        raise ValueError(f"Minutes must be between 0 and 60: {minutes}")
    if not (0 <= seconds < 60):
        raise ValueError(f"Seconds must be between 0 and 60: {seconds}")
    
    return sign * (degrees + minutes/60 + seconds/3600)

def degrees_to_hms(hours, precision=2, delimiter=' '):
    """Convert decimal hours to HH:MM:SS.ss format."""
    # Ensure hours are within 0-24 range
    hours = hours % 24
    
    h = int(hours)
    remainder = hours - h
    m = int(remainder * 60)
    remainder = remainder * 60 - m
    s = remainder * 60
    
    if precision == 0:
        return f"{h:02d}{delimiter}{m:02d}{delimiter}{s:.0f}"
    else:
        return f"{h:02d}{delimiter}{m:02d}{delimiter}{s:05.{precision}f}"

def degrees_to_dms(degrees, precision=2, delimiter=' '):
    """Convert decimal degrees to DD:MM:SS.ss format."""
    sign = '-' if degrees < 0 else '+'
    degrees = abs(degrees)
    
    d = int(degrees)
    remainder = degrees - d
    m = int(remainder * 60)
    remainder = remainder * 60 - m
    s = remainder * 60
    
    if precision == 0:
        return f"{sign}{d:02d}{delimiter}{m:02d}{delimiter}{s:02.0f}"
    else:
        return f"{sign}{d:02d}{delimiter}{m:02d}{delimiter}{s:05.{precision}f}"