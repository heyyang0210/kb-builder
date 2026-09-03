Created by 张锐, last modified on 十一月 08, 2023

IR链接：    [https://jira.yasdb.com/browse/YDBRD-941](https://jira.yasdb.com/browse/YDBRD-941)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-21783](https://jira.yasdb.com/browse/YDBRD-21783)  

##   [1. Overview（概述）](#1-overview概述)  

YashanDB支持创建external table，支持外部表的查询。支持形态为单机。

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持CREATE外部表
- 外部表支持查询
- 支持DROP外部表


示例sql：

```
CREATE TABLE "CDI"."T_TEMP_DRUG_ADJUST" 
(
  "DRUG_ID" NUMBER(16,0), 
  "DRUG_TYPE" VARCHAR2(64), 
  "YEARENDQTY" NUMBER(22,6), 
  "STOCKQTY" NUMBER(22,6), 
  "DIFF" NUMBER(22,6)
) ORGANIZATION EXTERNAL 
( 
  TYPE ORACLE_LOADER 
  DEFAULT DIRECTORY "DATA_PUMP_DIR" 
  ACCESS PARAMETERS 
  ( records delimited by newline fields terminated by ',' ) 
  LOCATION ( 'toAdjust.csv' ) 
) REJECT LIMIT UNLIMITED

```

##   [3. Interfaces（接口）](#3-interfaces接口)  

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c0b8970c2af4f5208e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFBQUFBQUFBRUFBQUFBQUFBZ0FBQUFBQUFBQUFCQUFBQUFBQUFBQUFBSUFBQUNBQUFDQUFBQUFBQUFBQUFBQUJBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3NTMsImV4cCI6MTc4MjMwOTU1M30.AhAbFcbtBjxaBuUBtk3ZCkgzMg3DsMHGr1DggmOrqjc)

![](https://pingcode.yasdb.com/atlas/files/public/67396c0ba1ad9a3311dc874e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFBQUFBQUFBRUFBQUFBQUFBZ0FBQUFBQUFBQUFCQUFBQUFBQUFBQUFBSUFBQUNBQUFDQUFBQUFBQUFBQUFBQUJBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3NTMsImV4cCI6MTc4MjMwOTU1M30.AhAbFcbtBjxaBuUBtk3ZCkgzMg3DsMHGr1DggmOrqjc)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c0ba1ad9a3311dc874f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBRUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFBQUFBQUFBRUFBQUFBQUFBZ0FBQUFBQUFBQUFCQUFBQUFBQUFBQUFBSUFBQUNBQUFDQUFBQUFBQUFBQUFBQUJBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3NTMsImV4cCI6MTc4MjMwOTU1M30.AhAbFcbtBjxaBuUBtk3ZCkgzMg3DsMHGr1DggmOrqjc)

  


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 外部表只读
- 外部表不支持约束
- 外部表不支持index
- 外部表不支持object type，varray，LONG类型（oracle还不支持invisible column）
- 外部表不支持lob
- 外部表不支持alter
- 外部表不能是临时表
- 外部表不支持分区表
- opaque_format_spec不会校验正确性，只有使用的时候才会校验正确性。当前版本，YashanDB不会真正去使用opaque_format_spec，也不会校验opaque_format_spec。解析外部文件使用默认行为（records delimited by newline fields terminated by ','）
- location_specifier也不会校验，只有真正使用的时候才会校验文件是否存在


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

YashanDB支持创建外部表

- REJECT LIMIT integer， integer取值范围 [0, 100000]


当数据库定义列数少于csv文件行列数，不会报错（前提是前几列对应数据类型转化不报错）。如果数据库定义列数大于csv文件行列数，会报错（增加reject limit）

  


  


  


###   [5.1 系统表设计](#51-系统表设计)  

####   [EXTERNAL_TAB$](#external-tab)  

|列名|数据类型|说明|
|---|---|---|
|OBJ#|BINARY_BIGINT NOT NULL|对象id|
|DEFAULT_DIR|VARCHAR(64)|默认directory|
|TYPE$|BINARY_INTEGER NOT NULL|access driver type|
|REJECT_LIMIT|BINARY_INTEGER NOT NULL|允许错误数量|
|PAR_TYPE|BINARY_INTEGER NOT NULL|解析参数是clob还是blob，当前只可能是clob|
|PARAM_CLOB|CLOB|clob解析参数|
|PARAM_BLOB|BLOB|blob解析参数|
|PROPERTY|BINARY_INTEGER NOT NULL|属性|


CREATE UNIQUE INDEX I_EXTERNAL_TAB1 ON EXTERNAL_TAB$(OBJ#);

####   [EXTERNAL_LOCATION$](#external-location)  

|列名|数据类型|说明|
|---|---|---|
|OBJ#|BINARY_BIGINT NOT NULL|对象id|
|POS|BINARY_INTEGER NOT NULL|当前永远为1|
|DIR|VARCHAR(64)|DIRECTORY 名称|
|NAME|VARCHAR(4000)|LOCATION|


CREATE UNIQUE INDEX I_EXTERNAL_LOCATION1 ON EXTERNAL_LOCATION$(OBJ#, POS);

###   [5.2 系统视图](#52-系统视图)  

####   [DBA_EXTERNAL_TABLES](#dba-external-tables)  

|列名|NULLABLE|说明|
|---|---|---|
|OWNER|VARCHAR(64) NOT NULL|外部表owner|
|TABLE_NAME|VARCHAR(64) NOT NULL|外部表名称|
|TYPE_OWNER|VARCHAR(3)|access driver owner, SYS|
|TYPE_NAME|VARCHAR(12)|access driver名称|
|DEFAULT_DIRECTORY_OWNER|VARCHAR(3)|default directory owner, SYS|
|DEFAULT_DIRECTORY_NAME|VARCHAR(64)|外部表默认directory名称|
|REJECT_LIMIT|VARCHAR(40)|允许的错误数量|
|ACCESS_TYPE|VARCHAR(7)|access parameters是clob还是blob|
|ACCESS_PARAMETERS|CLOB|外部表的access parameters（clob）|
|PROPERTY|VARCHAR(10)|REFERENCED - Referenced columns或者ALL - All columns|


####   [DBA_EXTERNAL_LOCATIONS](#dba-external-locations)  

|列名|NULLABLE|说明|
|---|---|---|
|OWNER|VARCHAR(64) NOT NULL|外部表LOCATION的owner|
|TABLE_NAME|VARCHAR(64) NOT NULL|外部表名称|
|LOCATION|VARCHAR(4000)|外部表的location clause|
|DIRECTORY_OWNER|VARCHAR(3)|外部表的location所属的directory的owner, SYS|
|DIRECTORY_NAME|VARCHAR(64)|外部表location所属的directory名称|


###   [5.3 扫描流程](#53-扫描流程)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

ddl测试场景：

- create table organization external
- drop table
- alter table


dml测试场景：

- select
- 拦截insert，update，delete


##   [7. 资料设计章节](#7-资料设计章节)  

  
    


  


## Attachments:

[image2023-6-8_16-46-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGJhMWFkOWEzMzExZGM4NzQ3IiwicmVmX2lkIjoiNjczOTZjMGI1OTNmOTljOWZmMjM2OTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzUzLCJleHAiOjE3ODIzODUxNTN9.rOiinbMnamy0FKyZCiQjVH791MsMZJrLoDhUBUuX4Sg)

 (image/png)    


[external_table_data_props.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGJhMWFkOWEzMzExZGM4NzQ5IiwicmVmX2lkIjoiNjczOTZjMGI1OTNmOTljOWZmMjM2OTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzUzLCJleHAiOjE3ODIzODUxNTN9.Nh6Ir5a37suo3eVPiXZfvRyG6KgCj8_T4gIy3_wy5Lg)

 (image/png)    


[opaque_format_spec.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGI4OTcwYzJhZjRmNTIwOGRjIiwicmVmX2lkIjoiNjczOTZjMGI1OTNmOTljOWZmMjM2OTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzUzLCJleHAiOjE3ODIzODUxNTN9.8EJqfcIJIa-38j8yv87Jh4QoLRPxsLXFScxTo7dl1Wc)

 (image/png)    


[organization_clause.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGJhMWFkOWEzMzExZGM4NzRiIiwicmVmX2lkIjoiNjczOTZjMGI1OTNmOTljOWZmMjM2OTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzUzLCJleHAiOjE3ODIzODUxNTN9.xcCIuf-e5mg2Db2vQGfC19h85b3WpceG5NhW3SX1S7Y)

 (image/png)    


[external_table_data_props.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGI4OTcwYzJhZjRmNTIwOGRlIiwicmVmX2lkIjoiNjczOTZjMGI1OTNmOTljOWZmMjM2OTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzUzLCJleHAiOjE3ODIzODUxNTN9.D-J_ga1xZK0SZ_mp0x_U_lAt6Z81dc19VvwnxbjB0NA)

 (image/png)    
