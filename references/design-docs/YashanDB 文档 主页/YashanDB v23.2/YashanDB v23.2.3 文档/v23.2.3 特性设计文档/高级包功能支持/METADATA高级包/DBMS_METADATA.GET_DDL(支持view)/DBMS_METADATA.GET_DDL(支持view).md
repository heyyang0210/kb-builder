Created by 冯皓博, last modified on 十一月 02, 2022

## 1、Overview(概述)

支持DBMS_METADATA.GET_DDL功能

原始需求：    [YDBRD-4796](https://jira.yasdb.com/browse/YDBRD-4796?src=confmacro)    -  【2022.2】支持DBMS_METADATA.GET_DDL系统包功能  完成

  [YDBRD-6027](https://jira.yasdb.com/browse/YDBRD-6027?src=confmacro)    -  支持DBMS_METADATA.GET_DDL获取视图  完成

## 2、Features（功能特性）

  


```
DBMS_METADATA.GET_DDL (
object_type     IN VARCHAR2,
name            IN VARCHAR2,
schema          IN VARCHAR2 DEFAULT NULL,
version         IN VARCHAR2 DEFAULT 'COMPATIBLE',
model           IN VARCHAR2 DEFAULT 'ORACLE',
transform       IN VARCHAR2 DEFAULT 'DDL')
RETURN CLOB;
```

当前仅前三个参数生效，后三个参数不生效

  


3、Interfaces（接口）

```
static CodResult metadataFetchFromSystable(AnlStmt* stmt, AnkCursor* cursor, CodUint64 queryScn, GetDdlAssist assist, Variant* value, List* varList)

static CodResult metadataOpenSysTable(AnlStmt* stmt, AnkCursor* cursor, TableDict* dc, CodUint64 oid, GetDdlAssist assist)

static CodResult metadataConcatCreateView(AnlStmt* stmt, MetadataDdlDef def, List* varList, Variant* retValue)

CodResult bipExecGetDdl(AnlStmt* stmt, ExprNode* node, Variant* retValue)

CodResult bipVerifyGetDdl(AnlVerifier* vrfr, ExprNode* node)
```

  


## 4、Limitations（功能限制）

1、当前未做权限校验，Oracle针对Metadata包有专门的权限 select_catalog_role

## 5、Detail Design（详细设计）    
  对于各个字段，取系统表相关定义，并拼接成ddl语句

**5.1 VIEW**

- view$,取text字段
- col$,取name字段


## 6、Testcases（自测用例）

![](https://pingcode.yasdb.com/atlas/files/public/67396d90a1ad9a3311dc9223/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTgsImV4cCI6MTc4MjMyMDE1OH0.2tYHwgDerrD8jkbMjSEogVo1QYqK1cdtkPqVE2nblhk)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d908970c2af4f5213af/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTgsImV4cCI6MTc4MjMyMDE1OH0.2tYHwgDerrD8jkbMjSEogVo1QYqK1cdtkPqVE2nblhk)

## 7、Documents（资料）

  [DBMS_METADATA (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_METADATA.html#GUID-0DD1B9D5-367A-44D6-B8D5-C5B778D911DA)  

## 8、Wordload（工作量）

## 9、TODO（遗留问题）

## Attachments: