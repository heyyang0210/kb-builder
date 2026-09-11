Created by 李攀, last modified on 十二月 12, 2023

#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述设置统计信息选项的测试设计。

SR链接：

  [YDBRD-22753 : gather database/schema支持表间并行](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)    （22.2）

  [YDBRD-22801 : gather database/schema支持表间并行](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)    （23.2）

开发设计文档：    [gather database/schema支持表间并行 - 郑翌恺 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135604725)  

  


  


#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

1. gather database/schema支持表间并行


       2. 修复gather_index_stats参数degree为负数时可以正常运行的问题，现在会拦截

       3. 修复gather_database_stats参数degree不生效的问题

  


该需求针对  GATHER_DATABASE_STATS  和GATHER_SCHEMA_STATS 方式收集统计信息的时候支持多表间并行收集，之前是不支持表间并行，只支持表内并行。

最直观的感知就是在表和数据量多的情况下收集统计信息的性能比之前要快。不同并行度会影响收集的快慢。通过执行时间长短来判定，目前没有相关视图可以查询。

通过  degree 参数设置  并行度

**功能限制：**

**设置DEGREE可以支持多线程同时收集DB下的不同表的统计信息，线程数由DEGREE的值决定，未设定的话默认为1**

Degree为int类型，范围1-128

用户输入degree>128不会拦截，会按照128处理

用户输入degree=0不会拦截，会按照degree默认值处理

用户输入degree<0会拦截

  


支持部署模式：单机

  


# **3. 测试**  **设计方法**   

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

2.对比不同并行度的执行时间长短

3.收集的结果的准确性验证 

  


|专项|是否涉及,  
|
|:---|:---|
|CT|是|
|长稳|  
|
|一致性|  
|
|安全|是|
|HA|是|
|压力|  
|
|性能|是|
|资料|是|


  


# 4.   **详细测试设计**

  


|测试项|输入条件1（存储过程）|有效等价类|无效等价类|备注|  
|
|:---|:---|:---|:---|:---|:---|
|degree入参测试|GATHER_DATABASE_STATS|入参是类型是0-128的int类型|<0  会拦截|  
|  
|
|  
||0|  
|按dgree默认值处理|  
|
|  
||>128的数字  129|非int类型数字：1.1,1.0,'1'|  
|  
|
|  
||  
|非number类型常量，,其他类型变量：time，date，timestamp，interval，blob,boolean,  
|报错拦截|  
|
|  
|GATHER_SCHEMA_STATS|入参是类型是0-128的int类型|<0  会拦截|  
|  
|
|  
|  
|0|  
|按dgree默认值处理|  
|
|  
|  
|>128的数字  129|非int类型数字：1.1,1.0,'1'|  
|  
|
|  
|  
|  
|非number类型常量，,其他类型变量：time，date，timestamp，interval，blob,boolean,  
|  
|  
|
|  
|gather_index_stats|  
|  
|修复gather_index_stats参数degree为负数时可以正常运行的问题，现在会拦截|  
|
|  
|并行度>表数量|  
|  
|正常收集|  
|
|视图|  
|  
|并行收集后查看视图数据是否准确|  
|  
|
|explain|  
|并行收集统计信息后|  
|  
|  
|
|统计信息权限|  
|  
|  
|  
|  
|
|ha|  
|主机收集后备机可以正常查询结果|  
|  
|  
|
|并发收集|  
|启动多个yasql同时执行表间并行的操作|  
|  
|  
|
|gather database时候是按照schema还是表先并行的|  
|  
|  
|  
|  
|
|gather database时候删掉schema|  
|  
|  
|  
|  
|
|索引并行验证|  
|  
|  
|  
|  
|
|set_prefs使用默认值的方式性能验证|  
|  
|  
|  
|  
|


  


**性能验证场景：**

|测试项|输入条件1（存储过程）|输入条件2(操作步骤)|预期|备注|
|:---|:---|:---|:---|:---|
|不同并行度的性能快慢对比|GATHER_DATABASE_STATS 普通heap表|创建 10张表，每张insert 1000数据,对比 dgree 为 1，2，10 时候的执行时间|  
|  
|
|  
|  
|创建 128张表，每张insert 1000数据,对比 dgree 为 1，2，10，50，100，128 时候的执行时间|  
|  
|
|  
|  
|创建 1000张表，每张insert 1000数据,对比 dgree 为 1，2，10，50，100，128 时候的执行时间|  
|  
|
|  
|  
|表的数量为1 ，degree1，10，128时候的时间对比|无明显差距|  
|
|  
|  
|表的数量为10 ，每张insert 1000数据，degree10，150，128时候的时间对比|无明显差距|  
|
|  
|GATHER_DATABASE_STATS 普通lsc表|  
|  
|  
|
|  
|GATHER_DATABASE_STATS 普通ltac表|创建 10张表，每张insert 1000数据,对比 dgree 为 1，2，10 ,128时候的执行时间|并行越大执行时间越快，并行度<=表数量|  
|
|  
|GATHER_DATABASE_STATS hea分区表|创建 10张表，覆盖range,list,hash分区，二级分区表每张insert 1000数据,对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|
|  
|GATHER_DATABASE_STATS tac,lsc分区表|创建 10张表，覆盖range,list,hash分区，二级分区表每张insert 1000数据,对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|
|  
|  
|创建 10张表，覆盖range,list,hash分区，二级分区表每张insert 1000数据，并创建分区索引,对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|
|  
|GATHER_DATABASE_STATS|不建任何表，对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|
|  
|GATHER_SCHEMA_STATS |sys用户执行，不建任何表，对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|
|  
|  
|其他有统计信息权限的用户执行：,创建 10张表，覆盖range,list,hash分区，二级分区表，普通表，每张insert 1000数据,对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|
|  
|  
|其他有统计信息权限的用户执行：,创建 10张表，覆盖range,list,hash分区，二级分区表，普通表，创建索引类型有：普通索引，函数索引，分区local索引，反向索引，unique索引，每张insert 1000数据，覆盖到所有数据类型,对比 dgree 为 1，2，10 ,128时候的执行时间|  
|  
|


  


  


# 5.   **测试用例**

[表间并行.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGZhMWFkOWEzMzExZGM4M2UxIiwicmVmX2lkIjoiNjczOTZiOGY1OTNmOTljOWZmMjM2NDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDg0LCJleHAiOjE3ODIzODE4ODR9.TRZL5N6Stt8pSzfrmBLT36diJLPE-g1wx2j8Jle9I38)

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

  


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：

  


  


## Attachments:

[表间并行.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGZhMWFkOWEzMzExZGM4M2UxIiwicmVmX2lkIjoiNjczOTZiOGY1OTNmOTljOWZmMjM2NDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDg0LCJleHAiOjE3ODIzODE4ODR9.TRZL5N6Stt8pSzfrmBLT36diJLPE-g1wx2j8Jle9I38)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
