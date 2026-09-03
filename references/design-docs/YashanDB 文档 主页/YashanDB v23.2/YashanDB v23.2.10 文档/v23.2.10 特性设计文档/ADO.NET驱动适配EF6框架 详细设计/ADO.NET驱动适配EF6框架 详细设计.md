Created by 方少奎, last modified on 八月 12, 2024

  


* IR链接：YASHAN-2876*

*SR链接：YDBRD-29581，YDBRD-29584*

## 1. 总述

为了降低关系方面和面向对象的方面之间的阻抗不匹配，使开发人员能够使用表示应用程序域的强类型 .NET 对象来编写应用程序，

使应用程序可与存储在关系数据库中的数据交互，同时也使开发人员无需再编写大部分的数据访问“管道”代码，

Yashandb .NET驱动实现Entity Framework6框架。

### 1.1 需求来源

适应时市场需求，ADO.NET驱动适配Entity Framework 6框架。

### 1.2 调研文档

  [Oracle EF6框架调研文档 - 方少奎 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159439052)  

### 1.3 需求分析

EF6框架支持开发者用户定义数据模型，管理模型，操作模型数据集，修改元数据能力；

不依赖于任何 EF 类型的     POCO     实体类的映射，支持使用LINQ（语言集成查询）转换成SQL查询。

场景视图如下：

![](https://pingcode.yasdb.com/atlas/files/public/67395f608970c2af4f51cdb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUVBQUpHQUFBUkNBQ0FBQUFCQUFBQUFBaUFBQUFBQUlBQUVDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUwNDEsImV4cCI6MTc4MjM1NTg0MX0.N_BR4TPM0MUXb5C1IxZJIvKXjoIBJ-2kZEoGiwNpK9c)

EF框架上级层级逻辑关系如下：

![](https://pingcode.yasdb.com/atlas/files/public/67395f608970c2af4f51cdb8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUVBQUpHQUFBUkNBQ0FBQUFCQUFBQUFBaUFBQUFBQUlBQUVDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUwNDEsImV4cCI6MTc4MjM1NTg0MX0.N_BR4TPM0MUXb5C1IxZJIvKXjoIBJ-2kZEoGiwNpK9c)

  


本次需求主要需要实现以下模块，继承实现System.Data.Entity.Core.Common相关接口，具体模块如下：

|属性|场景名称|方案设计|关键技术点|特性是否涉及|总7k+行代码|
|---|---|---|---|---|---|
|功能1|Edm--Store类型映射|实现实体类型与存储类型映射|是|是|  
|
|功能2|Command定义工厂|实现Command定义工厂，包括建库删库|是|是|  
|
|功能3|SQL构造器|根据Command树生成对应的CURD语句|是|是|4k+行代码|
|功能4|Migration模式|构造DDL和CURD相关Statement|是|是|  
|


功能3详细设计：    [SQL构造器详细设计文档 - 方少奎 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=162989329)  

开发视图如下：

![](https://pingcode.yasdb.com/atlas/files/public/67395f608970c2af4f51cdb9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUVBQUpHQUFBUkNBQ0FBQUFCQUFBQUFBaUFBQUFBQUlBQUVDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUwNDEsImV4cCI6MTc4MjM1NTg0MX0.N_BR4TPM0MUXb5C1IxZJIvKXjoIBJ-2kZEoGiwNpK9c)

|类|功能|
|---|---|
|YasdbProviderServices|Command构建定义服务工厂，用于返回manifets对象和注册solver对象；,并且在CodeFirst模式下，用于构造出CURD和建表删表的Command的工厂。|
|YasdbProviderManifest|类型映射类，加载自定义类型映射关系，主要提供基于Edm类型返回Store类型，和基于Store类型返回Edm类型的能力。|
|YasdbMigrationSqlGenerator|migration模式SQL构造器。在CodeFirst Migration模式下，用于构造DDL和EF框架的CURD语句。|
|OpDispatcher|Migration委托事件，用于区分CodeFirst Migration模式下，不同的MigrationOperation对应不同的处理事件。|
|DeleteGenerator|Delete语法构造器。|
|InsertGenerator|Insert语法构造器。|
|SelectGenerator|Select语法构造器。|
|UpdateGenerator|Update语法构造器。|
|FunctionGenerator|函数语法构造器。|
|YasdbDependencyResolver|提供程序依赖解决方案。用于注册服务工厂，连接工厂，客户端工厂，Migration构造器等。|
|YasdbProviderFactoryResolver|提供Connect工厂的解决方案。主要用于根据Connect返回对应的客户端工厂。|
|YasdbManifestTokenResolver|提供manifest映射工厂的解决方案。主要用于返回manifest对象。|


  


Entity Framework框架在加载类型映射时需要进行双向映射校验，来确保实体模型与存储模型相互转化时的唯一性，这要求开发者拓展EF框架时，需要确保Edm type与Store type的双向映射，即接口  GetEdmType()和接口GetStoreType()返回的结果能够双向匹配。

同时Entity Framework框架提供了Command定义接口  CreateDbCommandDefinition()  ，使得开发能够自由适配新数据库语法。

以下EF框架简单实例进程调用过程：

  


![](https://pingcode.yasdb.com/atlas/files/public/67395f60a1ad9a3311dc4c2f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUVBQUpHQUFBUkNBQ0FBQUFCQUFBQUFBaUFBQUFBQUlBQUVDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUwNDEsImV4cCI6MTc4MjM1NTg0MX0.N_BR4TPM0MUXb5C1IxZJIvKXjoIBJ-2kZEoGiwNpK9c)

### 1.4 数据字典

### 1.5 开源依赖

## 2. 接口

DbXmlEnabledProviderManifest相关接口：

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|GetDbInformation(string informationType)|返回值：XmlReader|返回自定义数据存储信息。|是|
|GetEdmType(TypeUsage storeType)|返回值：TypeUsage|将指定的存储类型和该类型的一组方面映射到 EDM 类型。|是|
|GetStoreType(TypeUsage edmType)|返回值：TypeUsage|将指定的 EDM 类型和该类型的一组方面映射到存储类型。|是|
|SupportsEscapingLikeArgument(out char escapeCharacter)|返回值：bool|是否支持转义字符串以用作 Like 表达式中的模式。|是|
|EscapeLikeArgument(string argument)|返回值：string|返回带有通配符和转义字符的参数。|是|


DbProviderServices相关接口：

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|CreateDbCommandDefinition(DbProviderManifest providerManifest, DbCommandTree commandTree)|返回值：DbCommandDefinition|返回CommandTree创建的Command定义对象。|是|
|GetDbProviderManifest(string manifestToken)|返回值：DbProviderManifest|返回DbProviderManifest的实例。|是|
|GetDbProviderManifestToken(DbConnection connection)|返回值：string|返回给定连接的版本（未使用）。|是|
|DbCreateDatabaseScript(string providerManifestToken, StoreItemCollection storeItemCollection)|返回值：string|生成数据定义语言 （DDL） 脚本，该脚本基于StoreItemCollection 参数的内容创建架构对象（表、主键、外键），使用特定于数据库的DDL 命令分隔符分隔各个语句。预计生成的脚本将在具有足够权限的现有数据库的上下文中执行，并且不应包含用于创建数据库的命令，但可以包含用于创建架构和其他辅助对象（如序列等）的命令。|是|
|DbCreateDatabase(DbConnection connection, int? commandTimeout, StoreItemCollection storeItemCollection)|无返回值|创建由 connection 指示的数据库，并根据StoreItemCollection 的内容创建架构对象（表、主键、外键）。|是|
|DbDatabaseExists(DbConnection connection, int? commandTimeout, StoreItemCollection storeItemCollection)|返回值：bool|返回是否存在给定的数据库。|是|
|DbDeleteDatabase(DbConnection connection, int? commandTimeout, StoreItemCollection storeItemCollection)|无返回值|删除指定的数据库。|是|


MigrationSqlGenerator相关接口:

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|Generate(IEnumerable<MigrationOperation> migrationOperations, string providerManifestToken)|返回值：IEnumerable  <  MigrationStatement  >|将一组迁移操作转换为特定于数据库提供程序的 SQL。|是|
|Generate(UpdateDatabaseOperation updateDatabaseOperation)|返回值：IEnumerable  <  MigrationStatement  >|在编写更新数据库操作的脚本时使用，用于存储本来对数据库执行的操作。|是|
|Generate(SqlOperation sqlOperation)|返回值：IEnumerable  <  MigrationStatement  >|直接针对目标数据库执行的特定于提供程序的 SQL 语句。|是|
|Generate(HistoryOperation historyOperation)|返回值：IEnumerable  <  MigrationStatement  >|对迁移历史记录表的 DML 更改的操作。|是|
|Generate(CreateTableOperation createTableOperation)|返回值：IEnumerable  <  MigrationStatement  >|建表|是|
|Generate(RenameTableOperation renameTableOperation)|返回值：IEnumerable  <  MigrationStatement  >|修改表名|是|
|Generate(DropTableOperation dropTableOperation)|返回值：IEnumerable  <  MigrationStatement  >|删除表|是|
|Generate(AddColumnOperation addColumnOperation)|返回值：IEnumerable  <  MigrationStatement  >|增加列|是|
|Generate(AlterColumnOperation alterColumnOperation)|返回值：IEnumerable  <  MigrationStatement  >|修改列类型|是|
|Generate(RenameColumnOperation renameColumnOperation)|返回值：IEnumerable  <  MigrationStatement  >|修改列名|是|
|Generate(DropColumnOperation dropColumnOperation)|返回值：IEnumerable  <  MigrationStatement  >|删除列|是|
|Generate(AddForeignKeyOperation addForeignKeyOperation)|返回值：IEnumerable  <  MigrationStatement  >|增加外键|是|
|Generate(DropForeignKeyOperation dropForeignKeyOperation)|返回值：IEnumerable  <  MigrationStatement  >|删除外键|是|
|Generate(AddPrimaryKeyOperation addPrimaryKeyOperation)|返回值：IEnumerable  <  MigrationStatement  >|增加主键|是|
|Generate(DropPrimaryKeyOperation dropPrimaryKeyOperation)|返回值：IEnumerable  <  MigrationStatement  >|删除主键|是|
|Generate(CreateIndexOperation createIndexOperation)|返回值：IEnumerable  <  MigrationStatement  >|创建索引|是|
|Generate(DropIndexOperation dropIndexOperation)|返回值：IEnumerable  <  MigrationStatement  >|删除索引|是|
|Generate(RenameIndexOperation renameIndexOperation)|返回值：IEnumerable  <  MigrationStatement  >|重命名索引|是|
|Generate(CreateProcedureOperation createProcedureOperation)|返回值：IEnumerable  <  MigrationStatement  >|创建存储过程|是|
|Generate(DropProcedureOperation dropProcedureOperation)|返回值：IEnumerable  <  MigrationStatement  >|删除存储过程|是|


  


## 3. 规格与约束

1、不支持转化Time  ，interval year to month，interval day to second类型。

2、EF实体模型不支持定义属性为DateTimeOffset，TimeSpan，DbGeography和DbGeometry对象。

## 4. 特性

### 4.1 Edm--Store类型映射（TODO：类型映射需要评审）

参数说明：

Unicode：是否使用Unicode格式存储；

FixLength：存储类型长度是否固定；

MaxLength：存储类型支持的最大长度。

C#类型与数据库的对称映射关系如下：

|Edm type|Store type|YashanDB type|
|---|---|---|
|Binary (FixLength=true)|urowid|urowid|
|Binary (MaxLength<=8000)|raw|raw|
|Binary|blob|blob|
|Boolean|boolean|boolean|
|Byte|tinyint|tinyint|
|Decimal|number|number|
|Double|binary_double|binary_double|
|Guid|guid|raw(16)|
|Single|binary_float|binary_float|
|Int16|smallint|smallint|
|Int32|int|int|
|Int64|bigint|bigint|
|Int16|utinyint|smallint|
|Int32|usmallint|int|
|Int64|uint|bigint|
|Decimal|ubigint|number|
|String (FixLength=true, Unicode=true)|nchar|nchar(8000)|
|String (FixLength=true, Unicode=false)|char|char(8000)|
|String (FixLength=false, MaxLength<=8000)|varchar|varchar(32000)|
|String (FixLength=false, MaxLength>8000)|clob|clob|
|DateTime|timestamp|timestamp|
|Geometry|geometry|ST_GEOMETRY|


|Store type|Edm type|
|---|---|
|urowid|Binary|
|raw|Binary|
|blob|Binary|
|boolean|Boolean|
|tinyint|Byte|
|number|Decimal|
|binary_double|Double|
|guid|Guid|
|binary_float|Single|
|smallint|Int16|
|int|Int32|
|bigint|Int64|
|utinyint|Int16|
|usmallint|Int32|
|uint|Int64|
|ubigint|Decimal|
|nchar|String|
|char|String|
|varchar|String|
|clob|String|
|timestamp|DateTime|
|geometry|Geometry|


### 4.2   Command定义工厂

实现构建Command定义的工厂。

（1）查询数据模型是否存在。

查询ALL_TABLE视图，计算当前容器的schema下，是否存在数据模型对应的表。

|SQL格式|示例|
|---|---|
|***SELECT COUNT(*) FROM ALL_TABLES WHERE***,***(OWNER=***  ['schema' | user]  *** AND TABLE_NAME=***  'table_name'  ***)***,[OR (OWNER=['schema' | user] AND TABLE_NAME='table_name')]|SELECT COUNT(*) FROM ALL_TABLES WHERE (owner='REGRESS' and table_name='Comps');|


  


（2）删除Database（Context容器）

删除Context容器定义的所有数据模型对应的表，命名大小写敏感，同时删除迁移历史表。

|SQL格式|示例|
|---|---|
|***DROP TABLE IF EXISTS ***  [schema "."] table_name  *** CASCADE CONSTRAINTS***|DROP TABLE IF EXISTS "REGRESS"."Comps" CASCADE CONSTRAINTS;,DROP TABLE IF EXISTS "__MigrationHistory" CASCADE CONSTRAINTS;|
|***DROP SEQUENCE ***  [schema "."] sequence_name|DROP SEQUENCE "REGRESS"."SQ_Comps";|


  


（3）创建Database（Context容器）

创建Context容器定义的所有数据模型对应的表，命名大小写敏感，同时创建迁移历史表。

创建对应表的序列。

如果表中存在数字类型的主键，设置主键默认值为序列的nextval值；

如果表中存在日期类型的主键，设置默认值为  CURRENT_TIMESTAMP。

|示例|
|---|
|create sequence "REGRESS"."SQ_Comps";|
|CREATE TABLE "REGRESS"."Comps" (,        "Id" int NOT NULL default "REGRESS"."SQ_Comps".NEXTVAL, ,        "Name" clob NULL, ,        "DateBegan" timestamp(8) NOT NULL, ,        "NumEmployees" int NOT NULL,,        CONSTRAINT "PK_Comps" PRIMARY KEY ("Id"),);|
|CREATE TABLE "__MigrationHistory" (,        "MigrationId" varchar(150) NOT NULL,,        "ContextKey" varchar(300) NOT NULL,,        "Model" blob NOT NULL,,        "ProductVersion" varchar(32) NOT NULL,,        CONSTRAINT "PK___MigrationHistory" PRIMARY KEY ("MigrationId", "ContextKey"),);|


### 4.3 CRUD的SQL构造器

### 4.4 Migration SQL构造器

在DbMigrationsConfiguration中设置  AutomaticMigrationsEnabled = true，开启migration模式。

此时，EF框架初始化容器时，不再通过ProviderServices.DbCreateDatabase创建表，而是通过MigrationOperation构造MigrationStatement执行创建表行为。

![](https://pingcode.yasdb.com/atlas/files/public/67395f61a1ad9a3311dc4c30/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUVBQUpHQUFBUkNBQ0FBQUFCQUFBQUFBaUFBQUFBQUlBQUVDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUwNDEsImV4cCI6MTc4MjM1NTg0MX0.N_BR4TPM0MUXb5C1IxZJIvKXjoIBJ-2kZEoGiwNpK9c)

|MigrationOperation|MigrationStatement|
|---|---|
|CreateTableOperation|CREATE SEQUENCE "REGRESS"."SQ_Comps";,CREATE TABLE "REGRESS"."Comps" (,        "Id" int NOT NULL default "REGRESS"."SQ_Comps".NEXTVAL, ,        "Name" clob NULL, ,        "DateBegan" timestamp(8) NOT NULL, ,        "NumEmployees" int NOT NULL,,        CONSTRAINT "PK_Comps" PRIMARY KEY ("Id"),);|
|RenameTableOperation|ALTER TABLE [schema"."]table_name RENAME TO new_name|
|DropTableOperation|DROP TABLE [schema"."]  Comps  ;,drop sequence "REGRESS"."SQ_Comps"|
|AddColumnOperation|ALTER TABLE [schema"."]table_name add ( column_clause )|
|AlterColumnOperation|ALTER TABLE [schema"."]table_name modify ( column_clause )|
|RenameColumnOperation|ALTER TABLE [schema"."]table_name RENAME COLUMN column_name TO new_name|
|DropColumnOperation|ALTER TABLE [schema"."]table_name DROP COLUMN column_name|
|AddForeignKeyOperation|ALTER TABLE [schema"."]table_name1 ADD CONSTRAINT fk_name FOREIGN KEY (fk_column1) REFERENCES [schema"."]table_name2 (fk_column2) ['ON DELETE CASCADE']|
|DropForeignKeyOperation|ALTER TABLE [schema"."]table_name DROP CONSTRAINT fk_name|
|AddPrimaryKeyOperation|ALTER TABLE [schema"."]table_name ADD CONSTRAINT pk_name PRIMARY KEY (pk_column)|
|DropPrimaryKeyOperation|ALTER TABLE [schema"."]table_name DROP CONSTRAINT pk_name|
|CreateIndexOperation|CREATE ['UNIQUE'] INDEX index_name ON [schema"."]table_name(index_column)|
|DropIndexOperation|DROP INDEX index_name|
|Rename  IndexOperation|ALTER INDEX index_name RENAME TO index_new_name|
|CreateProcedureOperation|CREATE OR REPLACE PROCEDURE {name}({column}) IS     
,BEGIN ,{procedure body} ,END;|
|DropProcedureOperation|DROP PROCEDURE IF EXISTS {name}|


  


### 4.5 特性可维可测设计

### 4.6 特性安全设计

### 4.7 特性周边配合

## 5. Testcases（自测用例）

yasdb配置设置1：

```
<entityFramework>
    <defaultConnectionFactory type="Yashandb.Data.EntityFramework.YasdbConnectionFactory, Yashandb.Data.EntityFramework" />
    <providers>
        <provider invariantName="Yashandb.Data.EntityFramework" type="Yashandb.Data.EntityFramework.YasdbProviderServices, Yashandb.Data.EntityFramework" />
    </providers>
</entityFramework>
```

yasdb配置设置1：

在DbContext定义时使用[DbConfigurationType(typeof(YasdbEFConfiguration))]进行配置注入。

示例：

```
public class Comp
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }
    public string Name { get; set; }
    public DateTime DateBegan { get; set; }
    public int NumEmployees { get; set; }
}

[DbConfigurationType(typeof(YasdbEFConfiguration))]
public class DefaultContext : DbContext
{
    public DefaultContext(string connStr) : base(connStr)
    {
        Database.SetInitializer<DefaultContext>(null);
    }

    protected override void OnModelCreating(DbModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("REGRESS");
    }

    public DbSet<Comp> Comps { get; set; }
}
public class EfProgram
{
    internal void SimpleJoin()
    {
        using (DefaultContext ctx = new DefaultContext("name=DefaultConnection"))
        {
            ctx.Database.Delete();
            ctx.Database.CreateIfNotExists();
            Comp c = new Comp {Name = "aa", DateBegan = DateTime.Now, NumEmployees = 10};
            ctx.Comps.Add(c);
            ctx.SaveChanges();
            foreach (var val in ctx.Comps)
            {
                Console.WriteLine(val.Name);
            }
        }
    }
}
```

```
public class JourneyContext : DbContext
{
    public DbSet<MyPlace> MyPlaces { get; set; }
    public JourneyContext() : base(CodeFirstFixture.GetEFConnectionString<JourneyContext>())
    {
        Database.SetInitializer<JourneyContext>(new JourneyInitialize<JourneyContext>());
        Database.SetInitializer<JourneyContext>(new MigrateDatabaseToLatestVersion<JourneyContext, JourneyConfiguration>());
    }
}

public class JourneyInitialize<TContext> : IDatabaseInitializer<TContext> where TContext : DbContext
{
    public void InitializeDatabase(TContext context)
    {
        context.Database.Delete();
        context.Database.CreateIfNotExists();
        this.Seed(context);
        context.SaveChanges();
    }
}

public class JourneyConfiguration : DbMigrationsConfiguration<JourneyContext>
{
    public JourneyConfiguration()
    {
        CodeGenerator = new MySqlMigrationCodeGenerator();
        AutomaticMigrationsEnabled = true;
        SetSqlGenerator("Yashandb.Data.YashandbClient", new YasdbMigrationSqlGenerator());
    }
}
```

## 6.资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

## 7.未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-7-23_10-41-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjBhMWFkOWEzMzExZGM0YzI5IiwicmVmX2lkIjoiNjczOTVmNjA3MjgyMDZlZmI5MmViZGU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MDQwLCJleHAiOjE3ODI0MzE0NDB9.7WT3L_WeUo7KarqQNdv_UiyjcF7UdxxkNoAxlOtrRGM)

 (image/png)    


[image2024-7-23_11-52-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjA4OTcwYzJhZjRmNTFjZGIyIiwicmVmX2lkIjoiNjczOTVmNjA3MjgyMDZlZmI5MmViZGU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MDQwLCJleHAiOjE3ODI0MzE0NDB9.eCP4wHNmH2g4JHHTKnf9598gDAOZziNPmVhXGew83ao)

 (image/png)    


[image2024-7-23_11-56-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjA4OTcwYzJhZjRmNTFjZGIzIiwicmVmX2lkIjoiNjczOTVmNjA3MjgyMDZlZmI5MmViZGU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MDQwLCJleHAiOjE3ODI0MzE0NDB9.sjR3TeSN4lOCYkp5iMxNeccj9Sum0LO2-yfH27GT91s)

 (image/png)    


[image2024-7-23_15-46-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjA4OTcwYzJhZjRmNTFjZGI0IiwicmVmX2lkIjoiNjczOTVmNjA3MjgyMDZlZmI5MmViZGU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MDQwLCJleHAiOjE3ODI0MzE0NDB9.e7FE8hLQEPC2_CYg7_2ziDo8--Qq0yU7lu29siPa1k8)

 (image/png)    


[image2024-7-25_18-52-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjBhMWFkOWEzMzExZGM0YzJiIiwicmVmX2lkIjoiNjczOTVmNjA3MjgyMDZlZmI5MmViZGU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MDQwLCJleHAiOjE3ODI0MzE0NDB9.M6IOYks7wQ2fjpnYlLYdyKVcOrwFcJuzpOTX_W6doks)

 (image/png)    


[image2024-7-25_19-30-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjBhMWFkOWEzMzExZGM0YzJkIiwicmVmX2lkIjoiNjczOTVmNjA3MjgyMDZlZmI5MmViZGU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MDQwLCJleHAiOjE3ODI0MzE0NDB9.EHUXMz_QMMxUq0gAm3fPwg6wQyKNqBvZb2Z2lrWGRC0)

 (image/png)    
