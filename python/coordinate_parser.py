import re
from math import floor, log10

def determine_precision(value_str):
    """Count decimal places in value_str, e.g. '12.345' -> 3."""
    if '.' not in value_str:
        return 0
    return len(value_str.split('.')[-1])

def ra_dec_converter(
    input_string,
    input_format='hmsdms',   # 'hmsdms', 'degrees', or 'casa'
    output_format='degrees', # 'degrees', 'hmsdms', or 'casa'
    internal_delimiter=None,
    ra_dec_delimiter='\t',
    ra_only=False,
    dec_only=False,
    ra_precision=None,
    dec_precision=None
):
    # Debug: Show inputs
    #print(f"[DEBUG] ra_dec_converter() called with input_string='{input_string}',"
          #f" input_format='{input_format}', output_format='{output_format}'")

    # Decide delimiter defaults
    if internal_delimiter is None:
        if output_format == 'hmsdms':
            internal_delimiter = ':'
        else:
            internal_delimiter = ' '  # for 'degrees' or 'casa'

    # Clean input
    input_string = input_string.strip()
    # Remove epoch markers
    input_string = re.sub(r'\b[Jj]\s*2000\.?0?\b\s*', '', input_string).strip()

    # 1) Split RA/Dec
    ra_part, dec_part = split_ra_dec(input_string, input_format)
    #print(f"[DEBUG] After split_ra_dec => ra_part='{ra_part}', dec_part='{dec_part}'")

    # 2) Convert RA => degrees
    ra_val, ra_inprec = parse_to_degrees(ra_part, is_ra=True, input_format=input_format)
    # 3) Convert Dec => degrees
    dec_val, dec_inprec = parse_to_degrees(dec_part, is_ra=False, input_format=input_format)

    #print(f"[DEBUG] parse_to_degrees => RA={ra_val:.6f} deg (inprec={ra_inprec}),"
          #f" Dec={dec_val:.6f} deg (inprec={dec_inprec})")

    # Validate range
    if not (0 <= ra_val < 360):
        raise ValueError(f"RA must be [0..360): {ra_val}")
    if not (-90 <= dec_val <= 90):
        raise ValueError(f"Dec must be [-90..+90]: {dec_val}")

    # 4) Decide final precision
    final_ra_precision = ra_precision if (ra_precision is not None) else ra_inprec
    final_dec_precision = dec_precision if (dec_precision is not None) else dec_inprec

    #print(f"[DEBUG] final_ra_precision={final_ra_precision}, final_dec_precision={final_dec_precision}")

    # 5) Format output
    if output_format == 'degrees':
        ra_str = format_degrees(ra_val, final_ra_precision, force_sign=False)
        dec_str = format_degrees(dec_val, final_dec_precision, force_sign=True)
        #print(f"[DEBUG] Output in degrees => RA='{ra_str}', Dec='{dec_str}'")
    elif output_format == 'hmsdms':
        ra_str = degrees_to_hms(ra_val, final_ra_precision, delimiter=internal_delimiter)
        dec_str = degrees_to_dms(dec_val, final_dec_precision, delimiter=internal_delimiter)
        #print(f"[DEBUG] Output in hmsdms => RA='{ra_str}', Dec='{dec_str}'")
    else:
        # 'casa'
        ra_str = degrees_to_hms(ra_val, final_ra_precision, delimiter=':')
        dec_str = degrees_to_casa_dec(dec_val, final_dec_precision)
        #print(f"[DEBUG] Output in casa => RA='{ra_str}', Dec='{dec_str}'")

    if ra_only:
        return ra_str
    elif dec_only:
        return dec_str
    else:
        final_str = f"{ra_str}{ra_dec_delimiter}{dec_str}"
        #print(f"[DEBUG] final_str='{final_str}'")
        return final_str


def split_ra_dec(input_str, in_fmt):
    input_str = input_str.strip()
    # DEBUG
    #print(f"[DEBUG] split_ra_dec() called with input_str='{input_str}', in_fmt='{in_fmt}'")

    if in_fmt == 'casa':
        parts = re.split(r'[,\s]+', input_str)
        if len(parts) != 2:
            raise ValueError(f"Expected 2 tokens for CASA input: got {parts}")
        return parts[0], parts[1]
    elif in_fmt == 'hmsdms':
        m = re.match(r'^(.*?)([+\-]\d.*)$', input_str.replace(',', ' '))
        if m:
            return m.group(1).strip(), m.group(2).strip()
        # fallback
        parts = re.split(r'\s+', input_str)
        if len(parts) == 2:
            return parts[0], parts[1]
        raise ValueError(f"Cannot split hmsdms input: '{input_str}'")
    else:
        # 'degrees'
        parts = re.split(r'[,\s]+', input_str)
        if len(parts) == 2:
            return parts[0], parts[1]
        # fallback sign-based
        pat = re.compile(r'^(.*?)([+\-]\d.*)$')
        m2 = pat.match(input_str)
        if m2:
            return m2.group(1).strip(), m2.group(2).strip()
        raise ValueError(f"Cannot split degrees input: '{input_str}'")


def parse_to_degrees(coord_str, is_ra, input_format):
    #print(f"[DEBUG] parse_to_degrees() coord_str='{coord_str}', is_ra={is_ra}, input_format='{input_format}'")
    coord_str = coord_str.strip()

    if input_format == 'casa':
        if is_ra:
            h, m, s = parse_ra_colon_strict(coord_str)
            prec = determine_precision(s)
            val = hms_to_degrees(h, m, s)*15.0
            return val, prec
        else:
            val, prec = parse_casa_dotted_dec(coord_str)
            return val, prec

    elif input_format == 'hmsdms':
        h, m, s = parse_hms_or_dms(coord_str)
        inprec = determine_precision(s)
        if is_ra:
            val = hms_to_degrees(h, m, s)*15.0
        else:
            val = dms_to_degrees(h, m, s)
        return val, inprec

    else:
        # 'degrees'
        if ':' in coord_str:
            # parse as d:m:s
            d, mm, ss = parse_hms_or_dms(coord_str)
            inprec = determine_precision(ss)
            val = dms_to_degrees(d, mm, ss)
            return val, inprec
        else:
            # parse as float
            try:
                val = float(coord_str)
            except ValueError:
                raise ValueError(f"Cannot parse '{coord_str}' as decimal degrees.")
            prec = determine_precision(coord_str)
            return val, prec


def parse_ra_colon_strict(ra_str):
    parts = ra_str.split(':')
    if len(parts) != 3:
        raise ValueError(f"CASA RA must have exactly 3 colon fields, got '{ra_str}'")
    return parts[0], parts[1], parts[2]


def parse_casa_dotted_dec(dec_str):
    dec_str = dec_str.strip()
    pattern = re.compile(r'^([+\-])(\d{1,3})\.(\d{1,2})\.(\d{1,2}(\.\d+)?)$')
    m = pattern.match(dec_str)
    if not m:
        raise ValueError(f"Invalid CASA dec: '{dec_str}' (should be ±DD.MM.SS(.ss))")
    sign_char, d, mm, ss_str, _ = m.groups()
    sign = -1 if sign_char=='-' else 1
    dd = float(d)
    mmf = float(mm)
    ssf = float(ss_str)
    prec = determine_precision(ss_str)
    decval = sign*(dd + mmf/60 + ssf/3600)
    return decval, prec


def parse_hms_or_dms(coord_str):
    """
    Convert e.g. '12h34m56.7s' or '351:14:45.00' into (h_or_d, m, s).
    We add debug prints to see what the final tokens are.
    """
    #print(f"[DEBUG] parse_hms_or_dms() => coord_str='{coord_str}'")
    cleaned = re.sub(r'[hHdD°mM\'sS"]', ' ', coord_str)
    #print(f"[DEBUG] after removing h/m/s/d => '{cleaned}'")
    tokens = re.split(r'[:\s]+', cleaned.strip())
    tokens = [t for t in tokens if t]
    #print(f"[DEBUG] tokens={tokens}")
    if len(tokens) == 0:
        return ('0', '0', '0')
    elif len(tokens) == 1:
        return (tokens[0], '0', '0')
    elif len(tokens) == 2:
        return (tokens[0], tokens[1], '0')
    else:
        return (tokens[0], tokens[1], tokens[2])


def hms_to_degrees(h, m, s):
    #print(f"[DEBUG] hms_to_degrees(h={h}, m={m}, s={s})")
    hh = float(h)
    mm = float(m)
    ss = float(s)
    if not (0 <= hh < 24):
        raise ValueError(f"Hours out of range [0..24): {hh}")
    if not (0 <= mm < 60):
        raise ValueError(f"Minutes out of range [0..60): {mm}")
    if not (0 <= ss < 60):
        raise ValueError(f"Seconds out of range [0..60): {ss}")
    val = hh + mm/60.0 + ss/3600.0
    #print(f"[DEBUG] => hours={val:.6f} (decimal hours), => deg(=val*15 if RA)")
    return val

