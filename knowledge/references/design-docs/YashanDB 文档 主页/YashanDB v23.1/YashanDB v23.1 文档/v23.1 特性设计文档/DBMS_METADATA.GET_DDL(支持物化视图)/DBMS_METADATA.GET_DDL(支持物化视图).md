Created by 郑翌恺, last modified on 十月 16, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

支持DBMS_METADATA.GET_DDL('MATERIALIZED VIEW','MVIEW_NAME')功能

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

DBMS_METADATA.GET_DDL可以获取指定object_type的DDL语句，包括  VIEW、  FUNCTION、  TRIGGER、  PROCEDURE、  PACKAGE、  TYPE、  TABLE，新增MATERIALIZED VIEW

  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

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

```
select DBMS_METADATA.GET_DDL('object_type','name','schema') from dual;
```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

**对于各个字段，取ALL视图的相关定义，拼接成DDL语句后输出**

###   [5.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)    ALL视图修改

- ALL_MVIEWS新增字段QUERY，QYERT_LEN，REFRESH_START_DATE，REFRESH_NEXT_DATE，BUILD_MODE
- ALL_TAB_COLS新增判断条件 BITAND(T.PROPERTY,   2048  )   !=     2048  ))，排除掉物化视图的容器表


###   [5.2 b](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)    ip_metadata修改

- 增加了case DDL_MVIEW的处理流程
- 仿照DBMS_METADATA.GET_DDL(VIEW)流程构建函数


```
static CodResult makeMViewQuery(MetadataDdlDef* def, CodChar* sql)                                //拼接sql语句在ALL视图中查询字段

static CodResult concatMViewHead(AnlStmt* stmt, MetadataDdlDef* def, GetDdlAssist* getDdlAssist)  //拼接DDL语句的头部，包含用户和物化视图名字

static CodResult doExecGetDdlMView(AnlStmt* stmt, MetadataDdlDef* def, GetDdlAssist* getDdlAssist)//拼接DDL语句剩下部分
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- ut_exp_imp 添加物化视图的创建和导入导出后的对比，测试后可以正常进行full=Y和owner=xxx的导入导出，且物化视图数据不变


![](https://pingcode.yasdb.com/atlas/files/public/67396a2da1ad9a3311dc7b59/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1MDcsImV4cCI6MTc4MjIyMjMwN30.lYidRwkFtAf4YORewBUMymBzaoT0e4MbF3Sd1YqL0b0)

##   [7.资料](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

  [DBMS_METADATA (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_METADATA.html#GUID-0DD1B9D5-367A-44D6-B8D5-C5B778D911DA)  

  [CREATE MATERIALIZED VIEW | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20MATERIALIZED%20VIEW.html)  

  [物化视图CREATE/DROP设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=126746885)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments: