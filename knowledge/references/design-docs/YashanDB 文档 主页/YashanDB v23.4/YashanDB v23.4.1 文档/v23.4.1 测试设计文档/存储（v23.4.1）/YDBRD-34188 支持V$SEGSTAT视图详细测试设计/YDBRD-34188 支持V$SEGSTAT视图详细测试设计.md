IR链接：  [https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ced5?](https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ced5?)  

#YASHAN-2256  支持V$SEGSTAT视图

SR链接：  [https://pingcode.yasdb.com/pjm/items/670de7f8e489dd0868f7a13d?](https://pingcode.yasdb.com/pjm/items/670de7f8e489dd0868f7a13d?)  

#YDBRD-34188 支持V$SEGSTAT视图

开发设计文档：  [https://pingcode.yasdb.com/wiki/pages/677e433a1e1551235beffa42](https://pingcode.yasdb.com/wiki/pages/677e433a1e1551235beffa42)  

# 1. 概述

支持V$SEGSTAT、GV$SEGSTAT和DV$SEGSTAT视图，实时监控段级(segment-level)统计项，鉴定性能问题源于表或者索引。

# 2. 需求分析

## 2.1 视图字段说明

|编号|列名|类型|说明|备注(yashan已有视图字段）|
|---|---|---|---|---|
|1|TS#|INTEGER|表空间ID|V$SEGMENT_STATISTICS---TS#|
|2|OBJ#|BIGINT|对象ID|V$SEGMENT_STATISTICS---OBJ#|
|3|DATAOBJ#|BIGINT|对象DATAOBJ ID|V$SEGMENT_STATISTICS---DATAOBJ#|
|4|STATISTIC_NAME|VARCHAR(64)|统计信息名|V$SEGMENT_STATISTICS---STATISTIC_NAME|
|5|STATISTIC#|TINYINT|统计信息ID|V$SEGMENT_STATISTICS---STATISTIC#|
|6|VALUE|BIGINT|统计信息值|V$SEGMENT_STATISTICS---VALUE|


## 2.2 统计对象和统计项

1、统计对象：表（heap、lsc)、索引(brtee、rtree、col index)、lob以及它们的分区/子分区，只收集有segment的对象；AC以及分区/子分区暂不支持

2、segment的统计项（STATISTIC_NAME）包括：

|ID|收集项|含义|收集方式|
|---|---|---|---|
|0|logical reads|逻辑读块次数，从buffer读取一个块的次数，单位为块数|全量|
|1|physical reads|物理读块次数，调用操作系统接口read一个块的次数，单位为块数|全量|
|2|physical read requests|物理读请求次数，单位为次数|全量|
|3|consistent changes|相当于db block changes。构建cr过程中回滚的事务数，单位为次数|全量|
|4|buffer busy waits|等待buffer的次数，包括等pin、buffer bucket latch，单位为次数|全量|
|5|xslot waits|相当于ITL waits。数据块xslot不足造成的等待次数，单位为次数|全量|
|6|row lock waits|行被其他事务锁住造成的等待次数，单位为次数|全量|
|7|gc cr blocks received|集群下cr blocks接收块数，单位为块数|全量|
|8|gc current blocks received|集群下current blocks接收块数，单位为块数|全量|
|9|gc remote grants|集群下远程授权读取磁盘次数，单位为次数|全量|
|10|gc buffer busy|集群下buffer busy wait的次数，单位为次数|全量|
|11|segment scans|segment扫描的次数，单位为次数|全量|
|12|space allocated|segment的大小，单位为bytes|全量|


## 2.3 应用场景

实时监控段级(segment-level)统计项，统计自数据库启动以来不同的段的使用情况, 鉴定性能问题源于表或者索引。

## 2.4 规格约束

- 交付形态：单机、分布式、集群
- 规格约束：同V$SEGMENT_STATISTICS视图保持一致


        1）当STATISTICS_LEVEL为TYPICAL、ALL时会统计段统计信息，当为BASIC时不会收集；

        2）现阶段统计较为粗略，例如不区分undo的操作和对象的操作，但能大致反映性能数据。为了性能考虑不宜频繁统计;

        3）备机统计数据不准。删除的object不显示统计信息。

# 3. 详细测试设计

## 3.1 测试设计方法

主要使用等价类和正交组合法进行测试，需要针对不同的统计对象构造业务，验证统计项信息是否准确。

## 3.2 详细测试设计

#### 3.2.1  使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式

|编号|测试项|测试场景|测试步骤|备注|
|---|---|---|---|---|
|1|视图字段验证|普通表,分区表,二级分区表,(包含range，list，hash，interval四类分区表),临时表（统计不到）,,索引：,普通索引,唯一索引,列式索引,反向索引,rtree索引,单索引、复合索引,分区索引,,覆盖 9  种OBJECT_TYPE:,TABLE  
TABLE PARTITION
TABLE SUBPARTITION
INDEX
INDEX PARTITION
INDEX SUBPARTITION,LOB  
LOB PARTITION
LOB SUBPARTITION|验证各项属性是否正确|复用V$SEGMENT_STATISTICS库上已有用例,补充对象：,1）加密表；,2）压缩表；,3）物化视图、udt（统计不到）,4）create table指定segment creation deferred|immediate表现（普通表、分区表、二级分区表）,5）函数索引,6）主键、unique、约束,,|
|2|修改统计对象后字段验证|rename table,alter tablespace,drop table,drop partition,add partition,修改分区表表空间,split partition,alter index   `UNUSABLE/`    `INVISIBLE（注意现象）`  ,drop index,*rename index*|验证各项属性是否跟随正确修改|复用V$SEGMENT_STATISTICS库上已有用例,1、修改统计对象补充,1）alter table truncate partition/subpartition,2）alter table modify partition,3）alter table merge partition/subpartition,4）alter index modify partition/subpartition,5）column类型从其他类型变成lob，或者从lob变成其他类型,6）alter add/drop index/primary/nuique|
|3|不同统计项信息验证|0 logical reads 逻辑读块次数，从buffer读取一个块的次数，单位为块数 全量|验证方法insert、update、delete、select ,重启实例再次查询场景,table index lob||
|4||1 physical reads 物理读块次数，调用操作系统接口read一个块的次数，单位为块数 全量|重启实例再次查询场景,table index lob,LOB：大更新,*清空buffer后update、delete、select*||
|5||2 physical read requests 物理读请求次数，单位为次数 全量|重启实例再次查询场景,table index lob,LOB：大更新,*清空buffer后update、delete、select*||
|6||3 consistent changes 相当于db block changes。构建cr过程中回滚的事务数，单位为次数|验证方法insert、update、delete、select ,table index lob,并发处理||
|7||4 buffer busy waits 等待buffer的次数，包括等pin、buffer bucket latch，单位为次数 全量|session1:,update tb_lhy_0710_01 set c1 = 100 where c1 = 100;,再执行,并发100：update tb_lhy_0710_01 set c1 = 100 where c1 = 100; commit;,session1:,commit;,table index||
|8||5 xslot waits 相当于ITL waits。数据块xslot不足造成的等待次数，单位为次数 全量|||
|9||6 row lock waits 行被其他事务锁住造成的等待次数，单位为次数 全量|构造行锁场景,session1:,delete from tb_lhy_0710_01 where c1 = 1;,session2:：,update tb_lhy_0710_01 set c2 = 'testt' where c1 = 1;,待查询后 session1: commit;,table||
|10||7 gc cr blocks received 集群下cr blocks接收块数，单位为块数 全量|||
|11||8 gc current blocks received 集群下current blocks接收块数，单位为块数 全量|||
|12||9 gc remote grants 集群下remote blocks接收块数，单位为块数 全量|||
|13||10 gc buffer busy 集群下buffer busy wait的次数，单位为次数 全量|||
|14||11 segment scans segment扫描的次数，单位为次数 全量|*统计的全表扫描次数*,全表扫描，索引的fast full scan或者表的full scan||
|15||12 space allocated  segment的大小，单位为bytes  全量|验证方法：空表insert ，  *引起segment扩展*,table index lob||
|16|其他|创建用户未赋权查询视图失败，赋权后查询成功|赋权后查询成功||
|17||视图写操作拦截（create、create as select、drop、alter、dml）|写操作被拦截||
|18||视图select查询验证（select 不带filter、带filter、group by、join、子查询、having、distinct、order by、limit)|查询结果匹配准确||
|19|ha|主备环境下，检查视图是否同步|1、主备环境下，主机下发业务，查询视图，备机查询视图是否同步,2、备升主后，新主继续下发业务，查询视图，救主查询视图是否同步||
|20|CT|多session、多实例并发查询视图与ddl、dml业务并发|实例不core不卡||
|21|KT|多session、多实例并发查询视图与ddl、dml业务并发+kill|实例不core不卡||
|22|资料验证|查看资料文档|资料文档中视图说明正确||


#### 3.2.2  梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|涉及  
|  
|
|KT|涉及  
|  
|
|长稳|/|  
|
|一致性|/  
|  
|
|三方测试工具  
(sqltest，sqlancer)|/  
|  
|
|安全|/  
|  
|
|DFR|/  
|  
|
|HA|涉及  
|  
|
|压力|/  
|  
|
|性能|/|  
|
|可维护性|涉及  
|  
|




# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# 7. 工作量评估

工作量：xx人天

计划测试完成时间：