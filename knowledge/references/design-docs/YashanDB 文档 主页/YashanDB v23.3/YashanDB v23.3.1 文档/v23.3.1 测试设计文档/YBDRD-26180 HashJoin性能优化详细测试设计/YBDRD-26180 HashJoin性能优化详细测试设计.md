Created by 刘清萍, last modified on 八月 02, 2024

# **1. 概述**

本文描述hash join性能优化功能的测试设计。

SR：    [https://pingcode.yasdb.com/pjm/items/6618e9f7fd997db58ad83345](https://pingcode.yasdb.com/pjm/items/6618e9f7fd997db58ad83345)    ?    
  #YDBRD-26180 HashJoin性能优化

开发设计文档：    [YDBRD-26180 HashJoin性能优化设计文档 - 陈楚坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159422004)  

  


# **2. 需求分析**

需求描述：  在行存引擎跑批生成报表的场景，数据量大，表达式计算复杂，YashanDB和Oracle在SQL引擎的计算效率上的差距非常明显，性能通常落后2到10倍之间，客户对性能提升述求明确。 通过对聚集函数场景指令分布分析，SQL引擎和存储引擎指令数量各占比50%，即使没有SQL引擎，YashanDB仍然与Oracle有性能差距。因此优化执行代码无法解决成倍的性能差距。

# **3. 测试**  **设计方法**   

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

2.对比结果和master执行结果是否一致

  


|专项|是否涉及,  
|测试点|
|:---|:---|---|
|CT|-|是|
|KT|  
|  
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
|可维护性|是|开关参数设置|
|性能|是|单算子测试工程新建|
|资料|-|  
|
|功能工程|是|三层新建工程---看护开启开关后用例执行情况|
|覆盖率工程|是|合入后开发跑一下覆盖率|


# 4.   **详细测试设计**

alter session set _BATCH_ENABLED=ON;    
  alter session set _BATCH_SIZE=64;

alter session set _BATCH_ENABLED=OFF;    
  alter session set _BATCH_SIZE=256;

--关掉blom过滤器

--是否强制分区

ALTER SESSION SET _HASH_JOIN_FORCE_PARTITION = TRUE;

|ALTER SESSION SET statistics_level=ALL;|
|:---|


--  statistics_level  开启开关后 插入数据速度变慢

打开后执行的过程会记录一些统计信息 影响性能

|数据分布|  
|
|---|---|
|倾斜度（distinct值|重复值多|
|乱序插入|  
|
|顺序插入|  
|
|  
|  
|


|输入条件|一级条件|二级条件|备注|
|---|---|---|---|
|用例复用改写|  
|  
|  
|
|开关测试|  
|  
|  
|
|select投影------覆盖所有数据类型|覆盖所有数据类型-----  需要补充完善|  
|包含null值、重复值|
|  
|投影大小|投影列规格|投影列UDT类型------array（数组）函数？？？？？待确认主干表现dev|
|  
|投影列加入lob----t3.*已覆盖|聚合函数|lob不支持joinon后比较|
|  
|  
|  
|select 列函数-------------------left join|
|  
|  
|  
|  
|
|case when|  
|  
|  
|
|on后条件数据类型不一致|  
|  
|  
|
|并发在上车之前跑|  
|  
|  
|
|数据倾斜场景|重复值多-------覆盖所有join类型|nested loop hash join|  
|
|orderby limi|count、sum------性能看护|数值类型就用sum，字符类型就用min、max|小数据量 ----不用聚集|
|group by|  
|  
|  
|
|join类型|inner join|包含下推filter  select * from t1 join t2 on     [t1.id](http://t1.id)    =    [t2.id](http://t2.id)     where t1.age>10|是否支持,in、exists（限制）子查询-------（改写）,any、all、some,and、or,下推fiter覆盖|
|  
|where on|  
|  
|
|  
|left join|（覆盖outer转inner）|  
|
|  
|right join|（覆盖outer转inner）|  
|
|  
|full join|（覆盖outer转inner）|  
|
|  
|right semi|  
|  
|
|  
|right anti|  
|  
|
|  
|hash group by|换入换出|  
|
|on条件|on t1.id = t2.id and t1.age +t2.age = t2.classs|  
|  
|
|开关|batch size |64-256|  
|
|  
|_HASH_JOIN_FORCE_PARTITION（分区数有统计信息确定）|用于强制执行分区，当该值为True时，无论build表数据多大，都会执行分区。配置项默认值为False。|  
|
|  
|_HASH_AREA_SIZE---------是否完全依赖此参数-----设小 看一下4096分区|hash join单个分区可使用的最大内存大小，默认32MB，最小8M，最大8G。当hashtable的大小小于该值时，不会执行分区，会把整个hashtable放在内存。-------------  -改小利于测试|- 2.最大支持4096个分区。
- 3.单个分区Hash Map的最大大小为4096K。------无限制
|
|  
| statistics_level|  
|  
|
|统计信息|有统计信息情况下|  
|  
|
|  
|无统计信息情况下|  
|  
|
|  
|统计信息失效-------------分区变大 分区变小|repartition是初始评估小了，后面扩展，通过先插入少量数据，收集统计信息，然后再插入数据，不收集统计信息来复现|  
|
|数据量小|不分区、分区|  
|  
|
|数据量大|分区、不分区|查看分区情况------通过set autotrace on查看|ALTER SESSION SET statistics_level=ALL; SET AUTOTRACE ON;可查看Hash Join的监控指标，包括分区数、分区大小等。|
|分区数量|  
|  
|  
|
|换入换出| select SWAP_OUT_COUNT from V$VMSTAT where sid = userenv('sid');|  
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


![](https://pingcode.yasdb.com/atlas/files/public/67396e2d8970c2af4f521718/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA5MTUsImV4cCI6MTc4MjM4MTcxNX0.EmwnzlyuR7G2Y0j2ctEsMGj7DqsPzKokncz0fBZZWlI)

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

计划测试完成时间：

  


测试设计评审纪要    
    
  与会人：    
    
  评审时间：    
    
  评审地点：腾讯会议    
  会议主题：    
    
  评审纪要信息：



  
  评审通过与否：通过

## Attachments: