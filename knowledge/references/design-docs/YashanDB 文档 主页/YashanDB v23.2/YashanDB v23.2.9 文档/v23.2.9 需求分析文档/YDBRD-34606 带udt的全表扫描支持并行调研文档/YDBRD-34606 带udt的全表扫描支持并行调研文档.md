# 1. 总述

postgis空间函数的查询支持并行，并行性能相较于非并行性能会提升将近两倍。

本文档调研了postgis对geometry类型支持并行的情况，包括gis普通函数并行、gis聚合函数并行、空间索引的并行支持情况。

# 2. 基本信息

## 2.1 表信息：

```
postgres=# \d base_lineloop;
                    Table "public.base_lineloop"
  Column   |          Type          | Collation | Nullable | Default 
-----------+------------------------+-----------+----------+---------
 OID       | character varying(50)  |           |          | 
 LINE_NAME | character varying(200) |           |          | 
 GEOM      | geometry               |           |          | 
 ID        | bigint                 |           | not null | 
Indexes:
    "rt1" gist ("GEOM")
    
postgres=# select count(*) from base_lineloop;
 count 
-------
 95198
(1 row)

```

## 2.2 开关并行与建索引语句

```
-- max_parallel_workers_per_gather: 控制每个并行操作中，最多可以使用多少个并行工作进程。将此值设置为一个较大的数字，以增加并行度。
-- parallel_setup_cost: 设置执行并行查询时的成本阈值。如果并行化的开销低于此值，查询优化器将倾向于使用并行执行。将其降低，可以强制查询使用并行执行，即使数据量不是特别大。
-- parallel_tuple_cost: 这个参数决定了每个处理元组的并行成本。减小此值可以促使查询优化器更倾向于并行化。
-- work_mem: 调整work_mem（每个并行工作进程使用的内存）也可以影响并行执行的决策。如果内存设置过小，PostgreSQL可能会避免并行执行。
-- max_parallel_workers: 这个参数控制了数据库系统中可用的并行工作进程的总数。确保它设置为足够高，以便有足够的资源来支持并行执行。

-- 关闭并行
set max_parallel_workers_per_gather=0;
-- 开启8并行
set max_parallel_workers_per_gather=8;

create index rt1 on base_lineloop using gist("GEOM");
drop index rt1;

explain analyse select st_astext("GEOM") from base_lineloop; 
```

# 3. GIS普通函数支持并行

