Created by 刘大境, last modified on 十月 17, 2024

**SR：**    [https://pingcode.yasdb.com/pjm/items/670524abe489dd0868f221f0](https://pingcode.yasdb.com/pjm/items/670524abe489dd0868f221f0)    ?    
  #YDBRD-33514 支持DBA_TAB_HISTOGRAMS视图，查看数据库表的直方图信息

**测试调研：**    [DBA_TAB_HISTOGRAMS视图调研 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171049657)  

**开发设计：无**

# **1. 概述**

该需求用于兼容Oracle DBA_TAB_HISTOGRAMS视图，其视图功能与 DBA_HISTOGRAMS视图一致。

![](https://pingcode.yasdb.com/atlas/files/public/67396efda1ad9a3311dc9b5f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg3ODgsImV4cCI6MTc4MjQ2OTU4OH0.9E2_HbaSsBB1S3zzHLhz_qT192AfXasre8Ze-En0s3c)

# **2. 需求分析**

## 2.1 功能点分析

DBA_TAB_HISTOGRAMS 视图在 Oracle 数据库中用于提供有关表和列的直方图统计信息。其主要作用包括：

**1.  统计信息收集**  ：该视图存储了关于表中列值分布的详细信息，帮助数据库优化器更好地选择执行计划。

**2.  数据分布分析**  ：通过查看直方图，DBA 可以了解列数据的分布情况，例如是否存在偏斜或不均匀分布，这对于查询优化非常重要。

**3. 性能优化**  ：优化器可以利用这些统计信息来改进查询的执行效率，尤其是在涉及范围查询或排序时。

**4. 支持复杂查询**  ：在执行涉及多列的复杂过滤条件时，直方图能够提供更准确的基数估算，提高查询性能。

  


**支持范围：**

**1. **  表类型：HEAP、TAC、LSC

**2. **  部署模式：单机、集群、分布式

  


**应用场景：**

针对于直方图收集完统计信息后，进行DBA_TAB_HISTOGRAMS视图查询。

未进行直方图收集情况下，进行DBA_TAB_HISTOGRAMS视图查询为空。

  


# **3. 测试设计方法**

1.不同直方图类型：      FREQUENCE  、      HYBRID混合直方图、 TOP-N、 HEIGHT BALANCED、

2. 表类型HEAP/LSC/TAC，覆盖单机、分布式、集群

3. 覆盖现有支持列数据类型

4. 覆盖对象：普通表、分区表、复制表、分布表  、AC

5. 权限：自定义用户/DBA用户 查询DBA_TAB_HISTOGRAMS视图

6. ha场景：主机收集直方图，备机查询DBA_TAB_HISTOGRAMS视图

7. 并发场景： 不同直方图类型，收集直方图同时，查询DBA_TAB_HISTOGRAMS视图

8. 对DBA_TAB_HISTOGRAMS视图DDL/DML操作拦截 （是否有对应USER_TAB_HISTOGRAMS   /   ALL_TAB_HISTOGRAMS 视图）

  


### 3.1 测试设计：

主要采用有效类划分和场景法进行设计

1.  语法验证：主要采用等价类划分

2.  功能验证：主要场景法和错误推测

### **3.2 DFX覆盖**

|系统级DFX分类|是否涉及|备注|
|---|---|---|
|CT|Y|  
|
|KT|Y|  
|
|长稳|Y|  
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
|性能|N|  
|
|可维护性|N|  
|
|资料|Y|  
|


# **4. 详细测试设计**

**功能测试：**

|验证点|验证场景|预期|备注说明|
|---|---|---|---|
|查询DBA_TAB_HISTOGRAMS视图结构|视图无错别字，漏写、数据类型出入等|对比oracle DBA_TAB_HISTOGRAMS视图结构|覆盖单机、分布式、集群|
|覆盖4种直方图类型：,FREQUENCE/   HYBRID/ TOP-N/ HEIGHT BALANCED|分别看护频率直方图、混合直方图、前N直方图、高度平衡直方图、|查询成功，对比oracle|覆盖单机、分布式、集群|
|未对表进行直方图收集情况，查询DBA_TAB_HISTOGRAMS|校验视图返回值是否为空|未收集，查询为空|覆盖单机、分布式、集群|
|对DBA_TAB_HISTOGRAMS视图DDL/DML操作拦截|对DBA_TAB_HISTOGRAMS进行写入、变更、删除操作|报错拦截|覆盖单机、分布式、集群|
|覆盖对象：普通表、分区表、复制表、分布表  、AC|  
|  
|库上有现成存量用例，可改造|
|覆盖现有支持列数据类型|  
|  
|库上有现成存量用例，可改造|
|表类型HEAP/LSC/TAC，覆盖单机、分布式、集群|  
|  
|库上有现成存量用例，可改造|
|权限：自定义用户/DBA用户 查询DBA_TAB_HISTOGRAMS视图|  
|  
|库上有现成存量用例，可改造|
|列数据类型带约束、非空/空|  
|  
|库上有现成存量用例，可改造|
|构造大量数据/带或不带执行计划查询|查询视图返回结果校验|  
|库上有现成存量用例，可改造|
|create view as select * from DBA_TAB_HISTOGRAMS|  
|  
|库上有现成存量用例，可改造|
|查询带/不带filter|视图查询功能校验|  
|库上有现成存量用例，可改造|
|视图和视图、普通表、临时表、视图、同义词、dblink关联查询|视图查询功能校验|  
|库上有现成存量用例，可改造|


# **4.2 DFX测试设计**

|专项|场景说明|备注|
|---|---|---|
|HA|主机分别创建4种不同类型直方图，收集后、备机同步查询DBA_TAB_HISTOGRAMS成功|  
|
|  
|主机分别创建4种不同类型直方图，收集后、备机主备倒换后 查询DBA_TAB_HISTOGRAMS|  
|
|并发|在现有并发用例，带有DBA_HISTOGRAMS视图查询后， 追加 DBA_TAB_HISTOGRAMS查询|  
|
|长稳|在现有长稳用例，带有DBA_HISTOGRAMS视图查询后， 追加 DBA_TAB_HISTOGRAMS查询|  
|
|升级|升级前：覆盖四种不同直方图类型,升级后： 查询 DBA_TAB_HISTOGRAMS， 再收集直方图，再查询DBA_TAB_HISTOGRAMS|  
|


# 5.   **测试用例**

  


# 6.   **测试框架设计**

自动化用例添加到YTP平台上

  


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


  


# 8.   **测试工作量评估**

  


暂估 7天

## Attachments:

[image2024-10-9_17-8-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmQ4OTcwYzJhZjRmNTIxY2ViIiwicmVmX2lkIjoiNjczOTZlZmQ3MjgyMDZlZmI5MmYyZjU1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4Nzg4LCJleHAiOjE3ODI1NDUxODh9.cmOXJaCDQjuwyQv1E5sJuZWze3rxvsKGEx4lxRmKlI0)

 (image/png)    


[门槛用例.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmRhMWFkOWEzMzExZGM5YjVlIiwicmVmX2lkIjoiNjczOTZlZmQ3MjgyMDZlZmI5MmYyZjU1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4Nzg4LCJleHAiOjE3ODI1NDUxODh9.QUmw5dRsruJmWUOONTVslwLh6CqY88uNKMHiSxrnAeU)

 (application/octet-stream)    
