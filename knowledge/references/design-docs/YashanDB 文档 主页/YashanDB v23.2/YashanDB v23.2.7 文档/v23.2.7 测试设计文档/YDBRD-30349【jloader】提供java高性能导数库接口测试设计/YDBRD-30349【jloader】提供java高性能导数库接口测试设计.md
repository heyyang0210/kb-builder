Created by 谢昭贤, last modified on 十月 16, 2024

# YDBRD-30349【jloader】提供java高性能导数库接口

  


-   [YDBRD-30349【jloader】提供java高性能导数库接口](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-YDBRD-30349【jloader】提供java高性能导数库接口)  
-   [](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-)  
-   [1. 概述](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-1.概述)  
    -   [1.1 相关文档](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-1.1相关文档)  
    -   [1.2 特性说明](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-1.2特性说明)  
-   [2. 需求分析](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-2.2应用场景)  
    -   [2.3 规格约束](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-2.3规格约束)  
-   [3. 详细测试设计](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-3.2详细测试设计)  
        -   [3.2.1 DFX测试](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-3.2.1DFX测试)  
        -   [性能测试表](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-性能测试表)  
        -   [3.2.2 等价类](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-3.2.2等价类)  
        -   [性能测试等价类](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-性能测试等价类)  
-   [4. 测试用例](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-4.测试用例)  
    -   [4.1 冒烟用例](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-4.1冒烟用例)  
    -   [4.2 文本用例](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-4.2文本用例)  
-   [5. 测试框架设计](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD30349【jloader】提供java高性能导数库接口测试设计-7.工作量评估)  


# 1. 概述

## 1.1 相关文档

