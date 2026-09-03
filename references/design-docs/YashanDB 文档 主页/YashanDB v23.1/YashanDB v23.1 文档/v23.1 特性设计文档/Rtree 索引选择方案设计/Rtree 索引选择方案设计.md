Created by 李坤宇, last modified on 七月 20, 2023

#   [YDBRD-14354 : Rtree 索引选择方案设计](#ydbrd-14354--rtree-索引选择方案设计)  

AR链接：    [https://jira.yasdb.com/browse/YDBRD-14354](https://jira.yasdb.com/browse/YDBRD-14354)  

##   [1. Overview（概述）](#1-overview概述)  

本方案是为了支持在扫描时使用rtree索引，生成rtree索引扫描计划。

##   [2. Features（功能特性）](#2-features功能特性)  

当表上有filter中出现支持使用rtree的filter类型时，生成rtree扫描算子，加入CBO的计划搜索空间中。

##   [3. Interfaces（接口）](#3-interfaces接口)  

提供一种新plan类型：Spatial Index Scan，该计划使用rtree索引进行扫描。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 表类型与建立rtree索引的规格对齐，仅支持heap表走行执行引擎。不支持函数索引、降序索引、reverse索引、列式索引。
1. 支持函数列表如下:    
  假设A列上有空间索引，把B作为扫描范围（scanMbr）


|Geometry空间谓词|含义|Rtree扫描算子|备注|
|---|---|---|---|
|ST_Contains（A, B)|A包含B|被包含|scanMbr(B)被包含于A(Rtree数据)|
|ST_Contains（B, A)|B包含A|包含|scanMbr(B)包含A(Rtree数据)|
|ST_Within (A, B)|A包含于B|包含|scanMbr(B)包含A(Rtree数据)|
|ST_Within (B, A)|B包含于A|被包含|scanMbr(B)被包含于A(Rtree数据)|
|ST_Equals|相等，等价于A包含B，并且B包含A|被包含|被包含|
|ST_CoveredBy|有相交部分|相交|与A，B顺序无关|
|ST_Covers|有相交部分|相交|与A，B顺序无关|
|ST_Crosses|有相交部分|相交|与A，B顺序无关|
|ST_Intersects|有相交部分|相交|与A，B顺序无关|
|ST_Overlaps|有相交部分|相交|与A，B顺序无关|
|ST_Touches|有相交部分|相交|与A，B顺序无关|


1. 如果filter中存在多个and条件，且同时存在普通类型索引与rtree索引，此时优先使用普通类型索引。


- 如果存在多个rtree索引，选择哪个不定（与代码中遍历到的顺序有关）
- ST_Contains（A, B) and ST_Covers(A,C)这种filter，使用其中一个
- ST_Contains（A, B) or ST_Covers(A,C)这种暂时走不了rtree索引    
  ~~问题1： ST_Contains（A, B) and ST_Covers(A,C)这种filter能否使用索引？是两个条件一起用还是从中挑一个？如果两个一起用，存储如何使用？如果挑一个，挑的规则如何？(postgis允许一起使用，当前yasdb将使用遍历到的第一个作为索引条件）~~    
  ~~问题2： ST_Contains（A, B) or ST_Covers(A,C)这种filter能否使用索引？空间关系的合并能否实现？ （postgis通过bitmap heap scan实现）~~


1. 空间谓词函数可用作索引时，需要满足ST_func(A,B)其中A或B为索引列，另一个参数为一个scanMbr。（是否需要校验scanMbr的数据类型等？另一个参数需要支持哪些表达式？子查询、param是否支持？能否作为join条件下推为index nl join？）


- 要求只有在plan阶段能从parseTree中拿到相应的AdtRef结构时才能走rtree索引，例如以下场景：


```
create rtree index on test_geom(shp);
set serveroutput on;
create or replace procedure rtree_param_test(v1 st_geometry) is
    TYPE ret IS RECORD (a int, b varchar(32));
cursor1 SYS_REFCURSOR;
ret_val ret;
begin
open cursor1 for select id, geom_type from test_geom where st_intersects(shp, v1);
loop
fetch cursor1 into ret_val;
                exit when cursor1%NOTFOUND;
                dbms_output.put_line(ret_val.a || ' ' || ret_val.b);
end loop;
end;
/

create or replace procedure rtree_param_test2(v1 varchar) is
    TYPE ret IS RECORD (a int, b varchar(32));
cursor1 SYS_REFCURSOR;
ret_val ret;
begin
open cursor1 for select id, geom_type from test_geom where st_intersects(shp, ST_GeomFromText(v1));
loop
fetch cursor1 into ret_val;
                exit when cursor1%NOTFOUND;
                dbms_output.put_line(ret_val.a || ' ' || ret_val.b);
end loop;
end;
/

select id, geom_type from test_geom where st_intersects(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
exec rtree_param_test(ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
exec rtree_param_test2('polygon((2 2, 2 4, 4 4, 4 2, 2 2))');

```

对于rtree_param_test，计划只能看到一个param，parseTree上也没有相应的AdtRef结构，因此无法走索引。    
  对于rtree_param_test2，计划看到的是ST_GeomFromText(param)，ST_GeomFromText函数出现在了parseTree上，因此可以走索引。

1. 与rangescan不同，rtree索引永远不会删除原始filter，因为基于bbox的过滤是不精确的，永远都需要根据表上精确信息再做过滤，因此也永远需要回表。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

对于优化器，需要实现的能力如下：

1. 索引算子生成阶段，检查表上的filter中是否出现上述空间谓词函数，如果出现则生成一个spatial index scan算子。
1. 设计一个结构向执行侧传递基于空间谓词函数改写后的可用于索引的过滤条件，需要表示三种信息：包含~、被包含@、相交&&。（算子计划上的字符表示参考postgis）
1. 打印计划时需要能够显示出使用的索引运算类型。


###   [5.1 spatial index scan算子设计](#51-spatial-index-scan算子设计)  

**1. 新增plan类型,修改IndexScanPlan结构。**

```
typedef enum EnPlanType {
    PLAN_SPATIAL_INDEX_SCAN
} PlanType;

typedef struct StPlanRtreeInfo {
    RtreeOpType rtreeOpType;
    CodUint8    unused[4];
    Expr*       scanMbr;
} PlanRtreeInfo;

typedef struct StPlanBtreeInfo {
    PlanRangeSet* rangeSet;
    NativeList*   filterCols;
    CodUint16     skipCnt;
    CodBool       isDesc;
    CodBool       isIndexOnly;
    CodBool       isIndexRowId;
    CodUint8      unused[3];
} PlanBtreeInfo;

typedef struct StIndexScanPlan {
    PlanTable*    table;    /* keep it here for macro SCAN_PLAN_TABLE_ID */
    Filter*       runtimeFilter;
    AnkIndexDesc* index;
    CodUint16     queryId;
    CodUint8      scanMode;
    union {
        PlanRtreeInfo rtreeInfo;
        PlanBtreeInfo btreeInfo;
    };
} IndexScanPlan;


```

**2. 修改cbo内IndexInfo结构**

```
typedef struct StIndexInfo {
    AnkIndexDesc* index;
    CodUint16     matchLen;
    CodUint16     eqMatchLen;
    CodUint8      type;
    CodUint8      scanMode;
    CodBool       isParted;
    CodUint8      unused;
    union {
        PlanBtreeInfo btreeInfo;
        PlanRtreeInfo rtreeInfo;
    };
} IndexInfo;


```

**3. 打印计划如下**

```
explain select id, shp from rtreeidx_base where st_contains(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))' ));

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 1928872263                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  TABLE ACCESS BY INDEX ROWID   | RTREEIDX_BASE        | REGRESS    |          |             |                                |
|* 2 |   SPATIAL INDEX SCAN           | RTREEIDX             | REGRESS    |         1|      202( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - Predicate : filter(ST_CONTAINS("RTREEIDX_BASE"."SHP", ST_GEOMFROMTEXT('polygon((2 2, 2 4, 4 4, 4 2, 2 2))')) BOOL)
   2 - Predicate : access("RTREEIDX_BASE".""SHP".__MAKE_RTREE_KEY__"  @ ST_GEOMFROMTEXT('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'))

16 rows fetched.


```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 支持的八种函数的功能测试。
1. where中添加and、or观察计划能否走rtree索引
1. 同时存在btree索引和rtree索引，filter中存在能走两种索引的条件，能否优先选择btree索引
1. 同时存在多个rtree索引，选择哪一个作为
1. 对于关心参数顺序的函数，交换参数顺序是否影响了access里面的存储算子类型。
1. scanMbr是绑定参数、子查询的场景下，或者boolfilter作为join条件的场景下。


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*