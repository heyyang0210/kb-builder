Created by 文博浩, last modified by  王若琳 on 四月 21, 2023

##   [1. Overview（概述）](#1-overview概述)  

从输入的GeoJSON表示形式构造几何对象。

语法：

```
ST_GeomFromGeoJson(json clob) return blob

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持GeoJSON的Geometry类型；支持Feature，与PostGIS不同（GEOS库支持）。
- 只支持2D几何图形。3D几何图形会报错，与PostGIS不同（GEOS库不支持）。
- 如果输入GeoJSON无效，则报错。
- GeoJSON字符串中可以包含bbox、crs，不检查crs的正确性。


参数类型：clob，varchar/char隐式转换成clob

返回类型：geometry

Null值：json为null返回null

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeosGSFromGeoJson()
geomFromGeoJson()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- （GEOS库）严格区分GeoJSON字符串的大小写，与PostGIS不同。
- 空坐标与非空坐标混合，GEOS库与PostGIS规格不同，报错。


```
SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[0,0]],[]]}')) from dual;
SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[],[0,0]]}')) from dual;

```

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1. json为null返回null。
1. 含有坐标为多个空    `[]`    的字符串传入GEOS会core，所以需要改写字符串。由于JSON字符串中的空格不会影响结果，所以将多余的    `[]`    用    ``    替换，达到改写JSON字符串的目的。
1. 调用GEOSGeoJSONReader_readGeometry_r函数从json转成GEOSGeometry类型。
1. GEOSGeometry为null报错。
1. 将geometry构造成blob。


PostGIS实现：调用json-c库的json_tokener_parse_ex接口将JSON格式字符串解析成JSON对象的C语言表示形式，对每个具体的geometry类型不同规则单独实现解析GeoJSON

```
LWGEOM *
lwgeom_from_geojson(const char *geojson, char **srs)
{
#ifndef HAVE_LIBJSON
	*srs = NULL;
	lwerror("You need JSON-C for lwgeom_from_geojson");
	return NULL;
#else  /* HAVE_LIBJSON */

	/* Begin to Parse json */
	json_tokener *jstok = json_tokener_new();
	json_object *poObj = json_tokener_parse_ex(jstok, geojson, -1);
	if (jstok-&gt;err != json_tokener_success)
	{
		char err[256];
		snprintf(err, 256, "%s (at offset %d)", json_tokener_error_desc(jstok-&gt;err), jstok-&gt;char_offset);
		json_tokener_free(jstok);
		json_object_put(poObj);
		lwerror(err);
		return NULL;
	}
	json_tokener_free(jstok);

	*srs = NULL;
	json_object *poObjSrs = findMemberByName(poObj, "crs");
	if (poObjSrs != NULL)
	{
		json_object *poObjSrsType = findMemberByName(poObjSrs, "type");
		if (poObjSrsType != NULL)
		{
			json_object *poObjSrsProps = findMemberByName(poObjSrs, "properties");
			if (poObjSrsProps)
			{
				json_object *poNameURL = findMemberByName(poObjSrsProps, "name");
				if (poNameURL)
				{
					const char *pszName = json_object_get_string(poNameURL);
					if (pszName)
					{
						*srs = lwalloc(strlen(pszName) + 1);
						strcpy(*srs, pszName);
					}
				}
			}
		}
	}

	int hasz = LW_FALSE;
	LWGEOM *lwgeom = parse_geojson(poObj, &amp;hasz);
	json_object_put(poObj);
	if (!lwgeom)
		return NULL;

	if (!hasz)
	{
		LWGEOM *tmp = lwgeom_force_2d(lwgeom);
		lwgeom_free(lwgeom);
		lwgeom = tmp;
	}
	lwgeom_add_bbox(lwgeom);
	return lwgeom;
#endif /* HAVE_LIBJSON */
}

static inline LWGEOM *
parse_geojson(json_object *geojson, int *hasz)
{
	json_object *type = NULL;
	const char *name;

	if (!geojson)
	{
		lwerror("invalid GeoJSON representation");
		return NULL;
	}

	type = findMemberByName(geojson, "type");
	if (!type)
	{
		lwerror("unknown GeoJSON type");
		return NULL;
	}

	name = json_object_get_string(type);

	if (strcasecmp(name, "Point") == 0)
		return parse_geojson_point(geojson, hasz);

	if (strcasecmp(name, "LineString") == 0)
		return parse_geojson_linestring(geojson, hasz);

	if (strcasecmp(name, "Polygon") == 0)
		return parse_geojson_polygon(geojson, hasz);

	if (strcasecmp(name, "MultiPoint") == 0)
		return parse_geojson_multipoint(geojson, hasz);

	if (strcasecmp(name, "MultiLineString") == 0)
		return parse_geojson_multilinestring(geojson, hasz);

	if (strcasecmp(name, "MultiPolygon") == 0)
		return parse_geojson_multipolygon(geojson, hasz);

	if (strcasecmp(name, "GeometryCollection") == 0)
		return parse_geojson_geometrycollection(geojson, hasz);

	lwerror("invalid GeoJson representation");
	return NULL; /* Never reach */
}

```

以点类型为例：

```
static inline LWGEOM *
parse_geojson_point(json_object *geojson, int *hasz)
{
	json_object *coords = parse_coordinates(geojson);
	if (!coords)
		return NULL;
	POINTARRAY *pa = ptarray_construct_empty(1, 0, 1);
	parse_geojson_coord(coords, hasz, pa);
	return (LWGEOM *)lwpoint_construct(0, NULL, pa);
}

static inline int
parse_geojson_coord(json_object *poObj, int *hasz, POINTARRAY *pa)
{
	POINT4D pt = {0, 0, 0, 0};

	if (json_object_get_type(poObj) == json_type_array)
	{
		json_object *poObjCoord = NULL;
		const int nSize = json_object_array_length(poObj);
		if (nSize == 0)
			return LW_TRUE;
		if (nSize &lt; 2)
		{
			lwerror("Too few ordinates in GeoJSON");
			return LW_FAILURE;
		}

		/* Read X coordinate */
		poObjCoord = json_object_array_get_idx(poObj, 0);
		pt.x = json_object_get_double(poObjCoord);

		/* Read Y coordinate */
		poObjCoord = json_object_array_get_idx(poObj, 1);
		pt.y = json_object_get_double(poObjCoord);

		if (nSize &gt; 2) /* should this be &gt;= 3 ? */
		{
			/* Read Z coordinate */
			poObjCoord = json_object_array_get_idx(poObj, 2);
			pt.z = json_object_get_double(poObjCoord);
			*hasz = LW_TRUE;
		}
	}
	else
	{
		/* If it's not an array, just don't handle it */
		lwerror("The 'coordinates' in GeoJSON are not sufficiently nested");
		return LW_FAILURE;
	}

	return ptarray_append_point(pa, &amp;pt, LW_TRUE);
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

需要在内置函数目录下添加ST_GeomFromGeoJSON的文档

##   [9. TODO（遗留问题）](#9-todo遗留问题)  