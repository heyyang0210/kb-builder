Created by 李美娥, last modified on 十一月 28, 2023

# 1. 参考资料

        需求：    [YDBRD-22073](https://jira.yasdb.com/browse/YDBRD-22073?src=confmacro)    -  支持空间谓词ST_ContainsProperly  完成

        开发设计：    [ST_ContainsProperly Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ST_ContainsProperly+Design)  

        对外提供的函数：  ST_ContainsProperly

        函数目前支持的类型：Point、LineString（  LineRing  ）、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

# 2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1 函数功能

    一、    `ST_ContainsProperly`    ：  如果两个输入几何体都为非空，并且第二个几何体的 2D 投影的所有点都是第一个几何体的 2D 投影的内部点，则 ST_ContainsProperly 返回 true。  或者  如果Geometry对象B完全在Geometry对象A的内部，则返回True。

           --  不允许交点在边界上（包括线的端点），其他同  ST_Contains。

  `     boolean ST_ContainsProperly(geometry geomA , geometry geomB);`  

- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 任意入参是纯EMPTY,返回的是false。
- 输入为null则返回null。
- 无效的Geometry对象，会报错。
- 两个对象的DE-9IM相交矩阵符合  [T**FF*FF*]。


# 3.   **测试设计方法**

等价类，边界值，场景分析。

入参为geometry类型。可以通过表中geometry类型的列传入。

- 支持2 （X  Y），3 (X Y Z)，4 (X Y Z M)维坐标的输入，此sr函数ZM不参与比较，仅比较X Y的关系。
- srid：  数据在同一srid，不同srid作为容错。  ST_ContainsProperly不需要关注每类的srid。
- 第一个入参和第二个入参是目前支持的7个子类型中的一个，组合后是49种。
- 超长文本入参（geom）空间关系比较
- null和空串，含empty
- nan inf -inf


因仍是函数，测试点仍可参考内置函数的通用测试点，主要在于是否构造针对函数的数据进行测试，复用ST_Contains的数据，与已提供的其他gis相关函数结合测试。 

  `ST_ContainsProperly复用ST_Contains的用例。（数据区分带索引和不带索引--部分功能用例+rtree时的ST_Contains）`       --排查下用例，补充边界有交点的数据  

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计。(作为查询条件要着重测试）

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|是|
|压力|否|
|性能|是，比对一下|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

   电子表格

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# **8. 差异点记录**

|序号|描述|  
|
|---|---|---|
|1、保持差异|select ST_ContainsProperly (st_geomfromtext('MULTIPOLYGON (((0 0, 0 10, 10 10, 10 0, 0 0)), ((15 15,15 20,20 20,20 15,15 15)), ((2 2, 2 8, 8 8, 8 2, 2 2)))', 4326), st_geomfromtext('MULTIPOINT(0.5 0.5,6 6)', 4326)) from dual;,select ST_ContainsProperly(st_geomfromtext('MULTIPOLYGON (((0 0, 0 10, 10 10, 10 0, 0 0)), ((15 15,15 20,20 20,20 15,15 15)), ((2 2, 2 8, 8 8, 8 2, 2 2)))'),st_geomfromtext('POINT ZM(4 4 6 10)')) from dual;|  
|
|2、保持差异|表5的：7-115,8-115,9-115,55-4,501-115,601-115,701-115,7-115是：select ST_Contains(st_geomfromtext('POLYGON Z ((0 0 0,10000.899 0 0,200000 10000000 0,500000.877666 10000000.988766 0,100 10000000.988766 0,0 0 0),(500 500 0,600 500 0,600 600 0,500 600 0,500 500 0))'),st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)')) from dual;  是false，pg是ture,9-115是：select ST_Contains(st_geomfromtext('POLYGON ((0 0,100 0,100 90,0 89,0 0),(10 10,20 10,20 20,10 20,10 10),(50 50,60 50,60 70,50 80,50 50))'),st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)')) from dual;是false，pg是true,55-4是：select ST_ContainsProperly( st_geomfromtext('POLYGON M ((0 0 78 ,-1.79769313486232E308 -4.94065645841247E-324 78,10 10 78 ,0 10 78 ,0 0 78 ))'),st_geomfromtext('POINT(-101 0)')) from dual;是true，pg是false,表六：1-1，1-102，1-207，2-109，3-109，4-1，4-109，7-109,1-1是select ST_Contains(st_geomfromtext('MULTIPOLYGON(((0 0 ,200000 0 ,200000 10000000 ,0 10000000,0 0)),((5000 5000 ,6000 5000 ,6000 6000 ,5000 6000 ,5000 5000)))'),st_geomfromtext('POINT(6000 6000)')) from dual;是false,pg是true,2-109是select ST_Contains(st_geomfromtext('MULTIPOLYGON(((5000 5000 ,6000 5000 ,6000 6000 ,5000 6000 ,5000 5000)),((0 0 ,200000 0 ,200000 10000000 ,0 10000000,0 0)))'),st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)')) from dual;是false,pg返回true,4-1是select ST_ContainsProperly(st_geomfromtext('MULTIPOLYGON(((0 0 ,200000 0 ,200000 10000000 ,0 10000000,0 0)),((1000 1000 ,180000 1000 ,180000 9000000 ,1000 9000000,1000 1000)))'),st_geomfromtext('POINT(6000 6000)')) from dual;我们是false，pg是true。,  
,  
|  
|
