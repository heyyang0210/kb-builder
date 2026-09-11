Created by 李美娥, last modified on 四月 08, 2024

# 1. 参考资料

        需求：SR:    [YDBRD-13244](https://jira.yasdb.com/browse/YDBRD-13244?src=confmacro)    -  Geometry类型支持使用R树索引  完成  AR:    [YDBRD-14354](https://jira.yasdb.com/browse/YDBRD-14354)  

        开发设计：    [Rtree 索引选择方案设计](119539801.html)  

        参考资料：     [Rtree Scan](Rtree-Scan_117671181.html)     、    [Geometry类型概要设计](/pages/createpage.action?spaceKey=YAS&title=Geometry%E7%B1%BB%E5%9E%8B%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1)     、    [Rtree设计文档](113970572.html)  

        对外提供的函数：  ST_Contains、ST_Within   、ST_Equals、ST_CoveredBy、ST_Covers、ST_Crosses、ST_Intersects、ST_Overlaps、ST_Touches

        函数目前支持的类型：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

# 2. 需求分析

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

（1）函数功能  ：  当表上filter中出现支持使用rtree的filter类型时，生成Rtree扫描算子，加入CBO的计划搜索空间数据。

（2）走到Rtree的条件：1、表类型是heap表  2、表上的geom列创建Rtree索引  3、空间关系函数的入参是表上带Rtree索引的geom，同时空间函数出现在where 、join条件里  且不能于false true进行等值比较  。4、where 、join条件里面不带其他低cost的索引（理论不会存在比Rtree耗费cost多的索引，若存在，需要单独分析）且不含其他or的列  

         条件4的细化（where或者join后的条件）：

         a、含其他列但是列上不带索引，如st_contains(col_geom, st_geomfromtext('POINT(26 26)')) and col_int <7 或者st_contains(col_geom, st_geomfromtext('POINT(26 26)')) or col_int <7,第一种会先根据col_int筛选然后再走  Rtree  索引，第二种不会走  Rtree索引。

               filter1 or filter2不走索引， filter1 and (filter1 or filter2)走索引

           b、  含  其他列且列上带的是其他类型的索引，理论是走其他索引。  --目前会根据cost算，不一定不走

         c、  含其他列且其他列含的也是  Rtree  索引，是走其他列的  Rtree还是走geom  的Rtree？，  是优先其他列的Rtree。--普通的其他列是不支持，创建的udt列呢，也不支持，不涉及

         d、表上含另外的geom列且也含Rtree索引，但是是其他gis函数去使用此列， 优先空间函数使用列的Rtree。

         e、空间函数的入参是其他gis函数处理了带Rtree索引后的geom列，是不是就不走Rtree索引–不走

         备注：如果gis的filter是join条件，那么只有nl join能走索引，但是如果是单表上的条件，filter中只用到了一个表的列，走其他join比如hashjoin也不影响走索引。（2个表，条件里面加上了2个表的其他字段进行关联，同时空间函数的参数是这2个表的列，是两个逻辑表的列，就是join，若hash join的cost比nest loop小，不会走到索引）。

         索引语法图：空间关系函数主要关注给heap表建立rtree和给分区表建立的rtree local_parttioned_index，同时会简单覆盖索引带invisable、 unusable属性时，空间关系函数不再走Rtree。  （备注：分区表仅挑选一种类型，覆盖到一级分区、二级分区，还有表类型 global temporary TABLE支持geometry列但不支持索引，其他的表类型本身不支持geometry列，故其他类型表不涉及）

（3）限制  ，view的下推的现在没做，理解成不支持就行。（变成nestloop index，需要把join条件，从join上推到单表去，但现在推到view后会停下来，因为没支持，所以推不下去，导致不走nestloop index join）

explain select /*+ INDEX(GIS_OSM_ROADS_FREE_1, OSI_14506) */ count(a.YAS_GEOMETRY ), 'tk' category    
  from    
  WORLD_COUNTRIES a left outer join    
  (    
  select

  
  "layer"-273.15 layer,YAS_GEOMETRY    
  from    
  GIS_OSM_ROADS_FREE_1    
  where    
  "osm_id" ='8365693'    
  11 )b on st_contains(a.YAS_GEOMETRY,b.YAS_GEOMETRY);

PLAN_DESCRIPTION    
  ----------------------------------------------------------------    
  SQL hash value: 2761646457    
  Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+    
  | Id | Operation type | Name | Owner | Rows | Cost(%CPU) | Partition info |    
  +----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+    
  | 0 | SELECT STATEMENT | | | | | |    
  | 1 | AGGREGATE | | | 1| 1242105( 0)| |    
  |* 2 | NESTED LOOPS LEFT OUTER | | | 163743| 1242101( 0)| |    
  | 3 | TABLE ACCESS FULL | WORLD_COUNTRIES | REGRESS | 654972| 232301( 0)| |    
  | 4 | VIEW | | | 1| 1009754( 0)| |    
  |* 5 | TABLE ACCESS FULL | GIS_OSM_ROADS_FREE_1 | REGRESS | 1| 1009754( 0)| |    
  +----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):    
  ---------------------------------------------------

