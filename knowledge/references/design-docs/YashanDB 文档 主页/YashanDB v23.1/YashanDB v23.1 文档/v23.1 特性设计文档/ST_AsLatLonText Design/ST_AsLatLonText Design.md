Created by 文博浩, last modified on 六月 06, 2023

##   [1. Overview（概述）](#1-overview概述)  

返回点的度、分、秒表示形式。

语法：

```
ST_AsLatLonText(geom geometry, format string) return clob

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 该函数假定该点位于经度/纬度投影中。X（lon）和Y（lat）坐标在输出中被归一化为“正常”范围（经度的范围为-180至+180，纬度的范围为-90至+90）。
- pt的geometry类型必须为Point，否则报错：Only points are supported
- format参数是一个格式字符串，长度限制到1024，不支持中文，包含结果文本的格式，类似于日期格式字符串。有效标记为“D”代表度数，“M”代表分钟，“S”代表秒，“C”代表基本方向 (NSEW)。
- 必须包含“D”。
- “M”、“S”和“C”是可选的。
    - 如果省略了“C”，则度数在南或西时以“-”符号显示。
    - 如果省略了“S”，则分钟将显示为十进制，精度与指定的位数相同。
    - 如果省略了“M”，则度以十进制显示，并具有指定的位数精度。
- 可以重复“D”、“M”、“S”标记以指示所需的宽度和精度（“SSS.SSSS”表示“1.0023”），“C”不可重复。
- 一串“D”、“M”、“S”和一个“C”在格式字符串中只能出现一次。
- 如果省略格式字符串（或零长度），将使用默认格式'D°M''S.SSS"C'。（sql语法：单引号需要输入两个单引号进行转义）


参数类型：

- 参数1：geometry
- 参数2：char、varchar


返回类型：clob

Null值：

- pt为null返回null
- format为null返回null


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomToLatLon()
geomAsLatLonText()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

```
static YspiResult geomAsLatLonText(YspiHandle hExec)
{
    YspiValue value, format;
    if (yspiGetArg(hExec, 1, YSPI_STRING, &amp;format) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    if (format.isNull) {
        varAsNull(&amp;value, YSPI_STRING);
        return yspiReturnAsLob(hExec, YSPI_CLOB, &amp;value);
    }

    GeomSerial gs;
    bool hasNull = false;
    YSPI_CALL(piGetLobArg(hExec, 0, YSPI_BLOB, &amp;gs.ewkbSize, (char**)&amp;gs.ewkb, &amp;hasNull));
    if (hasNull) {
        varAsNull(&amp;value, YSPI_STRING);
        return yspiReturnAsLob(hExec, YSPI_CLOB, &amp;value);
    }

    char* formatStr;
    if (piAllocMem(hExec, format.size + 1, &amp;formatStr) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    strcpy(formatStr, format.vStr);
    formatStr[format.size] = '\0';
    if (piGeomToLatLon(hExec, &amp;gs, formatStr, &amp;value.vStr) != YSPI_SUCCESS) {
        piFreeMem(hExec, gs.ewkb);
        return YSPI_ERROR;
    }

    piFreeMem(hExec, formatStr);
    piFreeMem(hExec, gs.ewkb);
    value.type = YSPI_STRING;
    value.size = (uint32_t)strlen(value.vStr);
    value.isNull = false;
    YspiResult result = yspiReturnAsLob(hExec, YSPI_CLOB, &amp;value);
    return result;
}

```

```
YspiResult piGeomToLatLon(YspiHandle hExec, GeomSerial* gs, const char* format, char** formattedStr)
{
    Geometry* geom;
    YSPI_RESOURCE_CALL(piParseWkb(hExec, gs-&gt;ewkb, gs-&gt;ewkbSize, &amp;geom), piFreeMem(hExec, gs-&gt;ewkb));

    if (geom-&gt;type != YAS_GEOM_POINT) {
        yspiSetError(hExec, "only points are supported");
        return YSPI_ERROR;
    }

    GeomPoint* pointIn = (GeomPoint*)geom;
    if (pointIsEmpty(pointIn)) {
        yspiSetError(hExec, "cannot convert an empty point into formatted text");
        return YSPI_ERROR;
    }

    Point2D* cp = (Point2D*)pointIn-&gt;point;
    double   lat = cp-&gt;y;
    double   lon = cp-&gt;x;

    // normalize lat/lon to the normal (-90 to 90, -180 to 180) range.
    normalizeLatLon(&amp;lat, &amp;lon);

    char* latStr;
    char* lonStr;
    YSPI_CALL(LatLonToDMS(hExec, lat, "N", "S", format, &amp;latStr));
    YSPI_CALL(LatLonToDMS(hExec, lon, "E", "W", format, &amp;lonStr));

    if (piAllocMem(hExec, strlen(latStr) + strlen(lonStr) + 2, formattedStr) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }
    strcpy(*formattedStr, latStr);
    strcat(*formattedStr, " ");
    strcat(*formattedStr, lonStr);

    piFreeMem(hExec, latStr);
    piFreeMem(hExec, lonStr);
    return YSPI_SUCCESS;
}

```

PostGIS实现：

```
/*
 * LWGEOM_to_latlon(GEOMETRY, text)
 *  NOTE: Geometry must be a point.  It is assumed that the coordinates
 *        of the point are in a lat/lon projection, and they will be
 *        normalized in the output to -90-90 and -180-180.
 *
 *  The text parameter is a format string containing the format for the
 *  resulting text, similar to a date format string.  Valid tokens
 *  are "D" for degrees, "M" for minutes, "S" for seconds, and "C" for
 *  cardinal direction (NSEW).  DMS tokens may be repeated to indicate
 *  desired width and precision ("SSS.SSSS" means "  1.0023").
 *  "M", "S", and "C" are optional.  If "C" is omitted, degrees are
 *  shown with a "-" sign if south or west.  If "S" is omitted,
 *  minutes will be shown as decimal with as many digits of precision
 *  as you specify.  If "M" is omitted, degrees are shown as decimal
 *  with as many digits precision as you specify.
 *
 *  If the format string is omitted (null or 0-length) a default
 *  format will be used.
 *
 *  returns text
 */
PG_FUNCTION_INFO_V1(LWGEOM_to_latlon);
Datum LWGEOM_to_latlon(PG_FUNCTION_ARGS)
{
	/* Get the parameters */
	GSERIALIZED *pg_lwgeom = PG_GETARG_GSERIALIZED_P(0);
	text *format_text = PG_GETARG_TEXT_P(1);

	LWGEOM *lwgeom;
	char *format_str = NULL;

	char * formatted_str;
	text * formatted_text;
	char * tmp;

	/* Only supports points. */
	uint8_t geom_type = gserialized_get_type(pg_lwgeom);
	if (POINTTYPE != geom_type)
	{
		lwpgerror("Only points are supported, you tried type %s.", lwtype_name(geom_type));
	}
	/* Convert to LWGEOM type */
	lwgeom = lwgeom_from_gserialized(pg_lwgeom);

  if (format_text == NULL) {
    lwpgerror("ST_AsLatLonText: invalid format string (null");
    PG_RETURN_NULL();
  }

	format_str = text_to_cstring(format_text);
  assert(format_str != NULL);

  /* The input string supposedly will be in the database encoding,
     so convert to UTF-8. */
  tmp = (char *)pg_do_encoding_conversion(
    (uint8_t *)format_str, strlen(format_str), GetDatabaseEncoding(), PG_UTF8);
  assert(tmp != NULL);
  if ( tmp != format_str ) {
    pfree(format_str);
    format_str = tmp;
  }

	/* Produce the formatted string. */
	formatted_str = lwpoint_to_latlon((LWPOINT *)lwgeom, format_str);
  assert(formatted_str != NULL);
  pfree(format_str);

  /* Convert the formatted string from UTF-8 back to database encoding. */
  tmp = (char *)pg_do_encoding_conversion(
    (uint8_t *)formatted_str, strlen(formatted_str),
    PG_UTF8, GetDatabaseEncoding());
  assert(tmp != NULL);
  if ( tmp != formatted_str) {
    pfree(formatted_str);
    formatted_str = tmp;
  }

	/* Convert to the postgres output string type. */
	formatted_text = cstring_to_text(formatted_str);
  pfree(formatted_str);

	PG_RETURN_POINTER(formatted_text);
}

/* Print the X (lon) and Y (lat) of the given point in DMS form using
 * the specified format.
 * First normalizes the values so they will display as -90 to 90 and -180 to 180.
 * Format string may be null or 0-length, in which case a default format will be used.
 * NOTE: Format string is required to be in UTF-8.
 * NOTE2: returned string is lwalloc'ed, caller is responsible to lwfree it up
 */
char* lwpoint_to_latlon(const LWPOINT * pt, const char *format)
{
	const POINT2D *p;
	if (NULL == pt)
	{
		lwerror("Cannot convert a null point into formatted text.");
	}
	if (lwgeom_is_empty((LWGEOM *)pt))
	{
		lwerror("Cannot convert an empty point into formatted text.");
	}
	p = getPoint2d_cp(pt-&gt;point, 0);
	return lwdoubles_to_latlon(p-&gt;y, p-&gt;x, format);
}

/**
 * Returns a POINT2D pointer into the POINTARRAY serialized_ptlist,
 * suitable for reading from. This is very high performance
 * and declared const because you aren't allowed to muck with the
 * values, only read them.
 */
static inline const POINT2D *
getPoint2d_cp(const POINTARRAY *pa, uint32_t n)
{
	return (const POINT2D *)getPoint_internal(pa, n);
}

/*
 * Get a pointer to Nth point of a POINTARRAY
 * You'll need to cast it to appropriate dimensioned point.
 * Note that if you cast to a higher dimensional point you'll
 * possibly corrupt the POINTARRAY.
 *
 * Casting to returned pointer to POINT2D* should be safe,
 * as gserialized format always keeps the POINTARRAY pointer
 * aligned to double boundary.
 *
 * WARNING: Don't cast this to a POINT!
 * it would not be reliable due to memory alignment constraints
 */
static inline uint8_t *
getPoint_internal(const POINTARRAY *pa, uint32_t n)
{
	size_t size;
	uint8_t *ptr;

#if PARANOIA_LEVEL &gt; 0
	assert(pa);
	assert(n &lt;= pa-&gt;npoints);
	assert(n &lt;= pa-&gt;maxpoints);
#endif

	size = ptarray_point_size(pa);
	ptr = pa-&gt;serialized_pointlist + size * n;

	return ptr;
}

/*
 * Size of point represeneted in the POINTARRAY
 * 16 for 2d, 24 for 3d, 32 for 4d
 */
static inline size_t
ptarray_point_size(const POINTARRAY *pa)
{
	return sizeof(double) * FLAGS_NDIMS(pa-&gt;flags);
}

/* Print two doubles (lat and lon) in DMS form using the specified format.
 * First normalizes them so they will display as -90 to 90 and -180 to 180.
 * Format string may be null or 0-length, in which case a default format will be used.
 * NOTE: Format string is required to be in UTF-8.
 * NOTE2: returned string is lwalloc'ed, caller is responsible to lwfree it up
 */
static char * lwdoubles_to_latlon(double lat, double lon, const char * format)
{
	char * lat_text;
	char * lon_text;
	char * result;
	size_t sz;

	/* Normalize lat/lon to the normal (-90 to 90, -180 to 180) range. */
	lwprint_normalize_latlon(&amp;lat, &amp;lon);
	/* This is somewhat inefficient as the format is parsed twice. */
	lat_text = lwdouble_to_dms(lat, "N", "S", format);
	lon_text = lwdouble_to_dms(lon, "E", "W", format);

	/* lat + lon + a space between + the null terminator. */
	sz = strlen(lat_text) + strlen(lon_text) + 2;
	result = (char*)lwalloc(sz);
	snprintf(result, sz, "%s %s", lat_text, lon_text);
	lwfree(lat_text);
	lwfree(lon_text);
	return result;
}

/* Ensures the given lat and lon are in the "normal" range:
 * -90 to +90 for lat, -180 to +180 for lon. */
static void lwprint_normalize_latlon(double *lat, double *lon)
{
	/* First remove all the truly excessive trips around the world via up or down. */
	while (*lat &gt; 270)
	{
		*lat -= 360;
	}
	while (*lat &lt; -270)
	{
		*lat += 360;
	}

	/* Now see if latitude is past the top or bottom of the world.
	 * Past 90  or -90 puts us on the other side of the earth,
	     * so wrap latitude and add 180 to longitude to reflect that. */
	if (*lat &gt; 90)
	{
		*lat = 180 - *lat;
		*lon += 180;
	}
	if (*lat &lt; -90)
	{
		*lat = -180 - *lat;
		*lon += 180;
	}
	/* Now make sure lon is in the normal range.  Wrapping longitude
	 * has no effect on latitude. */
	while (*lon &gt; 180)
	{
		*lon -= 360;
	}
	while (*lon &lt; -180)
	{
		*lon += 360;
	}
}

/* Converts a single double to DMS given the specified DMS format string.
 * Symbols are specified since N/S or E/W are the only differences when printing
 * lat vs. lon.  They are only used if the "C" (compass dir) token appears in the
 * format string.
 * NOTE: Format string and symbols are required to be in UTF-8. */
static char * lwdouble_to_dms(double val, const char *pos_dir_symbol, const char *neg_dir_symbol, const char * format)
{
	/* 3 numbers, 1 sign or compass dir, and 5 possible strings (degree signs, spaces, misc text, etc) between or around them.*/
#	define NUM_PIECES 9
#	define WORK_SIZE 1024
	char pieces[NUM_PIECES][WORK_SIZE];
	int current_piece = 0;
	int is_negative = 0;

	double degrees = 0.0;
	double minutes = 0.0;
	double seconds = 0.0;

	int compass_dir_piece = -1;

	int reading_deg = 0;
	int deg_digits = 0;
	int deg_has_decpoint = 0;
	int deg_dec_digits = 0;
	int deg_piece = -1;

	int reading_min = 0;
	int min_digits = 0;
	int min_has_decpoint = 0;
	int min_dec_digits = 0;
	int min_piece = -1;

	int reading_sec = 0;
	int sec_digits = 0;
	int sec_has_decpoint = 0;
	int sec_dec_digits = 0;
	int sec_piece = -1;

	int round_pow = 0;

	int format_length = ((NULL == format) ? 0 : strlen(format));

	char * result;

	int index, following_byte_index;
	int multibyte_char_width = 1;

	/* Initialize the working strs to blank.  We may not populate all of them, and
	 * this allows us to concat them all at the end without worrying about how many
	 * we actually needed. */
	for (index = 0; index &lt; NUM_PIECES; index++)
	{
		pieces[index][0] = '\0';
	}

	/* If no format is provided, use a default. */
	if (0 == format_length)
	{
		/* C2B0 is UTF-8 for the degree symbol. */
		format = "D\xC2\xB0""M'S.SSS\"C";
		format_length = strlen(format);
	}
	else if (format_length &gt; WORK_SIZE)
	{
		/* Sanity check, we don't want to overwrite an entire piece of work and no one should need a 1K-sized
		* format string anyway. */
		lwerror("Bad format, exceeds maximum length (%d).", WORK_SIZE);
	}

	for (index = 0; index &lt; format_length; index++)
	{
		char next_char = format[index];
		switch (next_char)
		{
		case 'D':
			if (reading_deg)
			{
				/* If we're reading degrees, add another digit. */
				deg_has_decpoint ? deg_dec_digits++ : deg_digits++;
			}
			else
			{
				/* If we're not reading degrees, we are now. */
				current_piece++;
				deg_piece = current_piece;
				if (deg_digits &gt; 0)
				{
					lwerror("Bad format, cannot include degrees (DD.DDD) more than once.");
				}
				reading_deg = 1;
				reading_min = 0;
				reading_sec = 0;
				deg_digits++;
			}
			break;
		case 'M':
			if (reading_min)
			{
				/* If we're reading minutes, add another digit. */
				min_has_decpoint ? min_dec_digits++ : min_digits++;
			}
			else
			{
				/* If we're not reading minutes, we are now. */
				current_piece++;
				min_piece = current_piece;
				if (min_digits &gt; 0)
				{
					lwerror("Bad format, cannot include minutes (MM.MMM) more than once.");
				}
				reading_deg = 0;
				reading_min = 1;
				reading_sec = 0;
				min_digits++;
			}
			break;
		case 'S':
			if (reading_sec)
			{
				/* If we're reading seconds, add another digit. */
				sec_has_decpoint ? sec_dec_digits++ : sec_digits++;
			}
			else
			{
				/* If we're not reading seconds, we are now. */
				current_piece++;
				sec_piece = current_piece;
				if (sec_digits &gt; 0)
				{
					lwerror("Bad format, cannot include seconds (SS.SSS) more than once.");
				}
				reading_deg = 0;
				reading_min = 0;
				reading_sec = 1;
				sec_digits++;
			}
			break;
		case 'C':
			/* We're done reading anything else we might have been reading. */
			if (reading_deg || reading_min || reading_sec)
			{
				/* We were reading something, that means this is the next piece. */
				reading_deg = 0;
				reading_min = 0;
				reading_sec = 0;
			}
			current_piece++;

			if (compass_dir_piece &gt;= 0)
			{
				lwerror("Bad format, cannot include compass dir (C) more than once.");
			}
			/* The compass dir is a piece all by itself.  */
			compass_dir_piece = current_piece;
			current_piece++;
			break;
		case '.':
			/* If we're reading deg, min, or sec, we want a decimal point for it. */
			if (reading_deg)
			{
				deg_has_decpoint = 1;
			}
			else if (reading_min)
			{
				min_has_decpoint = 1;
			}
			else if (reading_sec)
			{
				sec_has_decpoint = 1;
			}
			else
			{
				/* Not reading anything, just pass through the '.' */
				strncat(pieces[current_piece], &amp;next_char, 1);
			}
			break;
		default:
			/* Any other char is just passed through unchanged.  But it does mean we are done reading D, M, or S.*/
			if (reading_deg || reading_min || reading_sec)
			{
				/* We were reading something, that means this is the next piece. */
				current_piece++;
				reading_deg = 0;
				reading_min = 0;
				reading_sec = 0;
			}

			/* Check if this is a multi-byte UTF-8 character.  If so go ahead and read the rest of the bytes as well. */
			multibyte_char_width = 1;
			if (next_char &amp; 0x80)
			{
				if ((next_char &amp; 0xF8) == 0xF0)
				{
					multibyte_char_width += 3;
				}
				else if ((next_char &amp; 0xF0) == 0xE0)
				{
					multibyte_char_width += 2;
				}
				else if ((next_char &amp; 0xE0) == 0xC0)
				{
					multibyte_char_width += 1;
				}
				else
				{
					lwerror("Bad format, invalid high-order byte found first, format string may not be UTF-8.");
				}
			}
			if (multibyte_char_width &gt; 1)
			{
				if (index + multibyte_char_width &gt;= format_length)
				{
					lwerror("Bad format, UTF-8 character first byte found with insufficient following bytes, format string may not be UTF-8.");
				}
				for (following_byte_index = (index + 1); following_byte_index &lt; (index + multibyte_char_width); following_byte_index++)
				{
					if ((format[following_byte_index] &amp; 0xC0) != 0x80)
					{
						lwerror("Bad format, invalid byte found following leading byte of multibyte character, format string may not be UTF-8.");
					}
				}
			}
			/* Copy all the character's bytes into the current piece. */
			strncat(pieces[current_piece], &amp;(format[index]), multibyte_char_width);
			/* Now increment index past the rest of those bytes. */
			index += multibyte_char_width - 1;
			break;
		}
		if (current_piece &gt;= NUM_PIECES)
		{
			lwerror("Internal error, somehow needed more pieces than it should.");
		}
	}
	if (deg_piece &lt; 0)
	{
		lwerror("Bad format, degrees (DD.DDD) must be included.");
	}

	/* Divvy the number up into D, DM, or DMS */
	if (val &lt; 0)
	{
		val *= -1;
		is_negative = 1;
	}
	degrees = val;
	if (min_digits &gt; 0)
	{
		/* Break degrees to integer and use fraction for minutes */
		minutes = modf(val, °rees) * 60;
	}
	if (sec_digits &gt; 0)
	{
		if (0 == min_digits)
		{
			lwerror("Bad format, cannot include seconds (SS.SSS) without including minutes (MM.MMM).");
		}
		seconds = modf(minutes, &amp;minutes) * 60;
		if (sec_piece &gt;= 0)
		{
			/* See if the formatted seconds round up to 60. If so, increment minutes and reset seconds. */
			round_pow = pow(10, sec_dec_digits);
			if (floorf(seconds * round_pow) / round_pow &gt;= 60)
			{
				minutes += 1;
				seconds = 0;
			}
		}
	}

	/* Handle the compass direction.  If not using compass dir, display degrees as a positive/negative number. */
	if (compass_dir_piece &gt;= 0)
	{
		strcpy(pieces[compass_dir_piece], is_negative ? neg_dir_symbol : pos_dir_symbol);
	}
	else if (is_negative)
	{
		degrees *= -1;
	}

	/* Format the degrees into their string piece. */
	if (deg_digits + deg_dec_digits + 2 &gt; WORK_SIZE)
	{
		lwerror("Bad format, degrees (DD.DDD) number of digits was greater than our working limit.");
	}
	if(deg_piece &gt;= 0)
	{
		snprintf(pieces[deg_piece], WORK_SIZE, "%*.*f", deg_digits, deg_dec_digits, degrees);
	}

	if (min_piece &gt;= 0)
	{
		/* Format the minutes into their string piece. */
		if (min_digits + min_dec_digits + 2 &gt; WORK_SIZE)
		{
			lwerror("Bad format, minutes (MM.MMM) number of digits was greater than our working limit.");
		}
		snprintf(pieces[min_piece], WORK_SIZE, "%*.*f", min_digits, min_dec_digits, minutes);
	}
	if (sec_piece &gt;= 0)
	{
		/* Format the seconds into their string piece. */
		if (sec_digits + sec_dec_digits + 2 &gt; WORK_SIZE)
		{
			lwerror("Bad format, seconds (SS.SSS) number of digits was greater than our working limit.");
		}
		snprintf(pieces[sec_piece], WORK_SIZE, "%*.*f", sec_digits, sec_dec_digits, seconds);
	}

	/* Allocate space for the result.  Leave plenty of room for excess digits, negative sign, etc.*/
	result = (char*)lwalloc(format_length + WORK_SIZE);
	memset(result, 0, format_length + WORK_SIZE);

	/* Append all the pieces together. There may be less than 9, but in that case the rest will be blank. */
	strcpy(result, pieces[0]);
	for (index = 1; index &lt; NUM_PIECES; index++)
	{
		strcat(result, pieces[index]);
	}

	return result;
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  