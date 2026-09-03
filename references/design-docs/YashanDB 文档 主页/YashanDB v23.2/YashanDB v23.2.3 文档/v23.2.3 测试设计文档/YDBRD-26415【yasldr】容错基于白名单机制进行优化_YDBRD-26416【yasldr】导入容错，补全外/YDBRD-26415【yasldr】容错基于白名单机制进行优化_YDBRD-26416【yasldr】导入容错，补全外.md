Created by 陈钦卿, last modified on 十月 15, 2024

# 1. 概述

SR：

  [https://pingcode.yasdb.com/pjm/items/661df7cefd997db58ada6301](https://pingcode.yasdb.com/pjm/items/661df7cefd997db58ada6301)    ? #YDBRD-26415 【yasldr】容错基于白名单机制进行优化

  [https://pingcode.yasdb.com/pjm/items/661df853fd997db58ada6333](https://pingcode.yasdb.com/pjm/items/661df853fd997db58ada6333)    ? #YDBRD-26416 【yasldr】导入容错，补全外键的错误码白名单

开发设计：    [YDBRD-29174：容错优化方案设计 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150612382#space-menu-link-content)  

交付形态：单机、分布式、集群

# 2. 需求分析

## 2.1 功能点分析

1、新增字段insertedLines，不再使用maxFetchRows，而是使用新字段表示出错的行号。在调用存储insert接口时，若数据导致出错，则设置该字段为对应的行号。

2、新增白名单函数，用来判断存储层出错后，设置的错误码是否可以进行容错。

     若白名单函数返回成功，则表示当前错误可以容错，执行层需要继续尝试插入剩余的数据；

     否则，表示当前错误不能容忍。需要报错退出。

3、  暂定白名单列表(错误码)：    
       check约束的错误码： ERR_ANK_CHECK_CONS_VIOLATE    
       外键约束的错误码：  ERR_ANK_FK_CHILD_FOUND，ERR_ANK_FK_PARENT_NOT_FOUND    
       唯一索引冲突：      ERR_ANK_DUPLICATED_KEY    
       死锁不容错

## 2.2 应用场景

- yasldr导入容错功能优化
- load data导入容错功能优化


## 2.3 规格约束

- 不涉及basic模式
- 若后续新增白名单函数需相应补充测试——白名单函数所在文件  ：     **src/storage/access/ank_accessor.c**  ：   ankInsertOccurFatalError


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|测试点|输入项|子项|备注|
|---|---|---|---|
|白名单函数|check约束的错误码：ERR_ANK_CHECK_CONS_VIOLATE,YAS-02254,Message：check constraint (%s.%s) violated,Action：不要插入违反约束的值。|1. 表类型：heap、tac、lsc
1. 分区类型：hash、range、list、interval
1. 分区键违反约束
1. 约束列的数据类型：字符型、数值型、日期型、bool型
1. 组合列约束
1. 同时违反多个约束
1. 行内约束、行外约束
1. 删除约束后重建，再次导入
1. 修改约束后再次导入
1. 约束语法覆盖：using index create_index_clause、enable|disable等
|具体错误码|
|  
|唯一索引冲突：ERR_ANK_DUPLICATED_KEY,YAS-02030,Message：unique constraint%s violated,Action：删除唯一性约束或不要插入这一行。||分区键/分布键长度超过4千|
|  
|外键约束的错误码：,ERR_ANK_FK_CHILD_FOUND ,YAS-02034 —— 在update或delete父表中主键时会出现。yasldr只支持insert。lsc不支持外键,Message：foreign key constraint (%s.%s) violated: child found,Action：删除子表中依赖父表的数据或禁用约束后重试该操作。,ERR_ANK_FK_PARENT_NOT_FOUND,YAS-02033,Message：foreign key constraint (%s.%s) violated: parent key not found,Action：删除外键或添加匹配的主键。||  
|
|  
|主键约束||  
|
|  
|非空约束，  属于check约束？,YAS-04006,Message：cannot insert NULL value to column %s,Action：无法在该列中插入NULL值。||  
|
|无法容错场景|表空间满|  
|  
|
|  
|磁盘满|  
|  
|
|  
|nologging表损坏|  
|  
|
|  
|lsc去重发生死锁|  
|  
|
|  
|csv单行超过csv_line_size*2|  
|  
|
|  
|yasldr/load data语句解析错误|  
|  
|
|  
|infile/log/bad/discard文件权限不正确、路径不正确|  
|  
|
|basic模式|不涉及|  
|batcherror——后续待确定|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

[容错白名单优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDQ4OTcwYzJhZjRmNTIwZmRiIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjgyLCJleHAiOjE3ODIzOTE2ODJ9.qjrMWC_OKZblHIrT0AC8ism1cFLMfVaj7pjleC9ySzE)

备注：存量用例已基本覆盖上述测试点。主要分析上车工程，挑选测试点进行补充

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


  


- 本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDRhMWFkOWEzMzExZGM4ZTRiIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjgyLCJleHAiOjE3ODIzOTE2ODJ9.pws0YiDUuUVnCU-nl07V-1C9Epk58E7CanVhubo5rtY)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDRhMWFkOWEzMzExZGM4ZTRiIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjgyLCJleHAiOjE3ODIzOTE2ODJ9.pws0YiDUuUVnCU-nl07V-1C9Epk58E7CanVhubo5rtY)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDQ4OTcwYzJhZjRmNTIwZmRjIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjgyLCJleHAiOjE3ODIzOTE2ODJ9.mBq2i05k7mho5-AHLXWb1Iih0HPrBhP-2RDYKNDMPjE)

 (application/msword)    


[容错白名单优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDRhMWFkOWEzMzExZGM4ZTRjIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjgyLCJleHAiOjE3ODIzOTE2ODJ9.rBtxN2tttVl1tLMU5H1xqEN19k8g-0K4iQDPbe96A9s)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[容错白名单优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDQ4OTcwYzJhZjRmNTIwZmRiIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MjgyLCJleHAiOjE3ODIzOTE2ODJ9.qjrMWC_OKZblHIrT0AC8ism1cFLMfVaj7pjleC9ySzE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计评审纪要,与会人：陈钦卿、范瑜、贺国峰    
  评审时间：2024.05.20 17:00:00,会议纪要,1、白名单函数所在文件： src/storage/access/ank_accessor.c： ankInsertOccurFatalError    
  2、不涉及basic模式    
  3、错误码对照列表：    
  ERR_ANK_CHECK_CONS_VIOLATE: YAS-02254    
  ERR_ANK_FK_CHILD_FOUND: YAS-02034    
  ERR_ANK_FK_PARENT_NOT_FOUND: YAS-02033    
  ERR_ANK_DUPLICATED_KEY: YAS-02030,Posted by chenqinqing at 五月 20, 2024 17:23|
|---|