|**函数**|**SQL**|
|---|---|
|ST_GeomFromText||
|ST_GeomFromWKB/ST_GeomFromEWKB||
|ST_GeomFromGeoJson||
|ST_LineFromText/ST_GeomCollectionFromText||
|ST_AsText|```
postgres=# explain analyse select st_astext("GEOM") from base_lineloop;
                                                             QUERY PLAN                                                             
------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..82384.54 rows=95198 width=32) (actual time=0.157..33.576 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..71864.74 rows=55999 width=32) (actual time=0.043..21.207 rows=47599 loops=2)
 Planning Time: 0.036 ms
 Execution Time: 35.530 ms
```|
|ST_AsBinary/ST_AsEWKB|```
postgres=# explain analyse select st_asbinary("GEOM") from base_lineloop;
                                                            QUERY PLAN                                                             
-----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=32) (actual time=0.181..21.520 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=32) (actual time=0.034..10.063 rows=47599 loops=2)
 Planning Time: 0.035 ms
 Execution Time: 23.378 ms

postgres=# explain analyse select st_asEwkb("GEOM") from base_lineloop;
                                                            QUERY PLAN                                                             
-----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=32) (actual time=0.185..22.563 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=32) (actual time=0.037..10.572 rows=47599 loops=2)
 Planning Time: 0.038 ms
 Execution Time: 24.418 ms
```|
|ST_AsGeoJson|```
postgres=# explain analyse select st_asgeojson("GEOM") from base_lineloop;
                                                             QUERY PLAN                                                             
------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..82384.54 rows=95198 width=32) (actual time=2.974..58.117 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..71864.74 rows=55999 width=32) (actual time=1.432..22.884 rows=47599 loops=2)
 Planning Time: 0.035 ms
 Execution Time: 77.795 ms
```|
|ST_AsHexEWKB|```
postgres=# explain analyse select st_ashexewkb("GEOM") from base_lineloop;
                                                            QUERY PLAN                                                             
-----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=32) (actual time=0.190..25.402 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=32) (actual time=0.029..13.286 rows=47599 loops=2)
 Planning Time: 0.038 ms
 Execution Time: 27.242 ms
```|
|ST_AsLatLonText|```
postgres=# explain analyse select st_aslatlontext("GEOM") from base_lineloop where geometryType("GEOM")='POINT';
                                                         QUERY PLAN                                                         
----------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2182.46 rows=476 width=32) (actual time=10.776..11.835 rows=0 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2180.98 rows=280 width=32) (actual time=4.493..4.494 rows=0 loops=2)
         Filter: (geometrytype("GEOM") = 'POINT'::text)
         Rows Removed by Filter: 47599
 Planning Time: 0.044 ms
 Execution Time: 11.854 ms
```|
|ST_IsValid/ST_IsEmpty/ST_IsSimple|```
postgres=# explain analyse select st_isvalid("GEOM") from base_lineloop;
                                                              QUERY PLAN                                                               
---------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=1) (actual time=69.238..200.158 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=1) (actual time=56.219..114.233 rows=47599 loops=2)
 Planning Time: 0.040 ms
 Execution Time: 202.051 ms
 
postgres=# explain analyse select st_isempty("GEOM") from base_lineloop;
                                                           QUERY PLAN                                                            
---------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=1) (actual time=0.177..16.372 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=1) (actual time=0.026..5.392 rows=47599 loops=2)
 Planning Time: 0.035 ms
 Execution Time: 18.270 ms

 postgres=# explain analyse select st_issimple("GEOM") from base_lineloop;
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..82384.54 rows=95198 width=1) (actual time=148.847..190.398 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..71864.74 rows=55999 width=1) (actual time=143.379..176.257 rows=47599 loops=2)
 Planning Time: 0.033 ms
 Execution Time: 192.735 ms
```|
|ST_X/ST_Y|```
postgres=# explain analyse select st_x("GEOM") from base_lineloop where geometrytype("GEOM") = 'point';
                                                        QUERY PLAN                                                         
---------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2148.16 rows=476 width=8) (actual time=10.431..11.329 rows=0 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2146.68 rows=280 width=8) (actual time=4.547..4.547 rows=0 loops=2)
         Filter: (geometrytype("GEOM") = 'point'::text)
         Rows Removed by Filter: 47599
 Planning Time: 0.045 ms
 Execution Time: 11.346 ms

postgres=# explain analyse select st_y("GEOM") from base_lineloop where geometrytype("GEOM") = 'point';
                                                        QUERY PLAN                                                         
---------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2148.16 rows=476 width=8) (actual time=9.879..10.761 rows=0 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2146.68 rows=280 width=8) (actual time=4.550..4.550 rows=0 loops=2)
         Filter: (geometrytype("GEOM") = 'point'::text)
         Rows Removed by Filter: 47599
 Planning Time: 0.054 ms
 Execution Time: 10.780 ms
```|
|ST_MakeLine/ST_MakePoint/ST_Point/ST_PointZ/ST_Polygon|```
postgres=# explain analyse select st_makeline("GEOM") from base_lineloop where geometrytype("GEOM") = 'point';
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Aggregate  (cost=2208.21..2208.22 rows=1 width=32) (actual time=10.622..11.539 rows=1 loops=1)
   ->  Gather  (cost=1.00..2147.46 rows=476 width=59) (actual time=10.619..11.535 rows=0 loops=1)
         Workers Planned: 1
         Workers Launched: 1
         ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2145.98 rows=280 width=59) (actual time=4.730..4.730 rows=0 loops=2)
               Filter: (geometrytype("GEOM") = 'point'::text)
               Rows Removed by Filter: 47599
 Planning Time: 0.049 ms
 Execution Time: 11.590 ms

 postgres=# explain analyse select st_makepoint("ID", "ID") from base_lineloop;
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..9242.06 rows=95198 width=32) (actual time=0.169..19.734 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..9145.86 rows=55999 width=32) (actual time=0.025..7.942 rows=47599 loops=2)
 Planning Time: 0.037 ms
 Execution Time: 21.665 ms

 postgres=# explain analyse select st_point("ID", "ID") from base_lineloop;
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..9242.06 rows=95198 width=32) (actual time=0.200..19.075 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..9145.86 rows=55999 width=32) (actual time=0.019..7.677 rows=47599 loops=2)
 Planning Time: 0.035 ms
 Execution Time: 20.928 ms

 postgres=# explain analyse select st_pointz("ID", "ID", "ID") from base_lineloop;
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..9382.05 rows=95198 width=32) (actual time=0.174..19.199 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..9285.86 rows=55999 width=32) (actual time=0.028..7.936 rows=47599 loops=2)
 Planning Time: 0.039 ms
 Execution Time: 21.067 ms

postgres=# explain analyse select st_polygon("GEOM", 4326) from base_lineloop where "ID" < 10;
                                                        QUERY PLAN                                                        
--------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2007.76 rows=10 width=32) (actual time=10.514..11.447 rows=0 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2006.75 rows=6 width=32) (actual time=2.750..2.750 rows=0 loops=2)
         Filter: ("ID" < 10)
         Rows Removed by Filter: 47599
 Planning Time: 0.106 ms
 Execution Time: 11.464 ms
```|
|ST_Buffer/ST_GeometricMedian/ST_Simplify|```
postgres=# explain analyse select st_buffer("GEOM", 10) from base_lineloop;
                                                               QUERY PLAN                                                               
----------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=34.570..925.083 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=24.964..848.850 rows=47599 loops=2)
 Planning Time: 25.040 ms
 Execution Time: 929.159 ms

postgres=# explain analyse select ST_GeometricMedian("GEOM", 10) from base_lineloop where geometrytype("GEOM") = 'point';
                                                         QUERY PLAN                                                         
----------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..10193.58 rows=476 width=32) (actual time=11.727..13.257 rows=0 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..9145.98 rows=280 width=32) (actual time=5.116..5.116 rows=0 loops=2)
         Filter: (geometrytype("GEOM") = 'point'::text)
         Rows Removed by Filter: 47599
 Planning Time: 0.051 ms
 Execution Time: 13.278 ms

postgres=# explain analyse select ST_Simplify("GEOM", 10) from base_lineloop;
                                                            QUERY PLAN                                                             
-----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=32) (actual time=0.203..21.845 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=32) (actual time=0.028..10.207 rows=47599 loops=2)
 Planning Time: 0.045 ms
 Execution Time: 23.730 ms
```|
|ST_ShortestLine/ST_MaxDistance/ST_LongestLine/ST_ClosestPoint/ST_Area|```
postgres=# explain analyse select ST_ShortestLine("GEOM", "GEOM") from base_lineloop;
                                                             QUERY PLAN                                                              
-------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..82384.54 rows=95198 width=32) (actual time=44.352..83.032 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..71864.74 rows=55999 width=32) (actual time=22.127..48.573 rows=47599 loops=2)
 Planning Time: 0.036 ms
 Execution Time: 84.923 ms

postgres=# explain analyse select ST_MaxDistance("GEOM", "GEOM") from base_lineloop;
                                                             QUERY PLAN                                                              
-------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..2882334.54 rows=95198 width=8) (actual time=0.577..95.577 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2871814.74 rows=55999 width=8) (actual time=0.263..82.623 rows=47599 loops=2)
 Planning Time: 22.475 ms
 Execution Time: 111.660 ms

postgres=# explain analyse select ST_LongestLine("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..2882334.54 rows=95198 width=32) (actual time=0.181..104.337 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2871814.74 rows=55999 width=32) (actual time=0.054..91.167 rows=47599 loops=2)
 Planning Time: 0.061 ms
 Execution Time: 106.291 ms

postgres=# explain analyse select ST_ClosestPoint("GEOM", "GEOM") from base_lineloop;
                                                             QUERY PLAN                                                             
------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..82384.54 rows=95198 width=32) (actual time=0.156..35.107 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..71864.74 rows=55999 width=32) (actual time=0.022..22.740 rows=47599 loops=2)
 Planning Time: 0.061 ms
 Execution Time: 37.042 ms

postgres=# explain analyse select ST_Area("GEOM") from base_lineloop;
                                                           QUERY PLAN                                                            
---------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=8) (actual time=0.196..20.785 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=8) (actual time=0.023..9.119 rows=47599 loops=2)
 Planning Time: 0.037 ms
 Execution Time: 22.675 ms
```|
|ST_Distance/ST_Length|```
postgres=# explain analyse select ST_Distance("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=8) (actual time=0.147..188.485 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=8) (actual time=0.019..150.674 rows=47599 loops=2)
 Planning Time: 0.034 ms
 Execution Time: 190.418 ms

postgres=# explain analyse select ST_Length("GEOM") from base_lineloop;
                                                           QUERY PLAN                                                            
---------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=8) (actual time=0.180..21.051 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=8) (actual time=0.029..9.313 rows=47599 loops=2)
 Planning Time: 0.046 ms
 Execution Time: 22.907 ms
```|
|ST_SetSRID|```
postgres=# explain analyse select ST_SetSRID("GEOM", 4327) from base_lineloop;
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2102.18 rows=95198 width=32) (actual time=0.173..16.624 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2005.99 rows=55999 width=32) (actual time=0.021..5.144 rows=47599 loops=2)
 Planning Time: 0.035 ms
 Execution Time: 18.539 ms
```|
|ST_SRID|```
postgres=# explain analyse select ST_SRID("GEOM") from base_lineloop;
                                                           QUERY PLAN                                                            
---------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2102.18 rows=95198 width=4) (actual time=0.193..16.424 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2005.99 rows=55999 width=4) (actual time=0.025..5.392 rows=47599 loops=2)
 Planning Time: 0.036 ms
 Execution Time: 18.344 ms
```|
|ST_Transform|```
postgres=# explain analyse select ST_Transform("GEOM", 4327) from base_lineloop;
                                                                QUERY PLAN                                                                 
-------------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=1348.014..1534.901 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=1339.445..1511.727 rows=47599 loops=2)
 Planning Time: 0.040 ms
 Execution Time: 1566.107 ms
```|
|ST_ClipByBox2D/ST_Difference/ST_Intersection/ST_Union|```
postgres=# explain analyse select ST_ClipByBox2D("GEOM", "GEOM") from base_lineloop;
                                                             QUERY PLAN                                                             
------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..89384.41 rows=95198 width=32) (actual time=0.533..116.086 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..78864.61 rows=55999 width=32) (actual time=0.250..79.146 rows=47599 loops=2)
 Planning Time: 0.038 ms
 Execution Time: 118.567 ms

postgres=# explain analyse select ST_Difference("GEOM", "GEOM") from base_lineloop;
                                                               QUERY PLAN                                                               
----------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=44.380..328.056 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=22.175..290.173 rows=47599 loops=2)
 Planning Time: 0.087 ms
 Execution Time: 330.994 ms

postgres=# explain analyse select ST_Intersection("GEOM", "GEOM") from base_lineloop;
                                                               QUERY PLAN                                                               
----------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=26.730..351.314 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=21.302..334.766 rows=47599 loops=2)
 Planning Time: 0.063 ms
 Execution Time: 354.506 ms

postgres=# explain analyse select ST_Union("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                               
---------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=0.196..301.321 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=0.100..285.810 rows=47599 loops=2)
 Planning Time: 0.045 ms
 Execution Time: 304.023 ms

```|
|GeometryType/ST_Boundary/ST_Envelope/ST_GeometryType|```
postgres=# explain analyse select GeometryType("GEOM") from base_lineloop;
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2102.18 rows=95198 width=32) (actual time=0.149..17.198 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2005.99 rows=55999 width=32) (actual time=0.012..5.915 rows=47599 loops=2)
 Planning Time: 0.037 ms
 Execution Time: 19.081 ms
 
postgres=# explain analyse select ST_Boundary("GEOM") from base_lineloop;
                                                             QUERY PLAN                                                             
------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..82384.54 rows=95198 width=32) (actual time=0.178..41.280 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..71864.74 rows=55999 width=32) (actual time=0.031..28.493 rows=47599 loops=2)
 Planning Time: 0.036 ms
 Execution Time: 68.535 ms

postgres=# explain analyse select ST_Envelope("GEOM") from base_lineloop;
                                                            QUERY PLAN                                                             
-----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=32) (actual time=0.192..30.264 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=32) (actual time=0.037..17.461 rows=47599 loops=2)
 Planning Time: 0.040 ms
 Execution Time: 32.168 ms

postgres=# explain analyse select ST_GeometryType("GEOM") from base_lineloop;
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..2102.18 rows=95198 width=32) (actual time=0.185..18.030 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..2005.99 rows=55999 width=32) (actual time=0.029..6.691 rows=47599 loops=2)
 Planning Time: 0.036 ms
 Execution Time: 19.928 ms
```|
|ST_Contains/ST_CoveredBy/ST_Covers/ST_Crosses/ST_Disjoint/ST_Equals/ST_Intersects/ST_Overlaps/ST_Touches/ST_Within/ST_Relate|```
postgres=# explain analyse select ST_Contains("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=1) (actual time=0.514..276.436 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=1) (actual time=0.238..262.272 rows=47599 loops=2)
 Planning Time: 0.037 ms
 Execution Time: 279.870 ms

postgres=# explain analyse select "ID" from base_lineloop where  ST_Contains("GEOM", "GEOM");
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1402837.58 rows=10 width=8) (actual time=0.221..273.933 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401836.58 rows=6 width=8) (actual time=0.087..259.228 rows=47599 loops=2)
         Filter: st_contains("GEOM", "GEOM")
 Planning Time: 0.415 ms
 Execution Time: 277.371 ms

postgres=# explain analyse select ST_Relate("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                               
---------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=0.191..258.262 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=0.085..244.027 rows=47599 loops=2)
 Planning Time: 0.033 ms
 Execution Time: 261.055 ms

```|
|ST_ContainsProperly|```
postgres=# explain analyse select ST_ContainsProperly("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=1) (actual time=0.185..278.823 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=1) (actual time=0.084..264.778 rows=47599 loops=2)
 Planning Time: 0.063 ms
 Execution Time: 282.170 ms
```|
|ST_DWithin|```
postgres=# explain analyse select ST_DWithin("GEOM", "GEOM", 10) from base_lineloop;
                                                             QUERY PLAN                                                              
-------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=1) (actual time=0.202..30.012 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=1) (actual time=0.047..17.893 rows=47599 loops=2)
 Planning Time: 0.053 ms
 Execution Time: 31.985 ms
```|
|ST_Collect|```
postgres=# explain analyse select ST_Collect("GEOM", "GEOM") from base_lineloop;
                                                            QUERY PLAN                                                             
-----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1.00..8962.06 rows=95198 width=32) (actual time=0.178..34.711 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..8865.86 rows=55999 width=32) (actual time=0.035..22.372 rows=47599 loops=2)
 Planning Time: 0.036 ms
 Execution Time: 36.578 ms
```|


# 4. GIS聚合函数支持并行

|**函数**|**SQL**|
|---|---|
|ST_Collect|```
postgres=# explain analyse select ST_Collect("GEOM") from base_lineloop;
                                                               QUERY PLAN                                                               
----------------------------------------------------------------------------------------------------------------------------------------
 Aggregate  (cost=13863.19..13863.20 rows=1 width=32) (actual time=101.509..101.566 rows=1 loops=1)
   ->  Gather  (cost=1.00..1962.19 rows=95198 width=59) (actual time=0.181..11.431 rows=95198 loops=1)
         Workers Planned: 1
         Workers Launched: 1
         ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1865.99 rows=55999 width=59) (actual time=0.020..4.153 rows=47599 loops=2)
 Planning Time: 0.039 ms
 Execution Time: 104.042 ms
```|
|ST_Extent|```
postgres=# explain analyse select ST_Extent("GEOM") from base_lineloop;
                                                                  QUERY PLAN                                                                  
----------------------------------------------------------------------------------------------------------------------------------------------
 Finalize Aggregate  (cost=9866.22..9866.23 rows=1 width=65) (actual time=72.292..72.344 rows=1 loops=1)
   ->  Gather  (cost=9865.86..9865.97 rows=1 width=52) (actual time=57.386..58.215 rows=2 loops=1)
         Workers Planned: 1
         Workers Launched: 1
         ->  Partial Aggregate  (cost=8865.86..8865.87 rows=1 width=52) (actual time=17.533..17.535 rows=1 loops=2)
               ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1865.99 rows=55999 width=59) (actual time=0.016..2.504 rows=47599 loops=2)
 Planning Time: 0.072 ms
 Execution Time: 72.372 ms
```|


# 5. 空间索引与并行

通过测试发现，空间索引与并行不会很容易同时出现，但也是支持同时使用的。

|函数|SQL|
|---|---|
|ST_Contains/ST_CoveredBy/ST_Covers/ST_Crosses/ST_Equals/ST_Intersects/ST_Overlaps/ST_Touches/ST_Within/ST_ContainsProperly/ST_DWithin|```
postgres=# explain analyse select ST_Contains("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=1) (actual time=0.514..276.436 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=1) (actual time=0.238..262.272 rows=47599 loops=2)
 Planning Time: 0.037 ms
 Execution Time: 279.870 ms

postgres=# explain analyse select "ID" from base_lineloop where  ST_Contains("GEOM", "GEOM");
                                                            QUERY PLAN                                                            
----------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1402837.58 rows=10 width=8) (actual time=0.221..273.933 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401836.58 rows=6 width=8) (actual time=0.087..259.228 rows=47599 loops=2)
         Filter: st_contains("GEOM", "GEOM")
 Planning Time: 0.415 ms
 Execution Time: 277.371 ms

postgres=# explain analyse select ST_Relate("GEOM", "GEOM") from base_lineloop;
                                                              QUERY PLAN                                                               
---------------------------------------------------------------------------------------------------------------------------------------
 Gather  (cost=1000.00..1412360.79 rows=95198 width=32) (actual time=0.191..258.262 rows=95198 loops=1)
   Workers Planned: 1
   Workers Launched: 1
   ->  Parallel Seq Scan on base_lineloop  (cost=0.00..1401840.99 rows=55999 width=32) (actual time=0.085..244.027 rows=47599 loops=2)
 Planning Time: 0.033 ms
 Execution Time: 261.055 ms

```|


