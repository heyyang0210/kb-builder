Created by 文博浩, last modified by  王若琳 on 四月 21, 2023

##   [1. Overview（概述）](#1-overview概述)  

返回输入几何体或地理的GeoJSON表示形式。

语法：

```
ST_AsGeoJson(geom blob [,precision int [,options int]]) return clob

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 将geometry作为GeoJSON“几何”返回。不可以作为GeoJSON“特征”返回一行，与PostGIS不同（GEOS库不支持）。
- 只支持2D几何图形。3D几何图形会丢弃z-index，与PostGIS不同（GEOS库不支持）。
- 若输入非法几何，则报错。


参数类型：

- 参数1：geometry
- 参数2：整数，浮点数、number四舍五入转成整数，与PostGIS不同
- 参数3：整数，浮点数、number四舍五入转成整数，与PostGIS不同


返回类型：clob

Null值：

- geom为null返回null
- precision为null返回null
- options为null返回null


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeosGSToGeoJson()
geomAsGeoJson()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- precision、options参数无效，GEOS库无法满足需求，需要在实现geometry的基础上自研geojson格式化。
- 不支持GeoJSON的Feature。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1. blob为null返回null。
1. 调用GEOSGeomFromWKB_buf_r函数从blob转成GEOSGeometry类型。
1. GEOSGeometry为null报错。
1. 调用GEOSGeoJSONWriter_writeGeometry_r函数写geometry的GeoJSON表示。


PostGIS实现：对每个具体的geometry类型不同规则单独实现转成GeoJSON

```
/**
 * Encode Feature in GeoJson
 */
PG_FUNCTION_INFO_V1(LWGEOM_asGeoJson);
Datum LWGEOM_asGeoJson(PG_FUNCTION_ARGS)
{
	GSERIALIZED *geom;
	LWGEOM *lwgeom;
	char *geojson;
	text *result;
	int precision = DBL_DIG;
	int output_bbox = LW_FALSE;
	int output_long_crs = LW_FALSE;
	int output_short_crs = LW_FALSE;
	int output_guess_short_srid = LW_FALSE;
	char *srs = NULL;
	int32_t srid;

	/* Get the geometry */
	if (PG_ARGISNULL(0))
		PG_RETURN_NULL();

	geom = PG_GETARG_GSERIALIZED_P(0);
	srid = gserialized_get_srid(geom);

	/* Retrieve precision if any (default is max) */
	if ( PG_NARGS() &gt; 1 &amp;&amp; !PG_ARGISNULL(1) )
	{
		precision = PG_GETARG_INT32(1);
		if ( precision &gt; DBL_DIG )
			precision = DBL_DIG;
		else if ( precision &lt; 0 )
			precision = 0;
	}

	/* Retrieve output option
	 * 0 = without option
	 * 1 = bbox
	 * 2 = short crs
	 * 4 = long crs
	 * 8 = guess if CRS is needed (default)
	 */
	if (PG_NARGS() &gt; 2 &amp;&amp; !PG_ARGISNULL(2))
	{
		int option = PG_GETARG_INT32(2);
		output_guess_short_srid = (option &amp; 8) ? LW_TRUE : LW_FALSE;
		output_short_crs = (option &amp; 2) ? LW_TRUE : LW_FALSE;
		output_long_crs = (option &amp; 4) ? LW_TRUE : LW_FALSE;
		output_bbox = (option &amp; 1) ? LW_TRUE : LW_FALSE;
	}
	else
		output_guess_short_srid = LW_TRUE;

	if (output_guess_short_srid &amp;&amp; srid != WGS84_SRID &amp;&amp; srid != SRID_UNKNOWN)
		output_short_crs = LW_TRUE;

	if (srid != SRID_UNKNOWN &amp;&amp; (output_short_crs || output_long_crs))
	{
		srs = getSRSbySRID(srid, !output_long_crs);

		if (!srs)
		{
			elog(ERROR, "SRID %i unknown in spatial_ref_sys table", srid);
			PG_RETURN_NULL();
		}
	}

	lwgeom = lwgeom_from_gserialized(geom);
	geojson = lwgeom_to_geojson(lwgeom, srs, precision, output_bbox);
	lwgeom_free(lwgeom);

	if (srs) pfree(srs);

	result = cstring_to_text(geojson);
	lwfree(geojson);

	PG_FREE_IF_COPY(geom, 0);
	PG_RETURN_TEXT_P(result);
}

/**
 * Takes a GEOMETRY and returns a GeoJson representation
 */
