# 1. 概述

*本需求的背景，lsc表的mcol的DML能力更好，scol则更能保证查询性能，本文档描述修改默认关闭mcol的*  *测试设计*  *。*

# 2. 需求分析

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6707b14de489dd0868f43c56?](https://pingcode.yasdb.com/pjm/items/6707b14de489dd0868f43c56?)  

#YDBRD-33871 LSC表默认关闭MCol

*开发设计：*  [(2320) 【YDBRD-33871】LSC表默认关闭MCol | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/CHENXIAOQING/pages/67453855728206efb934256e)  

## 2.1 功能点分析

1、支持默认关闭mcol （olap大部分场景是准实时），LSC_MCOL_ENABLED默认值由TRUE改成FALSE

2、打开mcol时，update改成delete+insert热数据

3、文档上明确mcol使用建议

## 2.2 应用场景

- *并发事务内更新删除后混合查询*
- *小事务验证*
- *4096列更新删除内存使用量大分析*


## 2.3 规格约束

- update主键，超过63条可能存在冲突更新失败的情况
- *并发事务内更新未提交不保证数据一致性*
- *关闭mcol的update必须开启row movement，非跨分区更新也需要开启*
- *已提交的lob locator无法再次使用*
- *不支持pl/sql中的自治事务*
- *多索引update存在死锁的可能*
- *不支持insert与insert bulkload混用*
- *因关闭mcol不记redo，故事务失败nologging的表不会corrupted*


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*本需求的功能验证主要使用等价类和场景测试法进行验证。*

## 3.2 详细测试设计

1. *验证功能*


|序号|测试内容|期望|备注|
|---|---|---|---|
|1|确认LSC_MCOL_ENABLED默认值|默认值是FALSE|  
|
|2|*打开mcol进行update（有/无索引），确认更新后的数据*|新增vgd slice。更新结果符合预期|  
|
|3|关闭MCol， LSC slice执行 select for update，查询v$lock视图| select for update，v$lock视图，成功加锁，commit/rollback后释放||
|4|关闭MCol，LSC slice并发执行 select for update|功能正常，符合预期||
|5|关闭mcol，对未提交的数据进行select for update，确认视图|不会加锁|  
|
|6|关闭mcol，update事务验证|约束|待确认（打开mcol的冷数据更新删除）|
|7|关闭mcol，insert与insert bulkload是否冲突|冲突|  
|
|8|关闭mcol，dbms_lob高级包功能||  
不支持|
|9|关闭mcol，自治事务||不支持|
|10|4096列的表DML验证|功能正常|更新删除预占很多内存？|
|11|DML性能验证|||
|12|并行查询||高并行卡住|
|13||||
|14||||
|15||||
|16||||
|17||||
|18||||
|  
||||
|  
||||


2、涉及

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

- Guider/ha_regress


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：