2 - Predicate : filter(ST_CONTAINS("A"."YAS_GEOMETRY", "B"."YAS_GEOMETRY") BOOL)    
  5 - Predicate : filter("GIS_OSM_ROADS_FREE_1"."osm_id" = '8365693')

Hint Information :    
  ---------------------------------------------------

INDEX(GIS_OSM_ROADS_FREE_1, OSI_14506) / unresolved

24 rows fetched.



        

        filter出现的位置：where后、join on、子查询、绑定参数，where还区分delete update select（重点是select的where后、join on）。

（3）主要场景：

         1、空间函数使用带Rtree索引的geom列和一个常量作为where条件。

         2、join on是2个表的geom列，且两个表的geom都带Rtree索引或者仅一个表的geom带Rtree索引。（是2个都带，  还是一个带的是主场景，都可以，可不关注join的类型  ）

              join on是  类似这么使用：  select      a  .  col_int  ,  b  .  col_int     from     tb_YDBRD_13245_ST_Contains_14_source     a     join      tb_YDBRD_13245_ST_Contains_14_target     b     on     ST_Within  (  a  .  col_geom  ,  b  .  col_geom  )     =     false     order     by     a  .  col_int  ,     b  .  col_int     limit     5  ;

（4）并发：

（5）性能：

         1、原始数据很大，用很小的窗口通过where限定去查，查出来的是少量数据，带索引的情况要优于不带索引。（数据量、配置参数有具体要求不，暂无，  只是粗测？数据至少跨页，且二者配置参数一致即可  ）

         2、空间函数使用的是2个表列，join on作为条件，带索引的情况要优于不带索引。

         3、用大的窗口去查，查出来的是大量数据，不能比不带索引劣化太厉害。（无标准）

（6）结果验证：查询计划，验证理论走Rtree的sql语句走了Rtree索引，且跟入参顺序相关的函数，入参顺序变化时的acess不同，验证查询的结果符合预期（返回的数据跟pg比对）。

备注：带上索引后，empty间不再相等，同pg（不带索引时，empty是相等的）。多表修改带where条件，是不走rtree的。

# 3. 测试设计方法

等价类，边界值，场景分析。

# 4. 详细测试设计

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|是|
|可维护性|否|


# 5. 测试用例

测试设计细化后的文本用例

表格

[rtree索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWM4OTcwYzJhZjRmNTFmNzk0IiwicmVmX2lkIjoiNjczOTY5NWM1OTNmOTljOWZmMjM0ZGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2ODY3LCJleHAiOjE3ODIyMTMyNjd9.iGWGyfvKwTGpwG39mhwZNInbt438s4lpqj95GMQKR6I)

# 6. 测试框架设计

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# 8. 差异点记录或知识点记录