char *
lwgeom_to_geojson(const LWGEOM *geom, char *srs, int precision, int has_bbox)
{
	int type = geom-&gt;type;
	GBOX *bbox = NULL;
	GBOX tmp;

	if ( precision &gt; OUT_MAX_DOUBLE_PRECISION ) precision = OUT_MAX_DOUBLE_PRECISION;

	if (has_bbox)
	{
		/* Whether these are geography or geometry,
		   the GeoJSON expects a cartesian bounding box */
		lwgeom_calculate_gbox_cartesian(geom, &amp;tmp);
		bbox = &amp;tmp;
	}

	switch (type)
	{
	case POINTTYPE:
		return asgeojson_point((LWPOINT*)geom, srs, bbox, precision);
	case LINETYPE:
		return asgeojson_line((LWLINE*)geom, srs, bbox, precision);
	case POLYGONTYPE:
		return asgeojson_poly((LWPOLY*)geom, srs, bbox, precision);
	case MULTIPOINTTYPE:
		return asgeojson_multipoint((LWMPOINT*)geom, srs, bbox, precision);
	case MULTILINETYPE:
		return asgeojson_multiline((LWMLINE*)geom, srs, bbox, precision);
	case MULTIPOLYGONTYPE:
		return asgeojson_multipolygon((LWMPOLY*)geom, srs, bbox, precision);
	case TRIANGLETYPE:
		return asgeojson_triangle((LWTRIANGLE *)geom, srs, bbox, precision);
	case TINTYPE:
	case COLLECTIONTYPE:
		return asgeojson_collection((LWCOLLECTION*)geom, srs, bbox, precision);
	default:
		lwerror("lwgeom_to_geojson: '%s' geometry type not supported",
		        lwtype_name(type));
	}

	/* Never get here */
	return NULL;
}

```

以点类型为例：

入口：

```
static char *
asgeojson_point(const LWPOINT *point, char *srs, GBOX *bbox, int precision)
{
	char *output;
	int size;

	size = asgeojson_point_size(point, srs, bbox, precision);
	output = lwalloc(size);
	asgeojson_point_buf(point, srs, output, bbox, precision);
	return output;
}

```

size计算：

```
/**
 * Point Geometry
 */
static size_t
asgeojson_point_size(const LWPOINT *point, char *srs, GBOX *bbox, int precision)
{
	int size;

	size = pointArray_geojson_size(point-&gt;point, precision);
	size += sizeof("{'type':'Point',");
	size += sizeof("'coordinates':}");

	if ( lwpoint_is_empty(point) )
		size += 2; /* [] */

	if (srs) size += asgeojson_srs_size(srs);
	if (bbox) size += asgeojson_bbox_size(FLAGS_GET_Z(point-&gt;flags), precision);

	return size;
}

/**
 * Returns maximum size of rendered pointarray in bytes.
 */
static size_t
pointArray_geojson_size(POINTARRAY *pa, int precision)
{
	assert ( precision &lt;= OUT_MAX_DOUBLE_PRECISION );
	if (FLAGS_NDIMS(pa-&gt;flags) == 2)
		return (OUT_MAX_DIGS_DOUBLE + precision + sizeof(","))
		       * 2 * pa-&gt;npoints + sizeof(",[]");

	return (OUT_MAX_DIGS_DOUBLE + precision + sizeof(",,"))
	       * 3 * pa-&gt;npoints + sizeof(",[]");
}

/**
 * Handle SRS
 */
static size_t
asgeojson_srs_size(char *srs)
{
	int size;

	size = sizeof("'crs':{'type':'name',");
	size += sizeof("'properties':{'name':''}},");
	size += strlen(srs) * sizeof(char);

	return size;
}

/**
 * Handle Bbox
 */
static size_t
asgeojson_bbox_size(int hasz, int precision)
{
	int size;

	if (!hasz)
	{
		size = sizeof("\"bbox\":[,,,],");
		size +=	2 * 2 * (OUT_MAX_DIGS_DOUBLE + precision);
	}
	else
	{
		size = sizeof("\"bbox\":[,,,,,],");
		size +=	2 * 3 * (OUT_MAX_DIGS_DOUBLE + precision);
	}

	return size;
}

```

写入数据：

```
static size_t
asgeojson_point_buf(const LWPOINT *point, char *srs, char *output, GBOX *bbox, int precision)
{
	char *ptr = output;

	ptr += sprintf(ptr, "{\"type\":\"Point\",");
	if (srs) ptr += asgeojson_srs_buf(ptr, srs);
	if (bbox) ptr += asgeojson_bbox_buf(ptr, bbox, FLAGS_GET_Z(point-&gt;flags), precision);

	ptr += sprintf(ptr, "\"coordinates\":");
	if ( lwpoint_is_empty(point) )
		ptr += sprintf(ptr, "[]");
	ptr += pointArray_to_geojson(point-&gt;point, ptr, precision);
	ptr += sprintf(ptr, "}");

	return (ptr-output);
}

static size_t
asgeojson_srs_buf(char *output, char *srs)
{
	char *ptr = output;

	ptr += sprintf(ptr, "\"crs\":{\"type\":\"name\",");
	ptr += sprintf(ptr, "\"properties\":{\"name\":\"%s\"}},", srs);

	return (ptr-output);
}

static size_t
asgeojson_bbox_buf(char *output, GBOX *bbox, int hasz, int precision)
{
	char *ptr = output;

	if (!hasz)
		ptr += sprintf(ptr, "\"bbox\":[%.*f,%.*f,%.*f,%.*f],",
		               precision, bbox-&gt;xmin, precision, bbox-&gt;ymin,
		               precision, bbox-&gt;xmax, precision, bbox-&gt;ymax);
	else
		ptr += sprintf(ptr, "\"bbox\":[%.*f,%.*f,%.*f,%.*f,%.*f,%.*f],",
		               precision, bbox-&gt;xmin, precision, bbox-&gt;ymin, precision, bbox-&gt;zmin,
		               precision, bbox-&gt;xmax, precision, bbox-&gt;ymax, precision, bbox-&gt;zmax);

	return (ptr-output);
}

static size_t
pointArray_to_geojson(POINTARRAY *pa, char *output, int precision)
{
	uint32_t i;
	char *ptr;
	char x[OUT_DOUBLE_BUFFER_SIZE];
	char y[OUT_DOUBLE_BUFFER_SIZE];
	char z[OUT_DOUBLE_BUFFER_SIZE];

	assert ( precision &lt;= OUT_MAX_DOUBLE_PRECISION );
	ptr = output;

	/* TODO: rewrite this loop to be simpler and possibly quicker */
	if (!FLAGS_GET_Z(pa-&gt;flags))
	{
		for (i=0; i&lt;pa-&gt;npoints; i++)
		{
			const POINT2D *pt;
			pt = getPoint2d_cp(pa, i);

			lwprint_double(
			    pt-&gt;x, precision, x, OUT_DOUBLE_BUFFER_SIZE);
			lwprint_double(
			    pt-&gt;y, precision, y, OUT_DOUBLE_BUFFER_SIZE);

			if ( i ) ptr += sprintf(ptr, ",");
			ptr += sprintf(ptr, "[%s,%s]", x, y);
		}
	}
	else
	{
		for (i=0; i&lt;pa-&gt;npoints; i++)
		{
			const POINT3D *pt = getPoint3d_cp(pa, i);

			lwprint_double(
			    pt-&gt;x, precision, x, OUT_DOUBLE_BUFFER_SIZE);
			lwprint_double(
			    pt-&gt;y, precision, y, OUT_DOUBLE_BUFFER_SIZE);
			lwprint_double(
			    pt-&gt;z, precision, z, OUT_DOUBLE_BUFFER_SIZE);

			if ( i ) ptr += sprintf(ptr, ",");
			ptr += sprintf(ptr, "[%s,%s,%s]", x, y, z);
		}
	}

	return (ptr-output);
}

/*
 * Print an ordinate value using at most the given number of decimal digits
 *
 * The actual number of printed decimal digits may be less than the
 * requested ones if out of significant digits.
 *
 * The function will not write more than maxsize bytes, including the
 * terminating NULL. Returns the number of bytes that would have been
 * written if there was enough space (excluding terminating NULL).
 * So a return of ``bufsize'' or more means that the string was
 * truncated and misses a terminating NULL.
 *
 */
int
lwprint_double(double d, int maxdd, char* buf, size_t bufsize)
{
	double ad = fabs(d);
	int ndd;
	int length = 0;
	if (ad &lt;= FP_TOLERANCE)
	{
		d = 0;
		ad = 0;
	}
	if (ad &lt; OUT_MAX_DOUBLE)
	{
		ndd = ad &lt; 1 ? 0 : floor(log10(ad)) + 1; /* non-decimal digits */
		if (maxdd &gt; (OUT_MAX_DOUBLE_PRECISION - ndd)) maxdd -= ndd;
		length = snprintf(buf, bufsize, "%.*f", maxdd, d);
	}
	else
	{
		length = snprintf(buf, bufsize, "%g", d);
	}
	trim_trailing_zeros(buf);
	return length;
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

需要在内置函数目录下添加ST_AsGeoJSON函数的文档说明

##   [9. TODO（遗留问题）](#9-todo遗留问题)  