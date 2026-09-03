Created by 张欣, last modified on 六月 20, 2023

POSTGIS="3.3.2 3.3.2" [EXTENSION] PGSQL="150" GEOS="3.11.1-CAPI-1.17.1" PROJ="7.2.1" LIBXML="2.9.9" LIBJSON="0.12" LIBPROTOBUF="1.2.1" WAGYU="0.5.0 (Internal)" （win）

POSTGIS="3.2.5 e9106e2" [EXTENSION] PGSQL="150" GEOS="3.10.3-CAPI-1.16.1" PROJ="7.2.1" LIBXML="2.9.1" LIBJSON="0.11" TOPOLOGY (linux)

|编号|  
|yahsan|postgis|结论|
|---|---|---|---|---|
|1|geography，纬度范围超出，yashan返回nan,postgis有结果|select 205,st_length(ST_GeomFromText('LINESTRING (50 50,150   150  ,150 50)',4326)) from dual;,205 ST_LENGTH(ST_GEOMFRO     
  ------------ --------------------------     
  205   Nan,  
|postgres=# select 205,st_length('LINESTRING (50 50,150 150,150 50)'::geography) ;     
  NOTICE: Coordinate values were coerced into range [-180 -90, 180 90] for GEOGRAPHY    
  LINE 1: select 205,st_length('LINESTRING (50 50,150 150,150 50)'::ge...    
  ^    
  ?column? | st_length     
  ----------+--------------------    
  205 | 10395549.891829766    
  (1 row)|合理|
|2|geography，GEOMETRYCOLLECTION结果误差很大,postgis计算了集合中的MULTIPOLYGON，yashan没有计算|select 606,st_length(ST_GeomFromText('GEOMETRYCOLLECTION (MULTIPOLYGON( ((0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0)),( (0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0),(5 5 0, 7 5 0, 7 7 0, 5 7 0, 5 5 0) ) ,( (0 0 1, 10 0 1, 10 10 1, 0 10 1, 0 0 1),(5 5 1, 7 5 1, 7 7 1, 5 7 1, 5 5 1),(1 1 1,2 1 1, 2 2 1, 1 2 1, 1 1 1) ) ),MULTILINESTRING( (0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(1 2 3 , 4 5 6 , 7 8 9 , 10 11 12, 13 14 15) ),MULTIPOINT( 1 2 3, 5 6 7, 8 9 10, 11 12 13))',4326)) from dual;,606 ST_LENGTH(ST_GEOMFRO     
  ------------ --------------------------     
  606   3.1269577043611342E+006,select 606,st_length(ST_GeomFromText('GEOMETRYCOLLECTION (MULTILINESTRING( (0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(1 2 3 , 4 5 6 , 7 8 9 , 10 11 12, 13 14 15) ),MULTIPOINT( 1 2 3, 5 6 7, 8 9 10, 11 12 13))',4326)) from dual;,606 ST_LENGTH(ST_GEOMFRO     
  ------------ --------------------------     
  606 3.1269577043611342E+006|postgres=# select 606,st_length('GEOMETRYCOLLECTION (MULTIPOLYGON( ((0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0)),( (0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0),(5 5 0, 7 5 0, 7 7 0, 5 7 0, 5 5 0) ) ,( (0 0 1, 10 0 1, 10 10 1, 0 10 1, 0 0 1),(5 5 1, 7 5 1, 7 7 1, 5 7 1, 5 5 1),(1 1 1,2 1 1, 2 2 1, 1 2 1, 1 1 1) ) ),MULTILINESTRING( (0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(1 2 3 , 4 5 6 , 7 8 9 , 10 11 12, 13 14 15) ),MULTIPOINT( 1 2 3, 5 6 7, 8 9 10, 11 12 13))'::geography) ;     
  ?column? | st_length     
  ----------+--------------------    
  606 |   18604698.374500457,postgres=# select 606,st_length('GEOMETRYCOLLECTION (MULTILINESTRING( (0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(0 0 0, 1 1 0, 2 2 0, 3 3 0, 4 4 0),(1 2 3 , 4 5 6 , 7 8 9 , 10 11 12, 13 14 15) ),MULTIPOINT( 1 2 3, 5 6 7, 8 9 10, 11 12 13))'::geography) ;     
  ?column? | st_length     
  ----------+-------------------    
  606 | 3126957.704399592    
,  
|yashan合理,postgis不合理|
|3|同上,postgis计算集合中的POLYGON，MULTIPOLYGON不为0；yashan结果为0|select 609,st_length(ST_GeomFromText('GEOMETRYCOLLECTION (POLYGON((0 0, 1 1, 2 5, 5 3 , 4 4 , 0 0)))',4326)) from dual;,609 ST_LENGTH(ST_GEOMFRO     
  ------------ --------------------------     
  609 0,1 row fetched.,SQL> select 610,st_length(ST_GeomFromText('GEOMETRYCOLLECTION (MULTIPOLYGON( ((0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0)),( (0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0),(5 5 0, 7 5 0, 7 7 0, 5 7 0, 5 5 0) ) ,( (0 0 1, 10 0 1, 10 10 1, 0 10 1, 0 0 1),(5 5 1, 7 5 1, 7 7 1, 5 7 1, 5 5 1),(1 1 1,2 1 1, 2 2 1, 1 2 1, 1 1 1) ) ))',4326)) from dual;,610 ST_LENGTH(ST_GEOMFRO     
  ------------ --------------------------     
  610 0|postgres=# select 609,st_length('GEOMETRYCOLLECTION (POLYGON(( 0 0, 1 1, 2 5, 5 3 , 4 4 , 0 0)))'::geography) ; ?column? | st_length     
  ----------+--------------------    
  609 | 1796945.8971202194    
  (1 row),postgres=#     
  postgres=# select 610,st_length('GEOMETRYCOLLECTION (MULTIPOLYGON( ((0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0)),( (0 0 0, 10 0 0, 10 10 0, 0 10 0, 0 0 0),(5 5 0, 7 5 0, 7 7 0, 5 7 0, 5 5 0) ) ,( (0 0 1, 10 0 1, 10 10 1, 0 10 1, 0 0 1),(5 5 1, 7 5 1, 7 7 1, 5 7 1, 5 5 1),(1 1 1,2 1 1, 2 2 1, 1 2 1, 1 1 1) ) ))'::geography) ;     
  ?column? | st_length     
  ----------+--------------------    
  610 | 15477740.670100864|  
|
|4|误差结果在小数点后7~9位|select id,st_length(ST_GeomFromText(col1,4326)) from tb_length_data_02 order by id;,![](https://pingcode.yasdb.com/atlas/files/public/6739694b8970c2af4f51f719/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY1ODAsImV4cCI6MTc4MjEzNzM4MH0.GjyVjYsSYLZ9wqo2b2dFd3hZhyS957_g03HLXI88eKw)|select id,st_length(col1::geography) from tb_length_data_03 order by id;|正常范围|
|5|类似1，geography，纬度范围超出，误差较大|select 211,st_length(ST_GeomFromText('LINESTRING ( -1 -2 -3, 5.4 6.6 7.77, -5.4 -6.6 -7.77, 1e6 1e-6   -1e6  , -1.3e-6 -1.4e-5 0)',4480)) from dual;,211 ST_LENGTH(ST_GEOMFRO     
  ------------ --------------------------     
  211   2.0298164850774731E+007|postgres=# select 211,st_length(ST_GeomFromText('LINESTRING ( -1 -2 -3, 5.4 6.6 7.77, -5.4 -6.6 -7.77, 1e6 1e-6 -1e6, -1.3e-6 -1.4e-5 0)',4480)::geography) ;     
  NOTICE: Coordinate values were coerced into range [-180 -90, 180 90] for GEOGRAPHY    
  ?column? | st_length     
  ----------+--------------------    
  211 |   20414043.721041676|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


## Attachments: