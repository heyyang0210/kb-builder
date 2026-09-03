Created by 李凯峰, last modified on 十二月 19, 2023

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR:  [https://pingcode.yasdb.com/pjm/items/67186487e489dd0868fcba18?](https://pingcode.yasdb.com/pjm/items/67186487e489dd0868fcba18?)  

#YDBRD-34606 带udt的全表扫描支持并行

设计文档：  [(3998) YDBRD-34606 带udt的全表扫描支持并行设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673ae516593f99c9ff265e43)  

调研文档：  [(3998) YDBRD-34606 带udt的全表扫描支持并行调研文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/HUWEIZHEN/pages/673c4a2a728206efb9323eb7)  

# 2. 需求分析

## 2.1 功能点分析

- udt支持全表扫描，功能不变，性能对齐PG


## 2.2 应用场景

- 全量的GIS函数
- udt类型的并行


## 2.3 规格约束

- 暂不支持聚合函数与空间索引的并行


# 3. 详细测试设计

## 3.1 测试设计方法

根据需求主要采用：

等价类、边界值、场景法、错误推测法编写测试设计

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|测试项||测试点|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|部署模式||单机|||||
|表类型||heap|分区表,非分区表||||
|功能||GIS函数、udt类型开启并行测试|打开并行参数跑上车即可||||
|||计划|看护并行计划，打开并行正常走并行|挑选部分函数看护计划|空间索引、聚合函数不走并行||
|||函数组合测试||跟gis函数嵌套，主要测试性能|||
|||验收现网问题||1.上车CI,2.验收现网GIS函数性能问题|||
|性能（详细文档测试后出一个性能测试文档）||数据类型覆盖|1）POINT (1 2)：表示地理信息中的一个点,2）LINESTRING (1 2,4 5) 线由连续的字段组成，两点定义一个线,3）POLYGON ((1 0,1 1,2 2,1 0),(0 0,6 6,8 8,0 0)) 多边形是由外环（闭合的LINESTRING）及0条或多条内环（闭环的LINESTRING）组成,4）MULTIPOINT ((1 1),(2 2)) 表示点的集合,5）MULTILINESTRING ((1 2,4 5),(2 3,5 6)) 表示线的集合,6）MULTIPOLYGON (((1 5, 4 3, 6 6, 2 6, 1 5)), ((6 5, 8 8, 6 9, 6 5))) 多边形的集合,7）GEOMETRYCOLLECTION (POINT (1 0),LINESTRING (1 2,4 5))  由不同的ST_GEOMETRY子类型组成一个集合||||
|||数据构造||沿用之前测试GIS性能的数据，测试报告列出来测试了哪些数据类型，哪些没测到|||
|||语法覆盖|1）投影列,2）filter中|性能测试报告中体现测试了哪些函数，没测到的补一下用例|||
|||并行数大小||2、4、8并行测试（大于8并行的挑选测试）|||
|||对比PG并行与yashan并行的性能差距，追平PG|yashan支持的全部GIS函数|参数设置问题：,PG：,1.并行参数,2.内存配置：配置足够大小,yashan：,1.并行数,2.内存配置：配置足够大小,配置参数：,通过视图查有没有产生IO|空间索引函数、聚合函数不支持并行||
|||对比yashan不开并行与打开并行的性能提升|yashan支持的全部GIS函数||空间索引函数、聚合函数不支持并行||
|GIS函数覆盖：|||覆盖全量GIS函数，测试对比性能：||空间索引、聚合函数不支持并行||
|||GEOMETRYTYPE：返回输入的geometry类型||空间索引、聚合函数测试计划无问题就行了|||
|||ST_AREA ：计算geometry的面积|||||
|||ST_ASBINARY ：根据输入的geometry返回wkb数据|||||
|||ST_ASEWKB：根据输入的geometry返回wkb表示|||||
|||ST_ASEWKB：根据输入的geometry返回EWKB表示|||||
|||ST_ASGEOJSON ：根据输入的geometry返回该geometry的GeoJSON表示|||||
|||ST_ASHEXEWKB：根据给输入的geometry返回该geometry的hexewkb|||||
|||ST_ASLATLONTEXT ：根据输入的geometry，返回该geometry在经纬度投影中的度、分、秒表示形式|||||
|||ST_ASTEXT：根据输入的geometry（box2d）和maxdecimaldigits返回该geometry（box2d对应geometry）的WKT|||||
|||ST_BOUNDARY ：计算输入的geometry的组合边界，返回值为ST_GEOMETRY类型数据|||||
|||ST_BUFFER:返回一个ST_GEOMETRY类型数据，该数据覆盖从输入的geometry到给定的距离width内的所有点|||||
|||ST_BUILDAREA:函数用于将输入的geometry中的线条组合成一个多边形|||||
|||ST_CLIPBYBOX2D:函数返回geometry1中由geometry2计算出的矩形裁剪框裁剪后的几何图形|||||
|||ST_CLOSESTPOINT:函数根据输入的geometry1和geometry2，返回geometry1上最接近geometry2的2D点|||||
|||ST_COLLECT:函数的功能是对输入的一组geometry进行聚合，根据该组geometry是否具有相同或不同的类型，生成一个GEOMETRYCOLLECTION或MULTI*的geometry|||聚合函数不支持并行||
|||ST_CONCAVEHULL：函数用于计算一个Geometry对象的凹包。凹包指可以覆盖输入的几何对象所有顶点的一个几何对象，该几何对象一般为一个凹多边形|||||
|||ST_CONTAINS：函数的功能是判断geometry1是否包含geometry2，包含时返回TRUE，否则返回FALSE|||||
|||ST_CONTAINSPROPERLY：函数的功能是判断geometry1是否完全包含geometry2，完全包含时返回TRUE，否则返回FALSE|||||
|||ST_COVEREDBY：函数的功能是判断geometry2是否覆盖geometry1，即如果geometry1中没有点位于geometry2之外，则返回TRUE，否则返回FALSE|||||
|||ST_COVERS：函数的功能是判断geometry1是否覆盖geometry2，即如果geometry2中没有点位于geometry1之外，则返回TRUE，否则返回FALSE|||||
|||ST_CROSSES：函数的功能是判断两个Geometry是否有部分（非全部）相同的内点|||||
|||ST_DIFFERENCE：函数返回包含geometry1但不包含geometry2几何图形，返回值为ST_GEOMETRY类型数据|||||
|||ST_DISJOINT：函数的功能是判断两个Geometry是否不相交（无共同点），如不相交则返回TRUE，否则返回FALSE|||||
|||ST_DISTANCE函数根据输入的geometry1和geometry2，返回它们对应的距离数据|||||
|||ST_DUMP：函数用于返回输入的Geometry对象的所有原子类型（Point、LineString、Polygon）及访问路径|||||
|||ST_DWITHIN：函数的功能是判断geometry1与geometry2是否在给定的距离distance内，如果在distance内则返回TRUE，否则返回FALSE|||||
|||ST_ENVELOPE：函数用于计算输入的geometry的最小外包矩形，返回值为ST_GEOMETRY类型数据|||||
|||ST_EQUALS：函数的功能是判断两个Geometry是否包含同一组点，即给定的两个Geometry“空间相等”，相等则返回TRUE，否则返回FALSE,ST_EXTENT：函数的功能是返回一个包围一组geometry的二维边界框，是一个聚合函数，返回类型是BOX2D|||||
|||ST_GEOMCOLLFROMTEXT：函数根据给定的wkt（Well-Known Text）和srid返回一个ST_GEOMETRY类型数据，如果传入的WKT不是GEOMETRYCOLLECTION，则返回NULL|||||
|||ST_GEOMETRICMEDIAN：函数的功能是使用Weiszfeld算法计算MULTIPOINT数据的几何中位数。最终会返回一个POINT数据，该POINT到MULTIPOINT的所有POINT的距离之和是最小的|||||
|||ST_GEOMETRYTYPE：函数用于打印输入的geometry的类型|||||
|||ST_GEOMFROMEWKB：函数根据给定的ewkb（Extended Well-Known Binary）返回一个ST_GEOMETRY类型的数据|||||
|||ST_GEOMFROMEWKB：函数根据给定的ewkb（Extended Well-Known Binary）返回一个ST_GEOMETRY类型的数据|||||
|||ST_GEOMFROMGEOJSON：函数根据输入的geojson，返回该geojson对应的ST_GEOMETRY类型数据。只支持二维几何图形，三维几何图形会报错|||||
|||ST_GEOMFROMTEXT：（同名函数ST_GEOMETRYFROMTEXT）函数根据给定的wkt（Well-Known Text）和srid返回一个ST_GEOMETRY类型数据|||||
|||ST_GEOMFROMWKB：函数根据给定的wkb（Well-Known Binary）和srid返回一个ST_GEOMETRY类型数据|||||
|||ST_INTERSECTION：函数返回两个geometry对象的交集，返回值为ST_GEOMETRY类型数据|||||
|||ST_INTERSECTS：函数的功能是判断两个Geometry是否相交（即至少有一个共同点），如相交则返回TRUE，否则返回FALSE|||||
|||ST_ISCLOSED：函数用于判断线的首、尾两个点是否重合，通常用于判断LineString的首尾是否闭合|||||
|||ST_ISEMPTY函数根据输入的geometry，返回该geometry是否为空，即EMPTY，如该geometry均为EMPTY，则返回TRUE，否则返回FALSE|||||
|||ST_ISSIMPLE：函数根据输入的geometry，返回该geometry是否简单，如该geometry符合简单定义，则返回TRUE，否则返回FALSE|||||
|||ST_ISVALID函数根据输入的geometry，返回该geometry是否有效，如该geometry是有效的，则返回TRUE，否则返回FALSE|||||
|||ST_LENGTH函数根据输入的geometry，返回对应的长度数据|||||
|||ST_LINEFROMTEXT函数根据给定的wkt（Well-Known Text）和srid返回一个ST_GEOMETRY类型数据，如果传入的WKT不是LINESTRING，则返回NULL|||||
|||ST_LINEMERGE函数用于将输入的MultiLineString中的线组合成一个LineString或MultiLineString|||||
|||ST_LONGESTLINE函数根据输入的geometry1和geometry2，返回geometry1与geometry2之间的二维最长LineString|||||
|||ST_MAKEENVELOPE函数用于返回一个根据输入的X、Y的最小、最大值构建的外包矩形。其结果为ST_Geometry类型的Polygon|||||
|||ST_MAKELINE函数根据输入的geometry1和geometry2，返回由组成它们的点按顺序连接的LINESTRING数据|||||
|||ST_MAKEPOINT函数根据输入的x、y和可选的z和m，返回对应坐标的POINT数据|||||
|||ST_MAXDISTANCE函数根据输入的geometry1和geometry2，返回它们对应的二维最大距离|||||
|||ST_MULTI函数用于返回输入的Geometry对象所对应的Geometry Collection类型。若输入的Geometry已是集合类型，则返回输入的Geometry对象|||||
|||ST_OVERLAPS函数的功能是判断两个Geometry相交并具有相同的维度，但彼此之间不完全包含。如果geometry1和geometry2“空间重叠”则返回TRUE，否则返回FALSE|||||
|||ST_PERIMETER函数用于计算geometry的周长，或者说计算的是区域的周长，对于不能构成区域的几何图形，则返回0|||||
|||ST_POINT函数根据输入的x、y和可选的srid，返回对应坐标和srid的POINT数据|||||
|||ST_POINTZ函数根据输入的x、y、z和可选的srid，返回对应坐标和srid的POINT数据|||||
|||ST_POLYGON函数根据输入的geometry和srid，返回对应srid中由geometry组成的POLYGON数据|||||
|||ST_RELATE函数的功能是根据输入的边界值规则(boundaryNodeRule)，计算用于表示输入的两个Geometry之间空间关系的DE-9IM矩阵字符串|||||
|||ST_SETSRID函数用于将输入的geometry的空间参考系标识号（SRID）设置为指定的srid|||||
|||ST_SHORTESTLINE函数根据输入的geometry1和geometry2，返回geometry1与geometry2之间的二维最短LineString|||||
|||ST_SIMPLIFY函数的功能是使用Douglas-Peucker算法来简化输入的geometry|||||
|||ST_SPLIT函数用于返回input几何对象被blade几何对象切割之后产生的几何对象|||||
|||ST_SRID函数用于查询输入的geometry的空间参考系标识号（SRID）|||||
|||ST_TOUCHES函数的功能是判断两个Geometry是否至少有一个共同点，且它们的内部不相交。如geometry1和geometry2相交，且它们的内部不相交，则返回TRUE，否则返回FALSE|||||
|||ST_TRANSFORM函数根据输入的geometry和srid，返回geometry从原本的空间参考系转换到srid所指定的空间参考系的坐标数据的新geometry|||||
|||ST_UNION函数返回两个geometry对象的并集，返回值为ST_GEOMETRY类型数据|||||
|||ST_WITHIN函数的功能是判断geometry1是否完全在geometry2的内部，如果是则返回TRUE，否则返回FALSE|||||
|||ST_X函数根据输入的geometry，返回该点的x轴坐标|||||
|||ST_Y函数根据输入的geometry，返回该点的y轴坐标|||||
|||ST_Z函数用于返回输入的geometry的z轴坐标|||||
||||||||


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|涉及|
|可维护性|涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- operators_perf框架


# 6. 测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：2023/11/21日

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0M2YzOGI3MjgyMDZlZmI5MzNkOGY5IiwicmVmX2lkIjoiNjc0M2YzOGI3MjgyMDZlZmI5MzNkOTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjYwLCJleHAiOjE3ODI0MTA2NjB9.78hEQ3cNgFIFNtDtgoc_pDhU14xGGY3KSMRfhNwFlQM)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0M2YzOGI3MjgyMDZlZmI5MzNkOGY5IiwicmVmX2lkIjoiNjc0M2YzOGI3MjgyMDZlZmI5MzNkOTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjYwLCJleHAiOjE3ODI0MTA2NjB9.78hEQ3cNgFIFNtDtgoc_pDhU14xGGY3KSMRfhNwFlQM)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0M2YzOGI3MjgyMDZlZmI5MzNkOGY3IiwicmVmX2lkIjoiNjc0M2YzOGI3MjgyMDZlZmI5MzNkOTA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjYwLCJleHAiOjE3ODI0MTA2NjB9.n3IUJqXDmlPMUEb7RfoSpqMFbRSrJojbeIeD65_OqZU)

 (application/msword)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
