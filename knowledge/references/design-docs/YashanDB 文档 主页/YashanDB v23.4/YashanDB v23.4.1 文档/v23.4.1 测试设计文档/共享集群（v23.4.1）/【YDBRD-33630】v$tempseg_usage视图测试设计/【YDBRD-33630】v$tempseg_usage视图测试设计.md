Created by 张彩虹, last modified on 十一月 15, 2024

# **1. 概述**

本文描述优化v$tempseg_usage视图测试设计。

# **2. 需求分析**

v$tempseg_usage此视图是用来展示临时属性segment及其会话属性相关信息。

YashanDB需要展示的临时属性segment主要有两类，一类是sql语句执行过程中产生的swap空间占用，一类是临时表segment的temp表空间占用。

## **2.1 功能点分析**

SR链接：  [https://pingcode.yasdb.com/pjm/items/6706553ae489dd0868f2fd8f?](https://pingcode.yasdb.com/pjm/items/6706553ae489dd0868f2fd8f?)  

#YDBRD-33633 支持v$tempseg_usage视图

该视图主要显示两类信息：

1、临时表segment的temp表空间占用，针对此场景我们需要考虑全局临时表和私有临时表场景，包含普通索引和lob索引。

2、sql执行过程中产生的swap空间占用，针对此场景我们考虑构造执行过程中会产生swap表空间占用的业务（如sort、hash等），这里需要验证包含全局swap表空间和私有swap表空间。

**临时表空间：**

临时表空间，顾名思义就是用来存放临时数据的表空间，因此不能创建持久性对象，用户唯一能创建的对象就是临时表。

当数据库安装完成时，默认就已经创建了1个临时表空间TEMP，且所有未显式指定使用其他临时表空间的用户，都会使用这个临时表空间。

临时表空间的底层使用的是临时文件（tempfile），临时表空间不会生成redo日志，根据其服务的实例数量还可以分为：

- 本地临时表空间：只能被一个实例访问，其实是每个实例下各有一个本地临时表空间文件，只能被各自实例访问，不能被其他实例访问
- 全局临时表空间：可以被多个实例同时访问，建库时创建的默认临时表空间TEMP就属于全局临时表空间


**SWAP表空间：**

在执行SQL时，经常会遇到排序操作，当结果集无法放在内存中时，就会使用swap表空间来排序。

当数据库安装完成时，默认就已经创建了1个SWAP表空间，swap表空间只用于触发换入换出操作，不用作其他用途，不能创建任何对象。

swap表空间的底层使用的也是临时文件（tempfile），根据其服务的实例数量也可以分为：

- 本地swap表空间：只能被一个实例访问，其实是每个实例下各有一个本地swap表空间文件，只能被各自实例访问，不能被其他实例访问
- 全局swap表空间：可以被多个实例同时访问，建库时创建的默认SWAP表空间就属于全局swap表空间


### **2.1 .1视图字段定义**

![image.png](https://pingcode.yasdb.com/atlas/files/public/674d29fda1ad9a3311de3bc3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwOTMsImV4cCI6MTc4MjQ2ODg5M30.3kWkaw1vH_STSCrGXyXxSuRMS3ZwGnFQHXT_iTeCOmQ)

|字段|类型|说明|
|---|---|---|
|sid||会话ID|
|USERNAME|varchar(64)|会话关联用户名|
|USER|varchar(64)|等值username|
|SESSION_NUM|INTEGER|对应v$sesison的SERIAL#字段  |
|SQL_ID|VARCHAR(13)|对应v$session的SQL_ID|
|SQLHASH|BIGINT|对应v$session的SQL_HASH_VALUE|
|TABLESPACE|VARCHAR(64)|占用空间所属的表空间名称|
|CONTENTS|VARCHAR(9)|兼容oracle字段，恒定为’TEMPORARY‘|
|SEGTYPE|VARCHAR(18)|空间占用者类型,- SORT（排序）
- HASH（hash分区？）
- MERGE_SORT（merge排序）
- QUEUE
- STACK
- LIST（list分区？）
- DATA（普通数据）
- INDEX（索引）
- LOB_DATA（lob数据）
- LOB_INDEX（lob索引）
|
|SEGFILE#|INTEGER|占用空间所属文件的全局文件号（无法校验）|
|SEGBLK#|INTEGER|占用空间入口页面号（无法校验）|
|EXTENTS        |BIGINT|占用的extent数量（无法校验）|
|BLOCKS|BIGINT|占用的block数量  **（**  **v$datafile中blocks - free_blocks - 128）**|
|SEGRFNO#|INTEGER|占用空间所属文件的相对文件号（  **v$datafile中RELATIVE_FNO**  ）|
|TS#|INTEGER|占用空间所属表空间ID  **（v$datafile中TS#字段）**|


## **2.2 规格约束**

无

# **3. 详细测试设计**

## **3.1 测试设计方法**

该需求测试主要使用等价类和场景法进行设计。

## **3.2 详细测试设计**

1、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

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
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


2、详细测试点

|序号||测试场景|预期|
|:---|---|:---|:---|
|1|表空间类型|全局临时表空间（系统默认、用户手动创建）|视图可正确显示对象信息|
|2||本地临时表空间|视图可正确显示对象信息|
|3||全局swap表空间（系统默认、用户手动创建）|视图可正确显示对象信息|
|4||本地swap表空间|视图可正确显示对象信息|
|5|,业务场景|私有临时表不带索引业务|视图可正确显示对象信息|
|6||私有临时表带lob列业务（LOB_DATA）（  私有临时表不支持lob列，无法覆盖此场景  ）|视图可正确显示对象信息|
|7||私有临时表带普通索引业务（INDEX）（  私有临时表不支持创建索引，无法覆盖此场景  ）|视图可正确显示对象信息|
|8||私有临时表带lob索引业务（LOB_INDEX）（  私有临时表不支持lob列，无法覆盖此场景  ）|视图可正确显示对象信息|
|9||全局临时表不带索引业务|视图可正确显示对象信息|
|10||全局临时表带lob列业务（LOB_DATA）|视图可正确显示对象信息|
|11||全局临时表带普通索引业务（INDEX）|视图可正确显示对象信息|
|12||全局临时表带lob索引业务（LOB_INDEX）--lob列已有lob_index（  重复场景  ）|视图可正确显示对象信息|
|13||heap表做排序操作业务（SORT）|视图可正确显示对象信息（swap）|
|14||hep表做merge排序操作业务（  MERGE_SORT  ）|视图可正确显示对象信息|
|15||HASH、LIST、QUEUE和STACK业务？（挑选部分常见类型验证即可）|视图可正确显示对象信息|
|16||创建全局临时表，多个session插入数据|视图可正确显示对象信息|
|17||多个session创建会话级私有临时表，插入数据|视图可正确显示对象信息|
|18||删除全局临时表和私有临时表|视图中对象信息被删除|
|19||删除全局临时表空间和私有临时表空间|视图中对象信息被删除|
|20||删除全局swap表空间和私有swap表空间|视图中对象信息被删除|
|||block占用计算场景|**block占用计算正确（**  **v$datafile中blocks - free_blocks - 128）**|
|21|CT场景|全局临时表、私有临时表、lob索引、排序、去重等DDL、DML业务和查询视图并发|不core不卡|
|23|KT场景|全局临时表、私有临时表、lob索引、排序、去重等DDL、DML业务和查询视图并发过程中kill集群某个实例|不core不卡|




# **4. **  **测试用例**

冒烟用例

|序号|测试场景|预期|
|:---|:---|:---|
|1|私有临时表带索引，查询v$  tempseg_usage  /gv$  tempseg_usage  视图|视图可正确显示对象信息|
|2|全局临时表带普通索引，查询v$  tempseg_usage  /gv$  tempseg_usage  视图|视图可正确显示对象信息|
|3|全局临时表、私有临时表、lob索引、排序、去重等业务和查询视图并发|不core不卡|




# **5. 测试框架设计**

本次测试使用Guider框架实现

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式、集群|


# **7、工作量评估**

2人周