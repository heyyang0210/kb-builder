Created by 龚雯, last modified on 十一月 15, 2024

  


*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2aa](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2aa)    *?*    
  *#YASHAN-858 【GIS】geometry列数据类型支持PostGIS语法和行为兼容*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618f29bfd997db58ad84fa3](https://pingcode.yasdb.com/pjm/items/6618f29bfd997db58ad84fa3)    *?*    
  *#YDBRD-26207 Geometry列声明支持指定子类型、SRID*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

深燃新管道完整性系统需要指定geometry子类型，具体  客户场景：

1、create\alter table时列数据类型支持形如geometry(point, 4326)语法

2、当insert/update时，如果geomtry的子类型与声明不匹配，返回错误；如果srid与声明不匹配，返回错误；如srid未指定，则使用声明的srid

3、支持geometry_columns视图

部署形态：单机行存

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**调研文档链接：**    [gis支持geometry_columns特性开发调研文档](156128561.html)  

**参考资料链接：**    [https://postgis.net/docs/manual-3.5/using_postgis_dbmanagement.html#Create_Spatial_Table](https://postgis.net/docs/manual-3.5/using_postgis_dbmanagement.html#Create_Spatial_Table)  

**我们的功能参考pg，语法、geometry_columns视图和pg一致，支持的子类型、srid与崖山gis当前规格一致**

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|ddl支持新语法|parse和verify阶段对subtype和srid进行解析校验，execute阶段把对应字段写到系统表中。加载dc时查系统表，如果需要check子类型，把对应字段加载到ColTypeDesc上|是|是|
|功能|dml中支持对geometry子类型的校验|insert和update中检测列定义是否需要校验geometry修饰符，如果需要校验，调用gis插件提供的check函数，check函数的入参是dml中实际的Variant数值、要满足的各项参数|是|是|
|功能|支持在geometry_columns视图中查看所有geometry类型的列信息，包括子类型、srid等信息|修改geometry_columns视图定义，结合新增的geometry_col$系统表进行查询，获取具体的子类型、维度和srid信息|是|是|
|性能|性能场景1|----|是/否|否|
|可用性|恢复场景|----|是/否|否|
|可靠性|故障场景|----|是/否|否|
|可维可测|DFX功能1|----|是/否|否|
|安全|安全场景1|----|是/否|否|
|易用性|----|----|是/否|否|
|可修改性|----|----|是/否|否|
|兼容性|数据库升级，升级前表中有geometry类型的列|升级前默认为不指定子类型的列，不指定子类型的列不写到系统表中|是/否|是|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否(导入导出不支持gis)|


  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|coord_dimension|gis数据维度，包括二维、三维、四维|是|pg|
|srid|gis数据参考坐标系|是|pg|
|subtype|子类型，带zm|是|pg|
|spatial type|子类型，不带zm|是|pg|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

### 1.新增的语法（create table / alter table add column）

![](https://pingcode.yasdb.com/atlas/files/public/6739dd7ca1ad9a3311de157f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ5MzUsImV4cCI6MTc4MjMzNTczNX0.NI8L5KzO4gjy_eyU1diwDjhh2W4Rtpql97j57vSYEFQ)

**subtype可选字符串：**

POINT、LINESTRING、POLYGON、MULTIPOINT、MULTILINESTRING、MULTIPOLYGON、  GEOMETRYCOLLECTION、GEOMETRY

POINTZ、LINESTRINGZ、POLYGONZ、MULTIPOINTZ、MULTILINESTRINGZ、MULTIPOLYGONZ、GEOMETRYCOLLECTIONZ、GEOMETRYZ

subtype可以被一对单引号或双引号括起来，subtype大小写不敏感

  


**srid范围：**

先判断是否为int，超过int范围或是小数报错；满足为int时，如果是负数，转为0

插入的数据如果srid是0，插入后会改写为ddl中指定的srid

### 2.insert/update限制

|ddl指定的子类型|子类型限制|zm限制|
|---|---|---|
|未指定|无限制|无限制|
|geometry|无限制|与ddl中指定的一致|
|其他类型x|与ddl中指定的一致|与ddl中指定的一致|


|ddl指定的srid|srid限制|插入数据的实际srid|
|---|---|---|
|未指定|无限制|insert语句中指定的srid|
|0|无限制|insert语句中指定的srid|
|正数x|x或0|x（指定为0会转为x）|


### 3.视图修改

geometry_columns视图字段，要修改的字段已标红，其他字段值不变

|列名|含义|示例|
|:---|:---|:---|
|f_table_catalog|目录名，即数据库名|test|
|f_table_schema|表所属用户名|regress|
|f_table_name|geometry列所在表的名称|tb1|
|f_geometry_column|geometry列的名称|c1|
|coord_dimension|列的坐标维度（2或3）|2|
|srid|坐标几何的空间参考系统的 ID,~~是~~  ~~spatial_ref_sys~~  ~~表的外键引用~~|12,0（不指定默认为0）|
|type|空间对象的类型,单一类型可以是：POINT、LINESTRING、POLYGON、MULTIPOINT、MULTILINESTRING、MULTIPOLYGON、  GEOMETRYCOLLECTION,或相应的 XYM 版本 POINTM、LINESTRINGM、POLYGONM、MULTIPOINTM、MULTILINESTRINGM、MULTIPOLYGONM、GEOMETRYCOLLECTIONM（暂不支持M）|geometry（未指定子类型）,point（指定point）|


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|### create table / alter table add column中类型为geometry时指定子类型|----|是|
|SQL语法|### create table / alter table add column中类型为geometry时指定子类型和srid|----|是|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|geometry_columns视图，字段和类型不变，  coord_dimension、srid、type字段符合子类型和srid的约束|----|是|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|ddl中子类型末尾是m，报错"geometry supports dimension M"未完成|----|是|
|错误码|dml中新的数据不符合约束，报错不符合的约束|  
|是|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**1.若未安装gis插件或安装了旧版本的插件，支持ddl指定修饰符，但不支持向指定gis修饰符的列插入数据**

**2.当前geometry不支持维度m，只支持二维或三维z，若指定三维m或四维，ddl语句报错**

**3.dml中srid的范围是int，若为负数转换为0，若为小数四舍五入（与其他gis函数规格一致）；ddl中必须是int范围的整数，若为负数转为0**

**4.支持的子类型：POINT、LINESTRING、POLYGON、MULTIPOINT、MULTILINESTRING、MULTIPOLYGON、**  **GeometryCollection**

**5.不支持数组、嵌套类型等复杂类型中指定geometry子类型**

**6.继承数据类型时只继承geometry，不继承子类型（%rowtype）**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#4-%E7%89%B9%E6%80%A7)  

```


```

ddl中的新增语法（create table/alter table add column）

![](https://pingcode.yasdb.com/atlas/files/public/6739dd7ca1ad9a3311de157f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ5MzUsImV4cCI6MTc4MjMzNTczNX0.NI8L5KzO4gjy_eyU1diwDjhh2W4Rtpql97j57vSYEFQ)

*用例：*

*create table t(c geometry);  *

*create table t(c geometry(geometry));*

*create table t(c geometry(point,123));*

*alter table t add column (c geometry(point,55));*

新增结构体GeometryModifier，在parse时存储解析到的修饰符，即subtype字符串和srid，在verify阶段用于校验subtype和srid。结构体在parse阶段挂在TypeDesc的refObj上。如果是geometry不带子类型，TypeDesc.refObj=NULL。如果srid是负数，srid转换为0。

```
typedef struct StGeometryModifier
{
    CodText     subtype;
    CodUint32   srid;
    CodUint8    unused[4];
}GeometryModifier;
```

新增结构体GeometryCheckInfo。ColumnDef新增字段hasGeometryModifier。

```
typedef struct StGeometryCheckInfo {
    CodUint32   srid;
    CodBool     hasZ;
    CodBool     hasM;
    CodUint8    geomType;
    CodUint8    unused;
} GeometryCheckInfo;

typedef struct StColumnDef {
    LangText   name;
    CodBool    nullable;
    CodUint8   reserved[7];
    TypeDesc   typeDesc;
    LangText   defaultText;
    Variant    defaultVal;
    CodPointer defaultExpr;
    union {
        LobDef*     lobDef;
        struct {
            UdtDict*    udtDict;
            NestedTableDef* ntabDef;
        };
    };
    union {
        CodUint32  flags;
        struct {
            CodUint32 seqInDefault : 1;
            CodUint32 lobInDefault : 1;
            CodUint32 isNullableSet : 1;
            CodUint32 isInherited : 1;
            CodUint32 isHidden : 1;
            CodUint32 sysGenerated : 1;
            CodUint32 isVirtual : 1;
            CodUint32 isAdtAttr : 1;
            CodUint32 isTypeId : 1;
            CodUint32 storeAsLob : 1;
            CodUint32 deleted : 1;
            CodUint32 varStoreLob: 1;
            CodUint32 unUpdatable : 1;
            CodUint32 unInsertable : 1;
            CodUint32 unDeletable : 1;
            CodUint32 hasGeometryModifier : 1;
            CodUint32 unused : 16;
        };
    };
    Compression      compression;
    CompressionLevel compressionLevel;
    Encoding         encoding;
    CodUint32        cardinality;
} ColumnDef;
```

在verify时校验  GeometryModifier里记录的修饰符信息，转换成srid、typeid、has_z、has_m，取代GeometryModifier挂在TypeDesc的refObj上。

新增全局变量gStGeometryToid为geometry类型的toid。

在verify阶段，对udt检查refObj是否为null，若为null不处理。若不为null，校验列类型的toid是否等于geometry类型的toid。如果  两个toid相等，说明是geometry类型且带子类型指定，ColumnDef.hasGeometryModifier置为true，并调用函数校验子类型字符串。

  


新增系统表  ~~MDSYS. ~~  SYS.GEOMETRY_COL$，存储有子类型的列的信息。没有指定修饰符的列不会写入该表。

|列名|含义|类型|
|---|---|---|
|OBJ#|表的oid|BINARY_BIGINT|
|COL#|列id，第几列，从0开始，包含隐藏列|BINARY_SMALLINT|
|SPATIAL_TYPE|子类型对应id,子类型指point，不包含pointz等，z和m在后面字段体现|BINARY_SMALLINT|
|has_z|是否支持z坐标|BINARY_TINYINT|
|has_m|是否支持m坐标|BINARY_TINYINT|
|srid|空间坐标系|BINARY_INTEGER|


system_tables.sql中新增SQL：

```
create table SYS.GEOMETRY_COL$
(
    OBJ# BINARY_BIGINT NOT NULL,
    COL# BINARY_SMALLINT NOT NULL,
    SPATIAL_TYPE BINARY_SMALLINT,
    HAS_Z BINARY_TINYINT,
    HAS_M BINARY_TINYINT,
    SRID BINARY_INTEGER NOT NULL
) ORGANIZATION HEAP SYSTEM 238
/
create unique index I_GEOMETRY_COL on GEOMETRY_COL$(OBJ#, COL#)
/
create or replace public synonym GEOMETRY_COL$ for SYS.GEOMETRY_COL$
/
```

在create table/alter table add column操作的execute阶段，如果ColumnDef.hasGeometryModifier为true，向系统表插入数据。

在alter table drop column/drop table的execute阶段，删除系统表对应行。

系统表中subtype对应关系

|subtype_name|SPATIAL_TYPE|
|---|---|
|POINT|1|
|LINESTRING|2|
|POLYGON|3|
|MULTIPOINT|17|
|MULTILINESTRING|18|
|MULTIPOLYGON|19|
|GEOMETRYCOLLECTION|20|
|GEOMETRY|0|


ColTypeDesc新增needGeomCheck 和geomCheck字段。

在dc load时查询geometry_col$系统表，将有子类型的列的ColTypeDesc->needGeomCheck 置为true，geomCheck上挂载GeometryCheckInfo数据

```
typedef struct StColTypeDesc {
    CodUint64   oid;
    CodUint64   toid;
    union {
        CodUint32   flags;
        struct {
            CodUint32 isAdt : 1;
            CodUint32 isNestedTable : 1;
            CodUint32 isVarray : 1;
            CodUint32 isRef : 1;
            CodUint32 isSubstitutable : 1;
            CodUint32 isStorageSet : 1;
            CodUint32 isReturnLocator : 1;
            CodUint32 needGeomCheck : 1;
            CodUint32 unused : 24;
        };
    };
    CodUint16   colId;
    CodUint16   typeidCol;
    CodUint16   attrCount;
    CodUint16   rootColId;
    CodUint16   accessColumns;
    CodUint16*  attrColIds;
    union {
        GeometryCheckInfo geomCheck;
        struct {
            TableDict*  ntDc;
            AnkColumn*  ntColumn;
        };
    };
} ColTypeDesc;
```

###   [4.2 特性功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    -dml

insert和update时，检查ColTypeDesc->  needGeomCheck，若为true调用校验函数plgGeometryCheckModifier。

plgGeometryCheckModifier从插件提供的函数中寻找__GEOM_CHECK_MODIFIER__，调用该函数进行geometry的修饰符校验。

__GEOM_CHECK_MODIFIER__的入参为  Variant类型的  geometry数据、修饰符要求的子类型id、是否有z、是否有m、srid。

__GEOM_CHECK_MODIFIER__函数中对subtype、hasZ、hasM进行校验，不满足返回报错。若指定的子类型为geometry，不校验子类型。若修饰符要求的srid为0，srid不作校验；若修饰符要求的srid非0且实际srid为0，修改实际srid为修饰符中指定的srid重新生成geometry数据返回；若修饰符要求的srid非0且实际srid非0，判断是否相等。

###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    -视图

system_views.sql中新增视图SYS.__GEOMETRY_COLUMNS，修改MDSYS.GEOMETRY_COLUMNS定义为查SYS.__GEOMETRY_COLUMNS

```
CREATE OR REPLACE VIEW SYS.__GEOMETRY_COLUMNS(F_TABLE_CATALOG, F_TABLE_SCHEMA, F_TABLE_NAME, F_GEOMETRY_COLUMN, COORD_DIMENSION, SRID, TYPE) AS
SELECT (SELECT DATABASE_NAME FROM V$DATABASE), U.NAME, T.NAME, C.NAME,
       DECODE(G.OBJ#, NULL, 2, 2+G.HAS_Z+G.HAS_M),
       DECODE(G.OBJ#, NULL, 0, G.SRID),
       DECODE(G.OBJ#, NULL, 'GEOMETRY', CONCAT(DECODE(G.SPATIAL_TYPE, 0, 'GEOMETRY', 1, 'POINT', 2, 'LINESTRING', 3, 'POLYGON', 17, 'MULTIPOINT', 18, 'MULTILINESTRING', 19, 'MULTIPOLYGON', 20, 'GEOMETRYCOLLECTION', 'GEOMETRY'), DECODE(G.HAS_M-HAS_Z, 1, 'M', NULL)))
FROM SYS.USER$ U INNER JOIN SYS.OBJ$ T ON U.USER# = T.OWNER#
                 INNER JOIN SYS.COL$ C ON T.OBJ# = C.OBJ#
                 LEFT JOIN MDSYS.GEOMETRY_COL$ G ON G.OBJ# = T.OBJ# AND G.COL# = C.COL#
WHERE C.TYPE#=36
/

CREATE OR REPLACE VIEW MDSYS.GEOMETRY_COLUMNS(F_TABLE_CATALOG, F_TABLE_SCHEMA, F_TABLE_NAME, F_GEOMETRY_COLUMN, COORD_DIMENSION, SRID, TYPE) AS
SELECT * FROM SYS.__GEOMETRY_COLUMNS
/
```

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


ddl和dml的测试设计见xmind

执行ddl后查看geometry_columns视图

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

增加geometry_columns视图的文档

在create table/alter table文档中增加指定子类型的语法图和描述

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

未来新增支持的gis子类型时，插件和内核都需要增加subtype id的映射

## Attachments:

[gis支持subtype.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3Yjk0OTcxZTE1NTEyMzViZWVlYzhmIiwicmVmX2lkIjoiNjc3Yjk0OTcxZTE1NTEyMzViZWVlYzkzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0OTM1LCJleHAiOjE3ODI0MTEzMzV9.9TZLNmOL7Zal8yJgm1jWv39lmYaF0pbxb-OBsFOvyVQ)

 (application/x-xmind)    
