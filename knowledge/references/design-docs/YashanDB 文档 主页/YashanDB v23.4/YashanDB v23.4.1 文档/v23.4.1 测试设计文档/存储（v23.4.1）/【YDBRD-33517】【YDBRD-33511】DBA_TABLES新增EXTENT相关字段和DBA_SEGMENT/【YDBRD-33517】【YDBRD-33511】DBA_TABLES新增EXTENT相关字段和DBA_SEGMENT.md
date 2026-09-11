

# 1. 概述

DBA_SEGMENTS视图字段对齐ORACLE，增加INITIAL_EXTENT、NEXT_EXTENT 、MIN_EXTENTS 、MAX_EXTENTS 、PCT_INCREASE、FREELISTS、FREELIST_GROUPS 、RELATIVE_FNO   、BUFFER_POOL

DBA_TABLES 新增EXTENT相关字段，增加NITIAL_EXTENT、NEXT_EXTENT、MIN_EXTENTS、MAX_EXTENTS

# 2. 需求分析

调研报告：

  [https://pingcode.yasdb.com/wiki/spaces/ZHENGQUAN/pages/6763dc6ca03b8234860ae7e4](https://pingcode.yasdb.com/wiki/spaces/ZHENGQUAN/pages/6763dc6ca03b8234860ae7e4)  

  [https://pingcode.yasdb.com/wiki/spaces/ZHENGQUAN/pages/6763b81ed2baff0fd55d9fd9](https://pingcode.yasdb.com/wiki/spaces/ZHENGQUAN/pages/6763b81ed2baff0fd55d9fd9)  

## 2.1 功能点分析

DBA_SEGMENTS

- INITIAL_EXTENT：创建时请求的段的初始范围的大小（以字节为单位）。
- NEXT_EXTENT ：分配给段的下一个范围的大小（以字节为单位）
- MIN_EXTENTS ：段中允许的最小扩展数
- MAX_EXTENTS ：段中允许的最大扩展数
- PCT_INCREASE：增加下一个要分配的区段大小的百分比
- FREELISTS：分配给该段的进程空闲列表的数量
- FREELIST_GROUPS ：分配给该段的空闲列表组的数量
- RELATIVE_FNO  ：RELATIVE_FNO   
- BUFFER_POOL：用于段块的缓冲池：（DEFAULT、KEEP、RECYCLE）


DBA_EXTENT：4个extent的字段含义同DBA_SEGMENTS，取值也一样

## 2.2 应用场景

- 主要应用于对表或者其他对象在EXTENT使用上的一些信息查询


## 2.3 规格约束

- INITIAL_EXTENT、RELATIVE_FNO  实际工程生效，其他都是语法兼容


# 3. 详细测试设计

## 3.1 测试设计方法

对于视图中的取值范围的测试，主要采用场景法，构造视图的不同的取值范围，查看是否正确，并结合边界值，对雨各个取值的边界值进行验证。

## 3.2 详细测试设计

1、详细测试场景

以下场景覆盖对象： 普通表、分区表（一级、二级）、嵌套表、LOB、索引（全局，本地分区索引）、AC、 AC PARTITION

|字段|场景|预期|
|---|---|---|
|INITIAL_EXTENT（DBA_SEGMENTS和DBA_EXTENT）|1、创建表空间，指定不同大小的表空间，extent固定值（指定不同的值），系统自动分配（需要验证到extent自动扩展时的不同值）,2、创建表时带storage_clause，指定INITIAL 、MAXSIZE 、NEXT 、MINEXTENTS 、MAXEXTENTS 为不同值，查看视图的变化（当前表为兼容性，不生效）,3、表空间跟表指定的属性不一样（当前表为兼容性，不生效）|表空间 指定uniform size ，INITIAL_EXTENT 则固定值，跟uniform  size一样的,表空间 指定AUTOALLOCATE，INITIAL_EXTENT 为64K|
|NEXT_EXTENT （DBA_SEGMENTS和DBA_EXTENT）||1、表空间AUTOEXTEND ON NEXT后跟固定值时，NEXT_EXTENT 跟设置的值跟表空间AUTOEXTEND ON NEXT后的值一样,2、表空间AUTOEXTEND ON AUTOALLOCATE,最开始是8个block，当segment已分配的block达到128个，即1M，之后每次分配都是128个block为单位。,当segment已分配达到16384个block，即128M，之后每次分配都是1024个block，即一次分8M,当已分配达到131072个block，即1G，之后每次分配都是8192个block，一次分64M,3、指定表的属性时, 是跟随表空间的还是？|
|MIN_EXTENTS （DBA_SEGMENTS和DBA_EXTENT）||1、表空间的不同参数不影响此结果，应该为无效值,2、表的存储属性为语法兼容，也不影响此结果|
|MAX_EXTENTS （DBA_SEGMENTS和DBA_EXTENT）||1、表空间的不同参数不影响此结果，应该为无效值,2、表的存储属性为语法兼容，也不影响此结果，应该为无效值|
|PCT_INCREASE（DBA_SEGMENTS）|指定表的存储属性带PCTINCREASE |oracle 该字段指定了表空间为0，不指定表空间为空|
|FREELISTS（DBA_SEGMENTS）|指定表的存储属性带FREELISTS   |ORACLE默认值和最小值为1，查询为空|
|FREELIST_GROUPS（DBA_SEGMENTS）||查询为空|
|RELATIVE_FNO  （DBA_SEGMENTS）|1、创建表空间，表空间只有一个dbfile,2、创建表空间有2个dbfile，其中表的数据在第二个dbfile下|1、HEADER_FILE=RELATIVE_FNO,2、HEADER_FILE<=RELATIVE_FNO|
|BUFFER_POOL（DBA_SEGMENTS）|指定表的存储属性STORAGE的BUFFER_POOL，有3种不同的值|BUFFER_POOL 的值不指定是default，指定了就跟指定的一样|




2、DFX覆盖说明

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，验证ddl或者dml导致extent变更时，并发进行查询|
|KT|不涉及|
|长稳|涉及，长稳补充视图查询|
|一致性|不涉及|
|三方测试工具  
(sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及，备机查询|
|压力|不设计|
|性能|不涉及|
|可维护性|不涉及|


|测试类别|测试场景|预期|
|---|---|---|
|并发|验证ddl或者dml导致extent变更时，并发进行查询|不会出现卡住或者core|
|HA|主机上做ddl或者ddl导致视图的值发生变化，查看备机|备机也对应发生变化|
|升级|低版本创建对象，并插入一些数据，升级到高版本|到高版本视图多了几列数据，并且值是正确显示的|




# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；


|SR编号|SR名称|用例编号|用例测试点|
|:---|:---|:---|:---|
|YDBRD-33511|DBA_SEGMENTS视图对齐oracle|test_sdv_ydbrd_33511_dba_segments_001|创建表空间，指定不同大小的表空间，extent固定值（指定不同的值），系统自动分配（需要验证到extent自动扩展时的不同值）|
|YDBRD-33517|DBA_SEGMENTS视图对齐oracle|test_sdv_ydbrd_33511_dba_segments_002|创建表时带storage_clause，指定INITIAL 、MAXSIZE 、NEXT 、MINEXTENTS 、MAXEXTENTS 、PCTINCREASE 、FREELISTS  、STORAGE为不同值 ，查看视图的变化|
|YDBRD-33517|DBA_SEGMENTS视图对齐oracle|test_sdv_ydbrd_33511_dba_segments_003|以下2个场景查看HEADER_FILE和RELATIVE_FNO值,1、创建表空间，表空间只有一个dbfile,2、创建表空间有2个dbfile，其中表的数据在第二个dbfile下|


      2.启动测试之前提供文本用例，并完成大部分自动化用例；

  [【YDBRD-33517】【YDBRD-33511】DBA_TABLES新增EXTENT相关字段和DBA_SEGMENTS视图对齐oracle自动化用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3ZDBkMjBhMWFkOWEzMzExZGU2MjdiIiwicmVmX2lkIjoiNjc2OGRjNTRhMDNiODIzNDg2MGJlZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5MzQ3LCJleHAiOjE3ODI1NDU3NDd9.F5JP5El7gnZPOSrCrQgXjhnWgccOpLzLYBwxcRpWb4g)  



# 5. 测试框架设计

- *当前的guider和ha框架即可满足*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *6人天*

计划测试完成时间：

1、调研+测试设计  1天

2、自动化用例 +测试执行3天

3、上车分析+用例自动化稳定+资料测试  2天



## Attachments:



 (application/msword)  




 (application/msword)  