SR:     [YDBRD-30349 【jloader】提供java高性能导数库接口](https://pingcode.yasdb.com/pjm/items/6694c26a66228b947073d3ee)  

开发设计文档：    [fastLoad](fastLoad_159423588.html)      [https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/38798](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/38798)  

  [MR文档](http://192.168.4.108/houzhonglin/master/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/FastLoader%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/FastLoader%E4%BD%BF%E7%94%A8%E7%A4%BA%E4%BE%8B.html)  

个人调研文档：    [4.1.0【个人调研】YDBRD-30349](https://conf.yasdb.com/pages/viewpage.action?pageId=163008438)  

调研文档：

概要设计文档：

## 1.2 特性说明

spark生态对接目前直接调用JDBC接口进行数据导入，在  **分布式场景下**  ，相较于业界其他工具，导入性能较差。

参考yasldr性能好，使用批量插入的协议。但是JDBC目前不支持像yasldr那样的  **批量插入的协议**  ，所以需要一版java版本的fastLoad，提供像yasldr的功能一样，提升数据导入性能。

  


# 2. 需求分析

## 2.1 功能点分析

|  
|方法|参数说明|说明|
|---|:---|:---|---|
|配置相关|setColumnNames(String columnNames)|[1] columnNames： 要插入表数据的列名称。支持插入部分列，不设置表示默认插入所有列数据。|设置需要插入的列名称。|
|  
|setReaderCount(int readerCount)|[1] readerCount： 执行读取解析数据的线程的个数。|设置读取线程的个数，默认2个。|
|  
|setSenderCount(int senderCount)|[1] senderCount： 执行发送数据的线程的个数。|设置发送线程的个数，默认2个，建议设置为CPU的核数。|
|  
|setSendCountAtOnce(int sendCountAtOnce)|[1] sendCountAtOnce： 每次发送数据的行数。|设置Sender线程每次发送数据的行数，默认10000行。|
|  
|setCommitCount(int commitCount)|[1] commitCount： 提交事务行数，值为0时表示设置bulkLoad属性，即中途不提交，只有LSC表生效。|设置发送多少行提交一次事务，默认中途不提交执行插入完以后提交。|
|  
|setMaxWaitLineCount(int maxWaitLineCount)|[1] maxWaitLineCount： 最大等待发送行数，值为0时表示不控制等待发送行数。|设置最大等待发送行数，默认不控制等待发送行数。此参数用于控制在内存中的待发送数据大小。|
|  
|setIsDeduplicated(boolean deduplicated)|[1] deduplicated： 是否允许重复数据。|设置是否允许重复数据，默认为false。若设置为true，出现重复数据时会执行update操作。    
  使用deduplicated属性（设置为true）必须符合如下要求：    
  * generatefastLoader()的mode为batch。    
  *** 待导入数据的表类型为LSC表。**    
  * setCommitCount()的commitCount为0。,否则报错。|
|功能相关接口|generatefastLoader(String mode, String ipPort, Properties info)|[1] mode： 支持插入数据的模式，有BASIC和BATCH两个可选值，BASIC表示使用基础模式导入，BATCH表示使用批量模式导入。    
  [2] ipPort： 要插入的数据库ipPort。    
  [3] info： 创建connection相关的参数。|创建对应模式的FastLoader。|
|  
|prepare(String tableName)|[1] tableName： 要导入数据的表名。|准备执行。|
|  
|execute()|  
|开始执行。开始执行以后，导入相关的后台线程开始运行。|
|  
|putData(List<List<Object>> data)|[1] data： 要导入的表数据。|传入的数据，在fastLoad结束前可以多次调用，如果待发送行数达到最大待发送行数maxWaitLineCount的话，就返回false表示传入数据失败，需要等待一段时间再重新传入数据，传入成功返回true。|
|  
|abort()|  
|强行中断此次导入。|
|  
|finish()|  
|结束传入数据。finish以后不能继续进行putData传入数据操作。|
|  
|close(long timeout, TimeUnit unit)|[1] timeout： 超时时间。    
  [2] unit： 超时单位。|关闭FastLoader，并释放FastLoader资源。接口会阻塞式等待数据导入完成再结束释放资源。若未在超时时间范围内结束，则抛出InterruptedException异常。|
|获取执行进度相关接口|getProgress()|  
|获取执行进度的类。|
|  
|getTotalCount()|  
|获取全部数据行数。|
|  
|getErrorCount()|  
|获取执行错误数据行数。|
|  
|getInsertedCount()|  
|获取已插入数据行数。|
|  
|getPercentage()|  
|获取执行进度百分比（0-100）。|
|  
|getErrorMsg()|  
|获取所有错误信息。|


  


## 2.2 应用场景

1）spark生态对接目前直接调用JDBC接口进行数据导入，在分布式场景下，使用fastLoad进行导入

2）

## 2.3 规格约束

1）  FastLoader有严格的执行顺序，数据导入完成后必须调用close()接口关闭FastLoader，且执行close()后不能再调用prepare，execute等接口。

2）不支持CSV格式数据解析，  **需要用户自己读取csv文件为data，故**  **不支持行外lob形式**

3）不支持数据粒度切分，  **需要用户自己定义数据块、数据批次**

4）不支持user.table的形式，导入的表，需要是info里面的user的表

5）

6）

  


# 3. 详细测试设计

## 3.1 测试设计方法

1）使用等价类划分、边界值覆盖

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|  
|
|---|---|---|---|
|CT并发|  
|  
|  
|
|KT|  
|  
|  
|
|长稳|  
|  
|  
|
|一致性|  
|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|  
|
|安全|  
|  
|  
|
|DFR故障|  
|  
|  
|
|HA高可用|  
|  
|  
|
|压力|  
|  
|  
|
|性能|是|环境对齐、数据库参数对齐,  
,  
,**数据类型**,1、同样大小的csv文件，对比和yasldr的导入性能（单位MB/s），注意设置同样的参数条件,2、  basic、batch两种模式的性能（主要batch？）,3、  **比较策略**,     a. yasldr命令执行整体时间 减去 reader里面的io_cost,     b. fastload ： 从 f  astLoader  .  execute  (); 到   fastLoader  .  putData  (  data  ); 到   fastLoader  .  finish  (); 的时间,  
,  
,4、策略  （机器可用内存为10G情况）,    a. 一次put 10G   ,    b. 一次put 1G （     小数据，一次put完   ）,  
,**观察jvm是否频繁full gc**,  
,**资源消耗、jvm调优**,  
,**cpu、数据库节点状态**,  
,  
|参数待调优,内存泄漏、工程执行长时间,维度：,1、工具设计目标： 持平、80%  （写性能）,2、端到端，生态工具适配后的性能,**库本身性能看护**|
|  
|yasldr|  
|fastload|  
|
|读线程数|READER_CNT|READER_CNT=MIN(SLICE_CNT, DOP - SENDER_CNT),1、  READER_CNT =   SLICE_CNT = FILE_SIZE / CHUNK_SIZE,2、  READER_CNT = DEGREE_OF_PARALLELISM   - SENDER_CNT|setReaderCount(int readerCount)|  
|
|发线程数|SENDERS|  
|setSenderCount(int senderCount)|  
|
|  
|BATCH_SIZE|单个sender线程发送到服务端的最大数据条数|setSendCountAtOnce(int sendCountAtOnce)|每次发送数据的行数|
|  
|COMMIT_ROWS|  
|setCommitCount(int commitCount)|  
|
|  
|  
|  
|setMaxWaitLineCount(int maxWaitLineCount)|最大等待发送行数，值为0时表示不控制等待发送行数。|
|数据|csv 10G大小文件  ， 300W行以上数据||||
|数据批次|**CSV_CHUNK_SIZE**|= 128M|**分批次的putdata（构造数据）**|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
||||
|可维护性|  
|  
|  
|


|  
|yasldr|  
|fastload|  
|
|---|---|---|---|---|
|读线程数|READER_CNT|READER_CNT=MIN(SLICE_CNT, DOP - SENDER_CNT),1、  READER_CNT =   SLICE_CNT = FILE_SIZE / CHUNK_SIZE,2、  READER_CNT = DEGREE_OF_PARALLELISM   - SENDER_CNT|setReaderCount(int readerCount)|  
|
|发线程数|SENDERS|  
|setSenderCount(int senderCount)|  
|
|  
|BATCH_SIZE|单个sender线程发送到服务端的最大数据条数|setSendCountAtOnce(int sendCountAtOnce)|每次发送数据的行数|
|  
|COMMIT_ROWS|  
|setCommitCount(int commitCount)|  
|
|  
|  
|  
|setMaxWaitLineCount(int maxWaitLineCount)|最大等待发送行数，值为0时表示不控制等待发送行数。|
|数据|csv 10G大小文件  ， 300W行以上数据||||
|数据批次|**CSV_CHUNK_SIZE**|= 128M|**分批次的putdata（构造数据）**|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
||||


### 性能测试表

  [https://jira.yasdb.com/browse/SAISSUE-640?filter=15060](https://jira.yasdb.com/browse/SAISSUE-640?filter=15060)  

|  
|参考表名(jiashi poc)|表类型|列数|分区数|分区类型|  
|
|---|---|---|---|---|---|---|
|  
|ds_batch_log|  
|  
|  
|  
|  
|
|  
|ds_cust_profile|  
|  
|  
|  
|  
|
|  
|ds_corecust_retcompare|  
|  
|  
|  
|  
|
|  
|ds_cust_group_detail|  
|  
|  
|  
|  
|
|  
|ds_ast_ret_tran_cust_prod_agent|  
|  
|  
|  
|  
|
|  
|ds_tfixprotocol|  
|  
|  
|  
|  
|
|  
|ds_prod_info|  
|  
|  
|  
|  
|
|  
|ds_fix_schema|  
|  
|  
|  
|  
|
|  
|cal|  
|  
|  
|  
|  
|
|  
|ds_cust_label|  
|  
|  
|  
|  
|
|  
|ds_corecust_health_score|  
|  
|  
|  
|  
|
|  
|cdw_dws_core_cust_risk_d|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|


### 3.2.2 等价类

### 性能测试等价类

|序|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|  
|  
|部署形态|单机,分布式,集群|  
|  
|  
|
|  
|  
|导入模式|basic,batch|  
|  
|  
|
|  
|  
|节点个数|dn数：,  1-1,  1-2,  2-1,  2-2,ce数,  ce 2,单机主备,  db 2|  
|  
|  
|
|  
|  
|直连节点类型|分布式：,CN,DN|  
|  
|  
|
|  
|  
|表结构|heap,lsc,tac,分布表（单dn，多dn会报错,  [YDBRD-18189 【分布式导入】yasldr直连DN导数报错，显示导入0条，实际导入2条。需要适配YAS-02677 virtual partition is not operational, distribution information is incorrect的容错](https://pingcode.yasdb.com/pjm/items/66114af7579a3edb84d64d00)    ）,复制表|  
|  
|  
|
|  
|  
|列数|4列,40列,400列,4096列|大量列大宽表|  
|  
|
|  
|  
|分区个数|二级分区,hash（1024）,hash（2048）,hash（4096）,hash（8192）,hash（16384）|  
|  
|  
|
|  
|  
|分区类型,组合分区类型|一级分区（7）,二级分区hash（28*7=196）,二级分区range（28*7=196）|  
|  
|  
|
|  
|  
|分区键数|1个,8个,16个|  
|  
|  
|
|  
|  
|数据内容|纯ascii,gbk,utf8 中文|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


## 4.1 冒烟用例

```
1.
```

  


## 4.2 文本用例

文本用例：

[X_文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGU4OTcwYzJhZjRmNTIxNjdjIiwicmVmX2lkIjoiNjczOTZlMGU3MjgyMDZlZmI5MmYyNTZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTE3LCJleHAiOjE3ODI0MDAzMTd9.9PKigmqsEZj6ue-uF2qPAbjIBatmPp4F_jFcio9_TZA)

属性表：

# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


1） 自动化用例：

TestNG + ExtentReports 的java测试框架，后续上架工程。

![](https://pingcode.yasdb.com/atlas/files/public/67396e0ea1ad9a3311dc94f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUVBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5MTcsImV4cCI6MTc4MjMyNDcxN30.gp-CJ5IdClQYziUllsBE7V8t_nFgPcpSsDovGBLin9w)

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.104|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.114.2.el7.x86_64|50G|303G|HDD|


# 7. 工作量评估

工作量：天

计划测试完成时间：

  


## Attachments:

[X_文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGU4OTcwYzJhZjRmNTIxNjdjIiwicmVmX2lkIjoiNjczOTZlMGU3MjgyMDZlZmI5MmYyNTZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTE3LCJleHAiOjE3ODI0MDAzMTd9.9PKigmqsEZj6ue-uF2qPAbjIBatmPp4F_jFcio9_TZA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-22421.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGU4OTcwYzJhZjRmNTIxNjdkIiwicmVmX2lkIjoiNjczOTZlMGU3MjgyMDZlZmI5MmYyNTZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTE3LCJleHAiOjE3ODI0MDAzMTd9.A0rqq-rUzBn0AvG4SuuIryq9BmeXG-gEfP9Izso6fXU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[TESTCASE_YDBRD-22421.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGVhMWFkOWEzMzExZGM5NGVlIiwicmVmX2lkIjoiNjczOTZlMGU3MjgyMDZlZmI5MmYyNTZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTE3LCJleHAiOjE3ODI0MDAzMTd9.Qrx7Y15ZAwH5v8kug5G_VwqbtYLk2PKhA7JKWyscWdI)

 (text/csv)    
