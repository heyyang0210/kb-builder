Created by 易文亮, last modified on 十一月 08, 2024

# 1. 概述

*本需求的背景，*  *冷数据insert带去重性能比热数据差很多；LSC 新增*  支持scol upsert，  insert /* dedup */用法  *测试设计*  *。*

# 2. 需求分析

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6707af4ce489dd0868f439b3?](https://pingcode.yasdb.com/pjm/items/6707af4ce489dd0868f439b3?)  

#YDBRD-33865 LSC支持冷数据准实时导入

*开发设计：*  [详细设计-LSC支持冷数据准实时导入 · 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/pages/uxsrnhVHDRk)  

## 2.1 功能点分析

- LSC表支持insert /*+ deduplicate */ 的方式实现upsert语义;
- flink、yds支持对接该用法;
- 性能优化，在准实时导入场景下，性能不低于纯MCol的导入。
- 对应的datax/flink/YDS工具等的upsert里的insert /*+bulkload deduplicate*/替换为insert /*+ deduplicate */


## 2.2 应用场景

- insert /*+ deduplicate */语法及功能验证;


           insert /*+ deduplicate */ into 单个values/多个values/ select/带on duplicate key

          insert all into

           开启逻辑日志

           打开mcol执行

- flink、yds使用upsert性能验证
- insert /*+ deduplicate */与insert /*+bulkload deduplicate*/的区别：(对应insert与insert /*+bulkload*/)


||insert /*+ deduplicate */|insert|insert /*+bulkload deduplicate*/|
|---|---|---|---|
|### delta delete bitmap内存优化|在删除时，创建delta dbm时获取获取实际的chunk数量来分配内存，减少内存使用|按最大sliceid计算分配内存||
|### 主键delete不回表|采用乐观锁，只要btree中确定该行可删除，则直接计入delta dbm，避免删除回表。,需要满足的条件：,1，唯一键、主键扫描,2，扫描投影列被唯一键、主键覆盖。,3，scol slice的删除场景,4，未开启逻辑日志,5，不含lob,6，只有一个索引|回表||
|### slice锁查找优化|在handler上增加锁位图。加锁成功时设置，解锁时释放。,锁信息放在handler上，按照分区来组织，并且只针对冷数据。|事务对已经加过的锁，采用链式管理。再加slice锁之前，会先判断其链表中是否已经加过锁。,但是当锁多了之后该遍历过程很慢||


## 2.3 规格约束

- 只对lsc有效


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*本需求的功能验证主要使用场景和等价类测试法进行验证。*



## 3.2 详细测试设计

1. *验证功能*


|序号|测试内容|期望|备注|
|---|---|---|---|
|1|insert /*+ deduplicate */ into 单个values|功能正常,数据正确|  
|
|2|insert /*+ deduplicate */ into 多个values|功能正常,数据正确|  
|
|3|insert /*+ deduplicate */ into select|功能正常,数据正确||
|4|insert /*+ deduplicate */ all into |功能正常,数据正确||
|5|打开mcol, 验证场景1\2\3\4|功能符合预期|  
|
|6|打开逻辑日志,验证1\2\3\4\5|功能符合预期|HA，打开mcol有逻辑日志，关闭mcol无逻辑日志  
|
|7|同会话中,insert/insert /*+ deduplicate */交叉执行|功能正常,数据正确|  
|
|8|对insert /*+ deduplicate */进行rollback/roback to savepoint|能正常回滚|  
|
|9|insert /*+ deduplicate */与delete/update交叉执行|能正常执行成功|  
|
|10|同会话中多张表交叉insert /*+ deduplicate */不提交|能正常执行成功|  
|
|11|insert bulkload与insert  /*+ deduplicate */ 冲突|报错信息正确|  
|
|12|带单个索引/多个索引验证insert  /*+ deduplicate */|执行成功,数据正确写入更新|无唯一键数据新增，有唯一键数据更新  
|
|13|同一张表,多会话insert /*+ deduplicate */ 并发|执行成功,数据正确写入更新|  
|
|14|不同的表, insert /*+ deduplicate */ 并发|执行成功,数据正确写入更新|  
|
|15|delete只有一个唯一索引进行主键更新,投影和filter只有主键列 |确认计划走index unique only scan,不回表  
|  
|
|16|多个唯一键更新,filter列含外键以外的其他列  
|  
数据正确|  
|
|17|带on duplicate key 原数据主键冲突,带on duplicate key 更新后的数据主键冲突|拦截报错| |
|18|大量slice delete/update性能优化|新版本构造大量slice进行delete/update性能有提升||
||yasldr工具带ENABLE_DEDUP=true||不带ENABLE_BULK|
|  
|insert/insert bulkload/insert /*+ deduplicate */ 性能对比验证,insert /*+ deduplicate */  与tac insert对比|YDS验证TPCC性能不比heap的差||
|  
|flink、yds  *性能验证*|upsert性能比热数据更新性能好||


       2.涉及

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|Y|  
|
|KT|Y|  
|
|长稳|N|  
|
|一致性|N|  
|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|安全|N|  
|
|DFR|N|  
|
|HA|Y|  
|
|压力|N|  
|
|性能|Y|  
|
|可维护性|N|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- Guider


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *10人天*

计划测试完成时间：

## Comments:

|,测试设计评审：,参与人：马爽、梁桢灏、谢锐、易文亮,1、insert deduplicate带on duplicate key拦截使hint不生效——功能明确,2、需验证大量slice的更新删除性能优化效果——用例补充,3、确认yasldr带enale_dedup是否支持去重，是否需要新增yasldr功能适配——功能待确认（报错不支持，后面若要支持需要工具适配）,4、insert all带deduplicate则hint不生效,--bulkload的on duplicate key和多表insert all也改成hint语法不生效|
|---|


附录（性能测试数据）：

|heap表|无索引|单列主键|联合主键|多个唯一键|tac表|无索引|单列主键|联合主键|多个唯一键|
|---|---|---|---|---|---|---|---|---|---|
|1W|0.129|0.101|0.104|0.123|1W|0.215|0.195|0.407|0.218|
|10W|1.098|1.079|1.011|1.314|10W|1.718|1.84|2.03|3.58|
|100W|7.343|11.447|9.994|15.575|100W|14.984|20.192|23.772|30.914|
|LSC表|无索引|单列主键|联合主键|多个唯一键|LSC表带优化|无索引|单列主键|联合主键|多个唯一键|
|1W|0.105|0.199|0.196|0.228|1W|0.127|0.126|0.129|0.265|
|10W|1.028|1.358|1.452|1.763|10W|0.815|1.29|1.173|1.57|
|100W|9.281|13.369|13.506|20.625|100W|||||
|1W去重|/|0.148|0.193|0.226|1W去重|/|0.13|0.132|0.202|
|10W去重|/|1.314|1.356|2.117|10W去重|/|1.229|1.191|1.428|
|100W去重|/|13.159|13.211|15.75|100W去重|/||||
|LSC热数据|无索引|单列主键|联合主键|多个唯一键|LSC热关order by|无索引|单列主键|联合主键|多个唯一键|
|1W|0.248|0.301|0.252|0.245|1W|0.162|0.295|0.192|0.268|
|10W|1.887|2.133|2.035|3.491|10W|1.643|2.017|3.566|3.384|
|100W|18.977|20.869|22.252|26.098|100W|16.394|20.339|23.597|29.985|
|1W去重|/|0.598|0.624|0.636|1W去重|/|0.613|0.573|0.869|
|10W去重|/|5.912|6.17|6.493|10W去重|/|5.776|6.653|10.64|
|100W去重|/|66.203|62.624|67.178|100W去重|/|56.871|64.997|56.871|


