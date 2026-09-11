Created by 胡威振, last modified on 八月 25, 2023

**SR链接：**    [YDBRD-18931](https://jira.yasdb.com/browse/YDBRD-18931?src=confmacro)    **-**  **支持ST_LineFromText、ST_GeomCollectionFromText**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_LineFromText函数的功能是：使用给定的SRID从WKT表示生成几何图形。如果没有给出SRID，则默认为0，如果传入的WKT不是LINESTRING，则返回null。
- 输入存在null则返回null。


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_LineFromText(WKT clob, srid in integer default 0);

```

- UTF


```
create or replace function MDSYS.ST_LINEFROMTEXT(wkt in clob, srid in integer default 0) return ST_GEOMETRY as
    geom ST_GEOMETRY;
    ewkb blob;
    head raw(40);
begin
    SYS.GEOMETRY.ST_GEOMFROMTEXT(wkt, srid, head, ewkb);
    if ewkb is null or SYS.GEOMETRY.GEOMETRYTYPE(head) != 'LINESTRING' then
        return null;
    end if;
    geom := new st_geometry(head, ewkb);
return geom;
end;
/

create or replace public synonym ST_LINEFROMTEXT for MDSYS.ST_LINEFROMTEXT
/

```

#   [3. Detail Design（详细设计）](#3-detail-design详细设计)  

- 主要是通过UTF来实现，内部调用的还是ST_GeomFromText函数。
- 具体规格与ST_GeomFromText生成LINESTRING的规格相同。


#   [4. Example](#4-example)  

```
SQL&gt; Select ST_AsText(ST_LineFromText('LineString Empty')) from dual;

ST_ASTEXT(ST_LINEFRO                                             
---------------------------------------------------------------- 
LINESTRING EMPTY                                                

1 row fetched.

SQL&gt; Select ST_AsText(ST_LineFromText('LineString(1 1, 3 1)'), 1) from dual;

ST_ASTEXT(ST_LINEFRO                                             
---------------------------------------------------------------- 
LINESTRING (1.0 1.0, 3.0 1.0)                                   

1 row fetched.

SQL&gt; Select ST_AsText(ST_LineFromText('Point( 3 1)'), 1) from dual;

ST_ASTEXT(ST_LINEFRO                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_LineFromText.html](https://postgis.net/docs/manual-3.3/ST_LineFromText.html)  