Created by 徐瑶, last modified on 十二月 18, 2023

# 1. 概述 

本文为支持XMLTYPE列数据及XMLTYPE列存储属性导入导出测试设计

# 2. 需求分析 

## 2.1需求

SR:         [YDBRD-21349](https://jira.yasdb.com/browse/YDBRD-21349?src=confmacro)    -  exp/imp支持XMLTYPE类型  完成    [YDBRD-21724](https://jira.yasdb.com/browse/YDBRD-21724?src=confmacro)    -  exp/imp支持xmltype数据类型  完成

开发设计：    [YDBRD-21724:xmltype exp/imp设计文档](133573946.html)  

需求范围：单机行表

## 2.2 功能描述

支持XMLTYPE列数据的导入导出；XMLTYPE列存储属性导入导出。

## 2.3 功能限制

- 目前只支持对XMLTYPE数据的直接简单插入，不对XMLTYPE数据的合法性做校验。（所以插入任意格式的字符串目前都可以）


- 有效数据包含单引号，其单引号需要进行转义，有效数据包含双引号不需要转义


## 2.4 查询方式

视图：  user_lobs/dba_lobs,DBA_TAB_COLUMNS(查询  DATA_TYPE）

|字段|类型|说明|
|---|---|---|
|OWNER|VARCHAR(64)|LOB对象所属用户的ID|
|TABLE_NAME|VARCHAR(64)|LOB对象所属的表名|
|COLUMN_NAME|VARCHAR(4000)|LOB对象所属的列名|
|SEGMENT_NAME|VARCHAR(64)|LOB对象的segment名|
|TABLESPACE_NAME|VARCHAR(64)|LOB对象所属表空间的名称|
|INDEX_NAME|VARCHAR(64)|LOB对象的索引名称|
|IN_ROW|VARCHAR(1)|LOB数据是否是行内存储|
|PARTITIONED|VARCHAR(1)|是否是分区LOB|
|SEGMENT_CREATED|VARCHAR(1)|LOB对象是否存在segment|


# 3. 测试设计方法 

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|表类型|普通表|- heap
|建表，表名与列类型xmltype同名，  列名称 与列数据类型xmltype相同|- tac
- lsc
|  
|
|  
|分区表|一级分区覆盖：range\list\hash\interval，包含xmltype列,二级分区：包含xmltype列|xmltype不能作为分区键|  
|  
|
|  
|全局临时表|创建全局临时表，带xmltype列；|  
|  
|  
|
|插入内容|  
|（1）定义default、,（2）  插入内容覆盖：,- 正常值、
- 边界值、
- 空串、
- 空格、
- null、
- 特殊字符、
- 科学计数法、
- 大小写、
- 中文、
- 有效数据包含单双引号等
|大部分内容需符合xml格式|  
|  
|
|  
|规格覆盖|1、插入常量32K字符串到xmltype；,2、update xmltype列数据超过32K（常量）；,3、xmltype列默认值为32K字符串,4、xmltype列的个数-4096列，xmltype与其他数据类型共4096列,5.数据大小为1M,6.数据超过三万多行,多个表结合，空表与有内容的表|exp --csv  ,小于32000，,大于32000,- 普通导入导出，
- lls导出，lls导入，校验结果！
- 大数据量一个lob4G
|  
|  
|
|列约束|行内约束|- not null 
- check
|  
|  
|  
|
|  
|行外约束|- not null 
- check
|  
|  
|  
|
|  
|其他属性|- NOT DEFERRABLE
- INITIALLY IMMEDIATE
- RELY|NORELY
- validate|novalidate
- enable|disable
|  
|  
|  
|
|lob属性|  
|- basicfile|securefile
- 是否指定表空间  （
- default
- mms表空间
- 加密表空间
- 自定义表空间）
- ENABLE/DISABLE STORAGE IN ROW
|  
|  
|  
|
|表的其他属性|表空间|default,mms表空间,加密表空间,自定义表空间|  
|  
|  
|
|  
|  
|是否  指定PCTFREE/PCTUSED/INITRANS/MAXTRANS属性|  
|  
|  
|
|  
|  
|segment creation deferred|immediate|  
|  
|  
|
|  
|  
|logging属性：logging/nologging|  
|  
|  
|
|  
|  
|parallel_clause并行度：|  
|  
|  
|
|  
|  
|cache_clause：cache/nocache|语法兼容，无实际含义|  
|  
|
|  
|  
|readonly_clause:readonly/readwrite|语法兼容，无实际含义|  
|  
|
|  
|  
|inmemory_clause:immediate/no immediate|语法兼容，无实际含义|  
|  
|
|  
|  
|table_compression：NOCOMPRESS/COMPRESS|语法兼容，无实际含义|  
|  
|
|  
|  
|row_movement_clause：  DISABLE/ENABLE ROW MOVEMENT|  
|  
|  
|
|导入导出模式|  
|1.导入导出方式组合：    
  （1）full模式导出，full/user/table模式导入,（2）user模式导出，full、user、table模式导入,单用户，多用户,（3）table模式导出，full、user、table模式导入,单表，多表,（4）touser模式,2.导入导出是否存在对象：,（1）用户：导入前用户存在（单个、多个、规格）、不存在,（2）表：导入前表存在（单个、多个、规格）、不存在|只导出数据，只导出元数据,重复导入导出，注意校验结果！！|  
|  
|
|导入用户权限验证|  
|1.登录用户有dba权限,2.只有创建对象和create session权限，user/table导入导出,3.创建表指定所有者，导入该用户/导入另一个用户,4.  导出后将表所属用户删除后进行导入|无关|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *1） 自动化用例：yastest_dfx框架执行用例*  *。*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：2023.10.25

## Attachments:

[expimp支持xmltype文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWM4OTcwYzJhZjRmNTIwNWM0IiwicmVmX2lkIjoiNjczOTZiOWM3MjgyMDZlZmI5MmYwODJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Nzk3LCJleHAiOjE3ODIzODIxOTd9.H8oU6rkOFVqPnXNiW_nYzYojdTypvuMDSeCZMcbNz_0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
