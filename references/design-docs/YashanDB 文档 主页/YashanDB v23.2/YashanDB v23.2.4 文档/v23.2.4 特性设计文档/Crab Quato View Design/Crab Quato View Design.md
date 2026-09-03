Created by 胡威振, last modified on 六月 20, 2024

  


详细设计-YDBRD-26326 : 内存配额定位能力增强 Design（内存配额定位能力增强 方案设计）

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b279](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b279)    ?

SR链接：    [https://pingcode.yasdb.com/pjm/items/66194214fd997db58ad8c104](https://pingcode.yasdb.com/pjm/items/66194214fd997db58ad8c104)    ?

##   [1. 总述](#1-总述)  

增加视图显示当前全局、stage、SQL和算子的配额使用情况

###   [1.1 需求来源](#11-需求来源)  

产品化需求

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|V$COLUMNAR_QUOTA|单机下全局使用的配额信息|无|原创技术，参考技术设计链接|
|DV$COLUMNAR_QUOTA|分布式下全局使用的配额信息|无|原创技术，参考技术设计链接|
|V$COLUMNAR_SQL_QUOTA|单机下SQL使用的配额信息|无|原创技术，参考技术设计链接|
|DV$COLUMNAR_SQL_QUOTA|分布式下SQL使用的配额信息|无|原创技术，参考技术设计链接|
|V$COLUMNAR_STAGE_QUOTA|单机下stage使用的配额信息|无|原创技术，参考技术设计链接|
|DV$COLUMNAR_STAGE_QUOTA|分布式下stage使用的配额信息|无|原创技术，参考技术设计链接|
|V$COLUMNAR_PLAN_QUOTA|单机下算子使用的配额信息|无|原创技术，参考技术设计链接|
|DV$COLUMNAR_PLAN_QUOTA|分布式下算子使用的配额信息|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SELECT * FROM V$COLUMNAR_QUOTA|查询单机下全局使用的配额信息|----|是/否|
|SELECT * FROM DV$COLUMNAR_QUOTA|查询分布式下全局使用的配额信息|----|是/否|
|SELECT * FROM V$COLUMNAR_SQL_QUOTA|查询单机下SQL使用的配额信息|----|是/否|
|SELECT * FROM DV$COLUMNAR_SQL_QUOTA|查询分布式下SQL使用的配额信息|----|是/否|
|SELECT * FROM V$COLUMNAR_STAGE_QUOTA|查询单机下STAGE使用的配额信息|----|是/否|
|SELECT * FROM DV$COLUMNAR_STAGE_QUOTA|查询分布式下STAGE使用的配额信息|----|是/否|
|SELECT * FROM V$COLUMNAR_PLAN_QUOTA|查询单机下OPERATOR使用的配额信息|----|是/否|
|SELECT * FROM DV$COLUMNAR_PLAN_QUOTA|查询分布式下OPERATOR使用的配额信息|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

支持单机和分布式两种视图。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

COLUMNAR_QUOTA所包含的信息：

|列|描述|类型|
|---|---|---|
|TOTAL|总共配额大小|BIGINT|
|USED|已使用的配额大小|BIGINT|
|FREE_UP_LEVEL|已分配配额的上限|BIGINT|
|ACTIVE_SQL_COUNT|当前SQL语句的数量|BIGINT|


- FREE_UP_LEVEL = ALLOCATED_UP_LEVEL


COLUMNAR_SQL_QUOTA所包含的信息：

|列|描述|类型|
|---|---|---|
|SQL_ID|SQL语句的ID|VARCHAR(13)|
|ESTIMATE|预估配额大小|BIGINT|
|LOW_LEVEL|配额下限|BIGINT|
|UP_LEVEL|配额上限|BIGINT|
|FREE_UP_LEVEL|预留配额的最大值|BIGINT|
|MAX_USED|最大使用配额|BIGINT|
|USED|当前使用的配额|BIGINT|


- FREE_UP_LEVEL = UP_LEVEL - ALLOCATED_UP_LEVEL
- USED = CURRENT


COLUMNAR_STAGE_QUOTA所包含的信息：

|列|描述|类型|
|---|---|---|
|SQL_ID|所属SQL的ID|VARCHAR(13)|
|STAGE_ID|stage的ID|INT|
|PLAN_ID|计划ID|INT|
|ESTIMATE|预估配额大小|BIGINT|
|LOW_LEVEL|配额下限|BIGINT|
|UP_LEVEL|配额上限|BIGINT|
|FREE_UP_LEVEL|空闲配额上限|BIGINT|
|PLAN_MIN_UP_LEVEL|算子最小的配额上限|BIGINT|
|MAX_USED|最大使用配额|BIGINT|
|USED|当前使用配额|BIGINT|


- FREE_UP_LEVEL = RETURN_UP_LEVEL
- USED = CURRENT


COLUMNAR_PLAN_QUOTA所包含的信息：

|列|描述|类型|
|---|---|---|
|SQL_ID|所属SQL的ID|VARCHAR(13)|
|STAGE_ID|所属stage的ID|INT|
|PLAN_ID|所属计划ID|INT|
|NAME|算子名称|VARCHAR(16)|
|ESTIMATE|预估配额大小|BIGINT|
|LOW_LEVEL|配额下限|BIGINT|
|UP_LEVEL|配额上限|BIGINT|
|DEGREE|并行度|SMALLINT|
|MIN_UP_LEVEL|算子最小的配额上限|BIGINT|
|EXPEND|是否可以扩充配额|BOOL|
|MAX_USED|算子的最大使用配额|BIGINT|
|USED|当前使用的配额大小|BIGINT|


- 我们具体执行的时候有的时候会在计划给的算子的基础上增加一些其他算子，然后计划上是看不到的，这时候pan id 和name跟计划是对不上的，这里我们就按照执行的具体计划来显示了
- estimate值可能比total大，这是合理的。


分布式视图比以上视图多了两列：

|列|描述|类型|
|---|---|---|
|GROUP_ID|组ID|INTEGER|
|GROUP_NODE_ID|组内节点ID|INTEGER|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 在单机和分布式下desc 对应视图名字，测试字段信息是否正确。
1. 在没有执行语句时SELECT * FROM 视图，验证相关字段的数据是否正确。
1. 在执行查询语句时SELECT * FROM 视图，并与日志文件进行对比，验证运行时数据是否正确。alter system set columnar_material_trace=true;


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。