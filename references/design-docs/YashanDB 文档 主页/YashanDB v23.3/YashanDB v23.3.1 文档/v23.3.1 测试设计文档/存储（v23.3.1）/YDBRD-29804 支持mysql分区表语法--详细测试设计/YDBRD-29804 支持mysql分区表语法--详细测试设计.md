Created by 陈瑞, last modified by  刘大境 on 八月 14, 2024

# 1. 概述

【mysql兼容】支持常用MYSQL分区，并且支持range按时间分区，可手工创建新分区  ~~，也可以自增分区~~

*SR:*    [https://pingcode.yasdb.com/pjm/items/667bd324288e197820af3276](https://pingcode.yasdb.com/pjm/items/667bd324288e197820af3276)    *?#YDBRD-29804 支持MySQL分区表语法*

*开发设计文档：*

*调研文档：*    [mysql分区表兼容调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=162991837)  

# 2. 需求分析

需求场景：    
  1 支持MySQL创建一、二分区表语法    
  2 支持MySQL增加和删除分区语法    
    


## 2.1 功能点分析

语法图：

  [MySQL ：： MySQL 5.7 参考手册 ：： 13.1.18 CREATE TABLE 语句](https://dev.mysql.com/doc/refman/5.7/en/create-table.html)  

![](https://conf.yasdb.com/download/attachments/159439731/image2024-7-23_17-18-46.png?version=1&modificationDate=1721726326000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUlBQUFBQkFBQUFBZ0FBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc3NjUsImV4cCI6MTc4MjQ0ODU2NX0.Evs6Tk92rLD4Jh_4BwVaMn5zhWPrJ0WP2xoQOod05zk)

  [MySQL :: MySQL 5.7 Reference Manual :: 13.1.8 ALTER TABLE Statement](https://dev.mysql.com/doc/refman/5.7/en/alter-table.html)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e878970c2af4f52192e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUlBQUFBQkFBQUFBZ0FBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc3NjUsImV4cCI6MTc4MjQ0ODU2NX0.Evs6Tk92rLD4Jh_4BwVaMn5zhWPrJ0WP2xoQOod05zk)

  


1、创建range/hash/key/list/linear hash/linear key分区

2、一级分区和二级分区

3、alter table add/drop/truncate 分区。都支持 range/list ，hash/key分区三种不支持add/drop

4、视图字段显示正常

5、差异点

- hash/key分区不指定partitions num，默认分区 1
- 对于单列range分区，values less than maxvalue 中maxvalue 可不带括号。包括create table和alter table 语法
- list 分区使用 values   in   () 定义分区
- mysql的hash/key不支持add partition（alter table ... partition by ...可以实现重新定义分区表，本次不支持  ）（hash分区所有数据库均不可drop分区）


6、创建分区表默认创建分区索引

7、其余的alter 分区操作，如果yashan没有支持，本次不做新功能。

  


|  
|  
|  
|是否支持|
|---|---|---|---|
|ALTER TABLE|ADD   PARTITION|新增分区|是|
|  
|DROP     PARTITION   |删除分区|是|
|  
|~~DISCARD~~  ~~ ~~  ~~PARTITION~~|~~将一个分区从一个已分区的表中丢弃~~|  
|
|  
|~~IMPORT~~  ~~ ~~  ~~PARTITION~~  ~~ ~~|~~IMPORT~~  ~~ 分区~~|  
|
|  
|TRUNCATE  PARTITION|删除分区|  
|
|  
|~~COALESCE~~  ~~ ~~  ~~PARTITION~~  ~~ ~~  ~~number~~|~~合并分区~~|  
|
|  
|~~REORGANIZE~~  ~~ ~~  ~~PARTITION~~  ~~ ~~|~~-~~  ~~- 重新组织这些分区为新的定义，假设 my_table 已经按范围分区~~  ~~ ~~  ~~ALTER~~  ~~ ~~  ~~TABLE~~  ~~ my_table REORGANIZE ~~  ~~PARTITION~~  ~~ p0, p1, p2 ~~  ~~INTO~~  ~~ ( ~~  ~~PARTITION~~  ~~ p0 ~~  ~~VALUES~~  ~~ LESS THAN (~~  ~~100~~  ~~), ~~  ~~PARTITION~~  ~~ p1 ~~  ~~VALUES~~  ~~ LESS THAN (~~  ~~200~~  ~~), ~~  ~~PARTITION~~  ~~ p2 ~~  ~~VALUES~~  ~~ LESS THAN (MAXVALUE) );~~|  
|
|  
|~~EXCHANGE~~  ~~ ~~  ~~PARTITION~~|~~交换分区~~|  
|
|  
|~~ANALYZE~~  ~~ ~~  ~~PARTITION~~|~~--~~  ~~ANALYZE PARTITION~~  ~~ 是 MySQL 中用于分析（统计信息收集）指定分区或所有分区的语句。它有助于优化查询性能和执行计划。以下是 ~~  ~~ANALYZE PARTITION~~  ~~ 的基本用法和相关信息：~~|  
|
|  
|~~CHECK~~  ~~ ~~  ~~PARTITION~~|~~--~~  ~~CHECK PARTITION~~  ~~ 是用于检查指定分区或所有分区的语句。它主要用于验证分区是否在表定义的范围内，并可以检查分区中的数据完整性。  为什么会出现这种情况？~~|  
|
|  
|~~OPTIMIZE~~  ~~ ~~  ~~PARTITION~~  ~~ ~~|~~--在MySQL中，~~  ~~OPTIMIZE PARTITION~~  ~~ 是用于优化分区表的语句。它的作用主要是针对分区表的性能优化和空间回收。具体来说，它可以做以下几件事情：~~,1. ~~**重建分区索引**~~  ~~: 通过重建分区索引，可以提高查询性能，特别是在数据删除或者更新频繁时，索引可能会变得不再紧凑，影响查询效率。~~
1. ~~**释放空间**~~  ~~: 分区表在删除大量数据后，物理空间可能没有被立即释放，使用 ~~  ~~OPTIMIZE PARTITION~~  ~~ 可以回收被删除数据占用的磁盘空间。~~
1. ~~**优化查询性能**~~  ~~: 对于包含大量历史数据的分区表，优化分区可以改善查询的响应时间，特别是在查询历史数据时。~~
|  
|
|  
|~~REBUILD~~  ~~ ~~  ~~PARTITION~~  ~~ {partition_names ~~  ~~|~~  ~~ ~~  ~~ALL~~  ~~}~~|~~REBUILD~~  ~~ 分区~~|  
|
|  
|~~REPAIR~~  ~~ ~~  ~~PARTITION~~  ~~ {partition_names ~~  ~~|~~  ~~ ~~  ~~ALL~~  ~~}  ~~|~~--修补被破坏的分区。~~|  
|
|  
|~~REMOVE~~  ~~ ~~  ~~PARTITIONING  ~~|~~--要移除一个分区表的分区设置，你可以使用 ~~  ~~ALTER TABLE ... REMOVE PARTITIONING~~  ~~ 命令。这个命令会将分区表转换为非分区表，即移除其分区设置。~~|  
|
|  
|~~UPGRADE~~  ~~ ~~  ~~PARTITIONING~~|~~-- 升级表分区~~|  
|


  


## 2.2 应用场景

- mysql兼容模式下，支持分区表的语法


## 2.3 规格约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

*1、对分区表的创建/修改语法，各个语法分支路径，采用等价类划分和正交法，确保覆盖到每一种正常用法和异常场景*

*2、对于创建的分区表的*  *数据分区*  *功能，采用场景法，对不同分区表类型覆盖。比如range/hash/key/list 分区插入对应的数据，查询对应分区的数据正常。*

*3、创建依赖分区表的对象索引和约束。验证索引和约束的功能。确保正常*

*4、查询information视图，确认视图内容准确*

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


# 4. 测试用例

# 5. 测试框架设计

yasft

# 6. 测试环境说明

*单机*

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[mysql兼容分区表语法.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODdhMWFkOWEzMzExZGM5NzlmIiwicmVmX2lkIjoiNjczOTZlODY3MjgyMDZlZmI5MmYyOGU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NzY0LCJleHAiOjE3ODI1MjQxNjR9.SL3zpXqVQsdSL6loSXWw0sF1DjeMJU9P83UBZUHlm0w)

 (application/x-xmind)    


[mysql兼容分区表语法.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODc4OTcwYzJhZjRmNTIxOTJjIiwicmVmX2lkIjoiNjczOTZlODY3MjgyMDZlZmI5MmYyOGU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NzY0LCJleHAiOjE3ODI1MjQxNjR9.glU0LfVcooIbqJPuzFYeZi3ETzGOLOXzMZJpM-gZFPc)

 (application/x-xmind)    


[mysql兼容分区表语法.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODc4OTcwYzJhZjRmNTIxOTJkIiwicmVmX2lkIjoiNjczOTZlODY3MjgyMDZlZmI5MmYyOGU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NzY0LCJleHAiOjE3ODI1MjQxNjR9.dQhCU_AxN1T1JDoSX8yH2QK-zWv1yIIpp_1eD17xI7I)

 (application/x-xmind)    


[YDBRD-29804支持MYSQL分区表语法.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODdhMWFkOWEzMzExZGM5N2EwIiwicmVmX2lkIjoiNjczOTZlODY3MjgyMDZlZmI5MmYyOGU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NzY0LCJleHAiOjE3ODI1MjQxNjR9.uUkqahi0A__cfhVCXvS_BCqF8O1QLJFpP2g7YqAyPzg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计方案评审,与会人：张鹏飞、郑荃、陈瑞、林永毫、李子怡、刘大镜,评审时间：2024-08-06 15:00-15:30 评审地点：线上    
  会议主题：    
  评审纪要信息：    
  1、插入非法之超过分区定义上限、  自增列自增超过分区定义上线  --郑荃,2、ha测试视图字段是否同步   --郑荃,3、分区表作为表达式拦截   --郑荃,4、values in 不带in这种也覆盖下 --郑荃,5、maxvalue 边界值确定下,评审结论：通过,Posted by chenrui at 八月 06, 2024 15:40|
|---|
