Created by 刘登科, last modified on 十一月 13, 2024

*IR链接：*  [IR](https://pingcode.yasdb.com/ship/ideas/6716285f52495bd785c64b2d)  *，#YASHAN-3389 IN BINARY SEARCH 规格增强*

*SR链接：*  [SR](https://pingcode.yasdb.com/pjm/items/67177d0ce489dd0868fc429d)  *，#YDBRD-34568 IN BINARY SEARCH 规格增强*

##   [1. 总述](#1-总述)  

FILTER IN 顺序扫描执行效率不佳，对常量，长LIST场景进行计划解析，及执行。对原有FILTER IN BINARY SEARCH 规格进行增强。

###   [1.1 参考资料](#11-需求来源)  

1.   [Oracle 参考资料](https://docs.oracle.com/cd/E11882_01/server.112/e41084/expressions015.htm#SQLRF52099)  
1.   [Mysql 参考资料](https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#operator_in)  
1.   [PG 参考资料](https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-IN)  
1.   [DB2 参考材料](https://www.ibm.com/docs/zh/db2/10.5?topic=optimization-predicate-processing-queries)  


###   [1.2 需求规格及约束](#11-需求来源)  

1. 不涉及列执行，不涉及分布式；
1. 设立参数开关：（_RWRT_OPT，223为关闭，255为打开）
1. IN BINARY SEARCH 支持的LIST数量上限MAX_OPTMZLIST_COUNT（2048）移除，使用ObjectArray（约33w）（SHARE_POOL_SIZE）；
1. 多列IN支持BINARY SEARCH计划调整，及行执行；
    1. 多列IN 左边表达式EXPR LIST个数无限制；
1. IN出现在FILTER TREE的任何位置（AND，OR，单IN等）（除去ACCESS）；
    1. NCHAR/NVARCAHR的复杂数据类型也可以走；
    1. 类型不一样时，也可以；
    1. LIST出现NULL，空串等；
1. 不对IN 左边Expr类型做限制，包括UDT也支持；
1. 多列IN，NOT IN左边有NULL值的情况处理见表1；
1. IFFS等未实现IN BINARY SEARCH的算子，补充实现，算子列表见表2；


|表1（假设右边无NULL值）|左边NULL值情况|FILTER_IN|FILTER_NOT_IN|
|---|---|---|---|
|1|全为NULL|FR_NULL|FR_NULL|
|2|有NULL，其余非NULL的值匹配|FR_NULL|FR_NULL|
|3|有NULL，其余非NULL的值不匹配|FR_FALSE|FR_TRUE|


|表2|物理算子类型|函数名称|OP结构体名称|谓词挂载点|
|---|---|---|---|---|
|1|OP_PHYSICAL_TABLE_FULL_SCAN|createTableFullScan|OpPhysTableScan|.filter.table->filter|
|2|OP_PHYSICAL_INDEX_SCAN|createIndexScan|OpPhysIndexScan|.filter.table->filter|
|3|OP_PHYSICAL_PART_SCAN|createPartScan|OpPhysPartScan|.filter.table->filter|
|4|OP_PHYSICAL_PART_INDEX_SCAN|createPartIndexScan|OpPhysPartIdxScan|.filter.table->filter|
|5|OP_PHYSICAL_PART_AC_SCAN|createPartAcScan|OpPhysPartScan|.filter.table->filter|
|6|OP_PHYSICAL_ACSCAN|createAcScan|OpPhysAcScan|.filter.table->filter|
|7|OP_PHYSICAL_EXPAND|createExpand|\|无谓词挂载点|
|8|OP_PHYSICAL_IDX_NL_JOIN|createNestloopJoin|TRANS JOIN添加transLogi2PhysJoin|.joinCond.joinFilter|
|9|OP_PHYSICAL_NESTLOOP_JOIN|createNestloopJoin|TRANS JOIN添加|.joinCond.joinFilter|
|10|OP_PHYSICAL_HASH_JOIN|createHashJoin|TRANS JOIN添加|.joinCond.joinFilter|
|11|OP_PHYSICAL_MERGE_JOIN|createMergeJoin|TRANS JOIN添加|.joinCond.joinFilter|
|12|OP_PHYSICAL_TABLE_FUNC_SCAN|createTableFuncScan|CBO 行列 均未实现|\|
|13|OP_PHYSICAL_FIRSTROW|createFirstRow|OpPhysFirstRow|无谓词挂载点|
|14|OP_PHYSICAL_SORT|createSort|OpPhysSort|无谓词挂载点|
|15|OP_PHYSICAL_GROUP|createGroup|OpPhysGroup|.havingFilter|
|16|OP_PHYSICAL_FOR_UPDATE|createForUpdate|OpPhysForUpdate|无谓词挂载点|
|17|OP_PHYSICAL_SELECT|createSelect|OpPhysSelect|.planDs->filter.planDs->havingFilter|
|18|OP_PHYSICAL_VIEWSCAN|createViewScan|OpPhysViewScan|.table->filter|
|19|OP_PHYSICAL_UNION|已被改写为UNION ALL|\|\|
|20|OP_PHYSICAL_UNIONALL|createUnionAll|\|无谓词挂载点|
|21|OP_PHYSICAL_MINUS|createMinus|\|无谓词挂载点|
|22|OP_PHYSICAL_MINUS_ALL|createMinusAll|\|无谓词挂载点|
|23|OP_PHYSICAL_INTERSECT|createIntersect|\|无谓词挂载点|
|24|OP_PHYSICAL_INTERSECT_ALL|createIntersectAll|\|无谓词挂载点|
|25|OP_PHYSICAL_AGGR|createAggr|OpPhysAggr|.havingFilter|
|26|OP_PHYSICAL_DISTINCT|CBO暂不支持|\|\|
|27|OP_PHYSICAL_SORTAGGRDIST|createSortAggrDist|OpPhysSortAggrDist|无谓词挂载点|
|28|OP_PHYSICAL_INSERT|CBO暂不支持|\|\|
|29|OP_PHYSICAL_UPDATE|CBO暂不支持|\|\|
|30|OP_PHYSICAL_DELETE|CBO暂不支持|\|\|
|31|OP_PHYSICAL_MERGE|CBO暂不支持|\|\|
|32|OP_PHYSICAL_UNIQUE|createUnique|OpPhysUnique|无谓词挂载点|
|33|OP_PHYSICAL_WINFUNC|createWinFunc|OpPhysWinFunc|无谓词挂载点|
|34|OP_PHYSICAL_WINDOW|createWindow|OpPhysWindow|无谓词挂载点|
|35|OP_PHYSICAL_ROW2COL|createRow2Col|OpPhysRow2Col|无谓词挂载点|
|36|OP_PHYSICAL_COL2ROW|createCol2Row|OpPhysCol2Row|无谓词挂载点|
|37|OP_PHYSICAL_RESULT|createResult|OpPhysResult|.filter|
|38|OP_PHYSICAL_COUNT|createCount|OpCount|.filter|
|39|OP_PHYSICAL_PX_QUEUE|createPxQueuePlan|OpPhysPxQueue|无谓词挂载点|
|40|OP_PHYSICAL_TEMP_SCAN|createTempScanPlan|OpPhysTempScan|.filter|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|无|\|\|\|


###   [1.5 开源依赖](#15-开源依赖)  

无开源依赖，不依赖开源协议，独立算法优化。

##   [2. 接口](#2-接口)  

```
CodResult sortFilterInList(FilterSortContext* ctx, FilterNode* node);
CodResult execMulInBinarySearch(const AnlStmt* stmt, const FilterNode* node, FilterResult* filterResult, const Variant* lVars, FilterResult matchResult);
```

##   [4. 特性](#4-特性)  

###   [4.1 特性流程](#41-特性设计)  

![image.png](https://pingcode.yasdb.com/atlas/files/public/67441f588970c2af4f53b7e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2MjYsImV4cCI6MTc4MjMzNTQyNn0.FogQEfgOZmPShEtNSxhQKvvWa3MAuqqQ-ypytaFp_M4)

###   [4.2 特性可维可测设计](#45-特性可维可测设计)  

1. IN LIST较多时，较为明显的性能提升；
1. 此算法时生效时谓词计划打印关键字：“IN BINARY SEARCH”；


###   [4.3 特性周边配合](#47-特性周边配合)  

本特性实现计划阶段整体嵌入在CBO FILTER NORMALIZATION中，依赖于谓词规格化框架（入口为：normalizeFilterTree，normalizeJoinFilterTree）；执行阶段则嵌入于FILTER IN执行函数指针中，依赖于谓词执行框架（入口为：execFilter）。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测关注点：

1. IN出现在FILTER TREE的任何位置，且不论多少个IN都要能走到；AND,OR,单IN等等等等；
1. IN出现在任何算子上，都要能走到，除去ACCESS；
1. NCHAR/NVARCAHR的复杂数据类型也可以走；
1. 类型不一样时，也可以；
1. LIST出现NULL，空串；
1. UDT；
1. 外部引用，绑定参数；
1. 并发性能不劣化；
1. SELECTIVITY 等谓词相关HINT不失效；（explain select * from dual where dummy < '0' selectivity 0.00001 or dummy in ('1', '2') selectivity 0.1）


自测用例：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

不涉及；

##   [7.未来规划](#7未来规划)  

1. 当前行列实现方式未统一。行存于CBO中优化，为二分查找；列存于执行阶段自行优化，构造HASH结构扫描。此设计实现未修改任何原有列式计划&执行实现链路；
1. RWRT_IN/RWRT_EXISTS 代码中已无用，移除？QUERY_REWRITE_FORCE用法错误，应该用布尔？


