Created by 刘清萍, last modified on 二月 01, 2024

# **1. 概述**

本文描述hash join性能优化功能的测试设计。

SR：    [YDBRD-23035](https://jira.yasdb.com/browse/YDBRD-23035?src=confmacro)    -  hash join性能优化  完成

开发设计文档：    [HashJoin性能优化设计文档 - 陈楚坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135611238)  

测试文档：    [hash join性能问题分析和优化方向 - 陈楚坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135606968)  

# **2. 需求分析**

需求描述：  华润银行单机行存部署形态，hash join性能与oracle差距较大。原有的代码实现存在明显的性能问题，需进行重构优化。

# **3. 测试**  **设计方法**   

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

2.对比结果和master执行结果是否一致

  


  


|专项|是否涉及,  
|测试点|
|:---|:---|---|
|CT|-|  
|
|长稳|-|  
|
|一致性|-|  
|
|安全|-|  
|
|HA|-|  
|
|压力|-|  
|
|性能|是|测试和没有优化之前的性能对比|
|资料|-|  
|


# 4.   **详细测试设计**

**改点：**

规格没变，配置参数名变了，都设置成隐藏参数了，BUFFER_SIZE现在改名为_HASH_AREA_SIZE,新增了_HASH_JOIN_ALGORITHM，用于指定hash join使用的算法，默认是1，表示新的算法，0表示使用旧的算法。其他参数都删了

_HASH_AREA_SIZE= must be between 8388608 and 8589934592

alter system set _HASH_AREA_SIZE = 8388608 scope = memory;

|输入条件|一级条件|二级条件|备注|
|---|---|---|---|
|数据类型|覆盖所有数据类型|  
|包含null值、重复值|
|select投影|覆盖所有数据类型|  
|包含null值、重复值|
|  
|投影大小|投影列规格|投影列UDT类型（老代码|
|  
|投影列加入lob----t3.*已覆盖|聚合函数|lob不支持joinon后比较|
|distinct|  
|  
|  
|
|orderby limit|  
|  
|  
|
|join类型|left join,right join,full join,inner join,semi,anti,where on|差一个right join,  
|最新改动：：：：规格没变，配置参数名变了，都设置成隐藏参数了，BUFFER_SIZE现在改名为_HASH_AREA_SIZE,新增了_HASH_JOIN_ALGORITHM，用于指定hash join使用的算法，默认是1，表示新的算法，0表示使用旧的算法。其他参数都删了|
|统计信息|有统计信息情况下|  
|  
|
|  
|无统计信息情况下|  
|  
|
|  
|统计信息失效|  
|  
|
|数据量小|**不分区**|  
|查看分区情况|
|数据量大|分区|  
|  
|
|换入换出|  
|  
|  
|
|计划情况|  
|  
|  
|
|  
|  
|  
|  
|




# 5.   **测试用例**

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、行存|


  


# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **8. 工作量评估**

工作量：5人/天

计划测试完成时间：2024/1/30

  


测试设计评审纪要    
    
  与会人：刘清萍、赵育、陈楚坤    
    
  评审时间：2023/12/6 10：00-11：00    
    
  评审地点：腾讯会议    
  会议主题：索引filter优化测试设计评审    
    
  评审纪要信息：

             1.优先跑上车工程 保证存量用例没有问题

             2.合入后关注代码覆盖率工程

             3.分区情况打开debug日志 partCount会大于1

             4.换入换出关注 select SWAP_OUT_COUNT from V$VMSTAT where sid = userenv('sid');

  
  评审通过与否：通过

  


  


  


## Attachments:

[image2023-12-6_10-18-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjNhMWFkOWEzMzExZGM4NGQyIiwicmVmX2lkIjoiNjczOTZiYjM1OTNmOTljOWZmMjM2NjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDA4LCJleHAiOjE3ODIzODI4MDh9.p33dK4qTTUSTSXd972oaZOMNtL0VgOIyZwJBCAP1c_w)

 (image/png)    


[image2023-12-6_10-19-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjM4OTcwYzJhZjRmNTIwNjViIiwicmVmX2lkIjoiNjczOTZiYjM1OTNmOTljOWZmMjM2NjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDA4LCJleHAiOjE3ODIzODI4MDh9.Uih8JlYgMjDw_AZ6csueZBk7KocQt1qWofFbTYEgT0w)

 (image/png)    


[hashjoin文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjNhMWFkOWEzMzExZGM4NGQzIiwicmVmX2lkIjoiNjczOTZiYjM1OTNmOTljOWZmMjM2NjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDA4LCJleHAiOjE3ODIzODI4MDh9.Zj9LIdwMTRC4O82I8EQLQ2b1Beu7lu90-2QSNexIz3A)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