def dms_to_degrees(d, m, s):
    #print(f"[DEBUG] dms_to_degrees(d={d}, m={m}, s={s})")
    sign = 1
    d_str = d.strip()
    if d_str.startswith('-'):
        sign = -1
        d_str = d_str[1:]
    elif d_str.startswith('+'):
        d_str = d_str[1:]
    dd = float(d_str) if d_str else 0.0
    mm = float(m)
    ss = float(s)
    if not (0 <= mm < 60):
        raise ValueError(f"Minutes out of range [0..60): {mm}")
    if not (0 <= ss < 60):
        raise ValueError(f"Seconds out of range [0..60): {ss}")
    deg_val = dd + mm/60.0 + ss/3600.0
    deg_val_signed = sign*deg_val
    #print(f"[DEBUG] => deg_val={deg_val_signed:.6f}")
    return deg_val_signed

def format_degrees(value, precision, force_sign=False):
    if force_sign:
        out = f"{value:+.{precision}f}"
    else:
        out = f"{value:.{precision}f}"
    #print(f"[DEBUG] format_degrees(value={value}, precision={precision}, force_sign={force_sign}) => '{out}'")
    return out

def degrees_to_hms(deg_val, precision=2, delimiter=':'):
    hours = (deg_val / 15.0) % 24
    hh = int(hours)
    remainder = hours - hh
    mm = int(remainder * 60)
    remainder = remainder * 60 - mm
    ss = remainder * 60

    # Round it once at high precision or do it inside helper
    # but two_digit_left also calls round. So we do not double-round.
    if precision > 0:
        s_str = two_digit_left(ss, precision)
    else:
        s_str = f"{int(round(ss)):02d}"

    return f"{hh:02d}{delimiter}{mm:02d}{delimiter}{s_str}"


def degrees_to_dms(deg_val, precision=2, delimiter=':'):
    sign = '-' if deg_val < 0 else '+'
    v = abs(deg_val)
    dd = int(v)
    remainder = v - dd
    mm = int(remainder * 60)
    remainder = remainder * 60 - mm
    ss = remainder * 60

    if precision > 0:
        s_str = two_digit_left(ss, precision)
    else:
        s_str = f"{int(round(ss)):02d}"

    return f"{sign}{dd:02d}{delimiter}{mm:02d}{delimiter}{s_str}"


def degrees_to_casa_dec(deg_val, precision=2):
    #print(f"[DEBUG] degrees_to_casa_dec(deg_val={deg_val:.6f}, precision={precision})")
    sign = '-' if deg_val<0 else '+'
    v = abs(deg_val)
    dd = int(v)
    remainder = v - dd
    mm = int(remainder*60)
    remainder = remainder*60 - mm
    ss = round(remainder*60, precision)
    if precision>0:
        s_str = f"{ss:02.{precision}f}"
    else:
        s_str = f"{int(ss):02d}"

    d_str = f"{dd:02d}"
    m_str = f"{mm:02d}"
    out = f"{sign}{d_str}.{m_str}.{s_str}"
    #print(f"[DEBUG] degrees_to_casa_dec => '{out}'")
    return out

def two_digit_left(value, precision):
    """
    Convert 'value' (0 <= value < 60) into a string with exactly 2 digits 
    to the left of the decimal, and 'precision' digits to the right.
    Examples:
      value=0.0,  precision=2 => '00.00'
      value=8.9,  precision=2 => '08.90'
      value=12.34,precision=2 => '12.34'
    """
    # Round to the given decimal places
    val_rounded = round(value, precision)
    
    # Build normal float string with that many decimals
    # e.g. "0.00", "8.90", "12.34"
    base_str = f"{val_rounded:.{precision}f}"
    
    # If the integer part is only 1 digit, prepend '0'
    # e.g. "8.90" => "08.90", "0.00" => "00.00"
    if '.' in base_str:
        int_part, frac_part = base_str.split('.')
        if len(int_part) == 1:           # e.g. '8', '0'
            return f"0{int_part}.{frac_part}"
        else:
            return base_str
    else:
        # if no '.', we only have an integer (precision=0). 
        # e.g. "5" => "05"
        if len(base_str) == 1:
            return "0" + base_str
        else:
            return base_str