|  
|编号|问题描述|yashan|postGIS|  
|
|:---|:---|:---|:---|:---|:---|
|st_contains|1|  
,  
|1、select ST_Contains (st_geomfromtext('MULTIPOLYGON (((0 0, 0 10, 10 10, 10 0, 0 0), (2 2, 2 8, 8 8, 8 2, 2 2)), ((15 15,15 20,20 20,20 15,15 15)), ((1 1, 9 1, 9 9, 1 9, 1 1)),empty)', 4326),st_geomfromtext('MULTIPOINT ZM(1.45678 1 6 10, 1 2 3 4)', 4326)),--yanshan是false，pg是true,2、select a.col_int,b.col_int from tb_YDBRD_14354_pre_01 a, tb_YDBRD_14354_pre_02 b where ST_Contains (a.col_geom, b.col_geom);,pg会多存在506 507 508的数据|  
,  
|  
|
||2|表里面的2个是geom列，其中一个带索引，一个不带，空间关系函数里面的入参是这一张表的里面的两列，不会走算子|  
|
||3|leftjoin的filter不能下推到左边，规则是 leftouter的允许下推到右边，rightouter允许下推到左边，index nl join只能推到右边。,a left b，只允许往b推，但是用的是a的列 所以推不下去|![](https://pingcode.yasdb.com/atlas/files/public/6739695da1ad9a3311dc7616/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),explain select a.col_int,c.col_int from tb_YDBRD_22074_rtree_pre_01 a left join tb_YDBRD_22074_rtree_pre_01 c on ST_Within (a.col_geom, st_geomfromtext('MULTIPOINT(30 30, 15 15)', 4326));,![](https://pingcode.yasdb.com/atlas/files/public/6739695d8970c2af4f51f79f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),把表列得顺序变换了，也不下推。  ---不是参数位置 是表，你把a，c换个位置 改成c left join a应该就能推了|
||4|gis的谓词做不了合并，col > 2 and col > 3会自动合并成 col > 3|![](https://pingcode.yasdb.com/atlas/files/public/6739695d8970c2af4f51f7a0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),是因为我们的这个gis的常量没法比较大小是不，只要查询视图是索引内的数据，都是用索引的那个常量。若是传的常量，针对的数据不仅仅是索引能覆盖的，就会变成我传的值，是不|
||5|下推只有单表的filter能跨view推下去|语句大概怎么构造，就是走的view,![](https://pingcode.yasdb.com/atlas/files/public/6739695d8970c2af4f51f7a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),子查询作为表参与join就是view|
||6|  
|请教下啊，如何可以让查询强制走rtree啊，因为用的导入工具，里面默认建表给了其他字段加了唯一约束，这个约束还没名字，没找到办法删，所以想要查询强制走rtree，可以查询前设置是不,试试explain select /*+ index_desc(table_name index_name) */或者就index(xxxx xxxx)|
||7|  
|问题：我理解是不是咱只有整个走到nested loops，才会走我们的算子，要是算cost，本身nested loops都不是它的最优选择，那它肯定不会走到我们的索引的,--不一定。如果gis的filter是join条件（是gis的filter里面出现了两个表的列），那么只有nl join能走索引，但是如果是单表上的条件，filter中只用到了一个表的列，走其他join比如hashjoin也不影响走索引,问题：只要gis的里面出了2个表的列，都是等价了join条件，要是gis里面传的是一个表的列，传了2次，也会等价join啊，相当于这个函数的2个列来源于1个表，也是join,两个表是逻辑上的表不是物理上的表，比如你select * from t1 tt1, t1 tt2 where gis(tt1.col,tt2.col)，是Join。但是如果是 select * from t1 where gis(t1.col1,t1.col2)这种 那肯定不算join啊|
||8|动态开关打开的情况下，有时候是不走索引的，需要表的数量达到一定的标准|王泽凯 12-5 16:37:35    
  就是条数少的时候,王泽凯 12-5 16:37:39    
  如果走rtree,王泽凯 12-5 16:37:53    
  要走两边io，rtree一遍，扫描一遍,王泽凯 12-5 16:38:02    
  还不如直接扫全部数据,  
|
||9|  
|看计划的时候，rangescan一定比rtree索引好，ndex full scan和fast full scan就未必好，需要具体情况具体评估|
||  
|  
|null参与比较都是false。通过value传进去也是绑定参数，因为plsql的编译和执行不是同一时刻的。（plsql是否走索引，你可以建索引不建索引跑一下看看输出结果的顺序，和plsql输出结果对比下，无法通过计划直接看）,![](https://pingcode.yasdb.com/atlas/files/public/6739695d8970c2af4f51f7a2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),![](https://pingcode.yasdb.com/atlas/files/public/6739695da1ad9a3311dc7618/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),传字符串的才走|
||  
|  
|udt出现在jion右边可以走nestloopjoin，不能走hashjoin和mergejoin|
||10|gis是内置函数，是pif的形式，只有bif才有null ins标志位：BIF_TRAIT_NULL_INS，gis函数没有加这个标志，gis函数没有加这个标志，所以没下推 现在这个表现是正常的|explain select a.col_int from tb_YDBRD_22074_rtree_pre_01 a where a.col_int in (select b.col_int from tb_YDBRD_22074_rtree_pre_01 b where ST_contains(a.col_geom, st_geomfromtext('POLYGON((0 0,0.5 0,0.5 0.5,0 1,0 0))',4326))) order by a.col_int;    
  explain select a.col_int from tb_YDBRD_22074_rtree_pre_01 a where a.col_int in (select b.col_int from tb_YDBRD_22074_rtree_pre_01 b where ST_contains(b.col_geom, st_geomfromtext('POLYGON((0 0,0.5 0,0.5 0.5,0 1,0 0))',4326))) order by a.col_int;,![](https://pingcode.yasdb.com/atlas/files/public/6739695da1ad9a3311dc7619/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFCQUFBQUFRQUNBQUFBQUFnQVFBQUFnQWdBQWdBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFJQ0FBQUFJQUFDQUFBQUFBQUlCUUFBUWdBQUFRQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUlBQUFBR0FBQXdBQUFBQUFBZ0FBQUFBQUFBQ0FBQUNBRUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY4NjcsImV4cCI6MTc4MjEzNzY2N30.l-QS7550f9Sdrj1Xt-KXugEXlbzNymqYCbpddeGcHT4),问题：第一个不走，是因为我用的是表a的geom是不，我们要走，是要跟表在一起的，不能跳这么远|
||
||
||
||
||
||
||
||


## Attachments:

[image2023-7-11_17-47-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWM4OTcwYzJhZjRmNTFmNzk1IiwicmVmX2lkIjoiNjczOTY5NWM1OTNmOTljOWZmMjM0ZGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2ODY3LCJleHAiOjE3ODIyMTMyNjd9.dwJq4Rzo0ODxwQ-DZuq_H2AhDZVzWwPSFSLfHhTXanw)

 (image/png)    


[image2023-7-11_17-48-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWM4OTcwYzJhZjRmNTFmNzk3IiwicmVmX2lkIjoiNjczOTY5NWM1OTNmOTljOWZmMjM0ZGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2ODY3LCJleHAiOjE3ODIyMTMyNjd9.zdUSzCdy9BHfW7hEmtlnJ6M1bCfuKxfcqWmSOyQ_TlU)

 (image/png)    


[rtree索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWM4OTcwYzJhZjRmNTFmNzk5IiwicmVmX2lkIjoiNjczOTY5NWM1OTNmOTljOWZmMjM0ZGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2ODY3LCJleHAiOjE3ODIyMTMyNjd9.vN6QoRA-EUwnkY2NoSWR-28gMj2FccOQrpxMj8qP3jE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[rtree索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWM4OTcwYzJhZjRmNTFmNzk0IiwicmVmX2lkIjoiNjczOTY5NWM1OTNmOTljOWZmMjM0ZGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2ODY3LCJleHAiOjE3ODIyMTMyNjd9.iGWGyfvKwTGpwG39mhwZNInbt438s4lpqj95GMQKR6I)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
