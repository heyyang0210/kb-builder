Created by 马爽, last modified on 十月 21, 2024

SR链接：    [https://pingcode.yasdb.com/pjm/items/6705240de489dd0868f2213f](https://pingcode.yasdb.com/pjm/items/6705240de489dd0868f2213f)    ?    
  #YDBRD-33508 支持gv$event_name视图

开发文档：  [https://pingcode.yasdb.com/wiki/pages/67396f09593f99c9ff238c4a](https://pingcode.yasdb.com/wiki/pages/67396f09593f99c9ff238c4a)  

# 1. 概述

支持v$event_name和gv$event_name视图，记录等待事件的合集

# 2. 需求分析

## 2.1 功能点分析

v$event_name视图记录了当前的等待事件，它  提供了必须等待处理的会话的有关信息，具体字段如下：

|字段|数据类型|含义|
|:---|:---|:---|
|EVENT_ID|NUMBER|等待事件的标识符|
|NAME|VARCHAR2(64)|等待事件名称|
|WAIT_CLASS_ID|NUMBER|等待事件所属类的标识符|
|WAIT_CLASS#|NUMBER|等待事件所属类的编号|
|WAIT_CLASS|VARCHAR2(64)|等待事件所属类的名称|


其中  **EVENT_ID和NAME**  字段分别对应  **v$system_event**  中的  **EVENT_ID**  字段和  **EVENT**  字段，需要保持一致；

**WAIT_CLASS_ID、WAIT_CLASS#、WAIT_CLASS**  字段分别对应  **v$system_wait_class**  视图中  **WAIT_CLASS_ID、WAIT_CLASS#、WAIT_CLASS**  字段。

  


该需求主要是针对v$event_name和gv$event_name视图进行测试，重点从以下两方面进行验证：

- 包含等待事件的信息在视图中是否可正常显示，字段正确、无乱码
- 显示结果对比v$system_event、v$system_wait_class  数据是否正确


## 2.2 规格约束

- 需求范围：单机、分布式、集群
- 规格约束不涉及


# 3. 详细测试设计

## 3.1 测试设计方法

主要使用等价类和场景分析法进行测试：

1、需要包含不同的等待事件的信息

2、验证各个场景下等待信息显示是否正确

3.2 详细测试设计

**1、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


**2、基本测试场景**

|编号|测试项|测试场景|预期|备注|
|---|---|---|---|---|
|1|视图字段校验|desc v$event_name;,desc gv$event_name;|视图结构与设计文档一致|  
|
|2|  
|构造等待事件，查看视图，与v$system_event、v$system_wait_class  数据比对|对应字段保持一致|  
|
|3|  
|主备环境下，备机查询视图，备升主后，旧主查询视图|主备正常同步|  
|
|4|视图权限交互|创建用户未赋权查询视图失败，赋权后查询成功|赋权后查询成功|  
|
|5|  
|视图写操作拦截（create、create as select、drop、alter、dml）|写操作被拦截|  
|
|6|  
|视图select查询验证（select 不带filter、带filter、group by、join、子查询、having、distinct、order by、limit)|查询结果匹配准确|  
|
|7|CT|多session、多实例并发查询视图|实例不core不卡|  
|
|8|  
|多session、多实例DML/DDL业务和查询视图并发|实例不core不卡|  
|
|9|KT|多session、多实例并发查询视图+kill|实例不core不卡|  
|
|10|  
|多session、多实例DML/DDL业务和查询视图并发+kill|实例不core不卡|  
|
|11|版本升级|单机/分布式/集群从其他版本升级到23.4版本，查看视图|v$event_namegv$event_name视图查询成功|目前是否支持升级?|


# 4. 测试用例

1.测试设计评审时提供冒烟文本用例；

|序号|测试场景|预期|
|:---|:---|:---|
|1|desc v$event_name;,desc gv$event_name;|视图可正确显示等待事件信息|
|2|v$event_name和gv$event_name权限控制|权限正常|


2.启动测试之前提供文本用例，并完成大部分自动化用例；

# 5. 测试框架设计

|用例类型|用例路径|用例个数|备注|
|---|---|---|---|
|yasft|/system_view/event_name|17,（5+5+7）|  
|
|ha主备|  [ha/ha_heap/testcase/ha_schedule_common/Dynamic_view · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_common/Dynamic_view)  |1|  
|
|CT/KT|  [standalone/storage_testcase/view/v_view · master · CoD-X / Yastest Dfx · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/standalone/storage_testcase/view/v_view)  |2|  
|


# 6. 测试环境说明

linux arm机器

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2024/10/22

实际测试完成时间：2024/10/21



