Created by 苏文, last modified on 一月 09, 2024

需求链接：

  [YDBRD-23050](https://jira.yasdb.com/browse/YDBRD-23050?src=confmacro)    -  【生态适配】支持应用通过sqlalchemy操作yasdb  完成

##   
    [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#1-overview%E6%A6%82%E8%BF%B0)  

SQLAlchemy是python中的ORM(Object Relational Mapping)工具。ORM通过对象与数据库交互，使得应用程序更加简洁易读；对接多种数据库操作基本一致，可移植性强。

![](https://docs.sqlalchemy.org/en/20/_images/sqla_arch_small.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFDQUFBQUFBQUFBRUFBQUFBQUFBQWdBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzOTYsImV4cCI6MTc4MjIyMzE5Nn0.qfPrb8nMX2Xyh2xbXSie7nsvYSLW51VV_cNhQ9Kyugk)

Dialect 是SqlAlchemy对接的核心接口，定义了底层数据库连接、执行的具体行为。数据库厂商提供对Dialet接口的适配实现就可以对接SQLAlchemy，适配模块通常以插件加载的方式接入。

SQLALchemy主动集成了oracle、postgresql、mysql、firebird、msssql、sqlite、sybase，其他数据库则是开源自己的方言包。

使用样例：

import yashandb_sqlalchemy    
  import sqlalchemy    
  from sqlalchemy import create_engine

engine = create_engine("yashandb+    [yaspy://sys:Cod-2022@127.0.0.1:1688/test](yaspy://sys:Cod-2022@127.0.0.1:1688/test)    ")

result = engine.execute("select 1 from dual")    
  for row in result:    
  print(row)

  


sqlalchemy url解释：

The string form of the URL is    
      ``dialect[+driver]://user:password@host/dbname[?key=value..]``, where    
      ``dialect`` is a database name such as ``mysql``, ``oracle``,    
      ``postgresql``, etc., and ``driver`` the name of a DBAPI, such as    
      ``psycopg2``, ``pyodbc``, ``cx_oracle``, etc.  Alternatively,

oracle可以是：

create_engine("oracle    [://scoott:tiger@loocalhost/test](yashandb://scoott:tiger@loocalhost/test)    ") 

# 或

create_engine("oracle+cx_oracle    [://scoott:tiger@loocalhost/test](yashandb://scoott:tiger@loocalhost/test)    ")

openGauss 可以是：

create_engine('opengauss://username:password@host:port/database_name')  # 或       
  create_engine('opengauss+psycopg2://username:password@host:port/database_name')  # 访问分布式模式DB  >>> create_engine('opengauss+dc_psycopg2://username:password@host:port/database_name')  # 或  >>> create_engine('opengauss+dc_psycopg2://username:password@/database_name?host=hostA:portA&host=hostB:portB')

### 1.1 概要设计

YashanDB 方言类继承sqlalchemy.engine.default.DefaultDialet并重写部分接口，提供符合sqlalchemy.engine.interface.Dialet规范要求的可发布模块。

![](https://pingcode.yasdb.com/atlas/files/public/67396a83a1ad9a3311dc7cb3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFDQUFBQUFBQUFBRUFBQUFBQUFBQWdBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzOTYsImV4cCI6MTc4MjIyMzE5Nn0.qfPrb8nMX2Xyh2xbXSie7nsvYSLW51VV_cNhQ9Kyugk)

  


sqlalchemy.sql.compiler.SQLCompiler, 用于编译一条SQL，包含绑定参数、投影列名等信息；

sqlalchemy.sql.compiler.DDLCompiler, 用于编译一条DDL SQL；

sqlalchemy.sql.compiler.GenericTypeCompiler，用于识别处理类型字段；

sqlalchemy.sql.compiler.IdentifierPreparer，用户识别、处理特殊字段；

sqlalchemy.engine.default.DefaultExecutionContext，用于处理SQL执行；

sqlalchemy.engine.default.DefaultDialet，方言接口默认实现类，拥有上述类示例，所有数据库方言包需继承该类并重写需要进行特殊适配的接口；

YasDialet_yaspy继承DefaultDialet，提供对接YashanDB的方言实现，其内部对应的实例类YasCompiler、YasDDLCompiler、YasTypeCompiler、YasIdentifierPreparer、YasExecutionContext分别继承图中其上方的默认实现类。

  


#### YashanDB方言模块

名称：yashandb_sqlalchemy

目录结构：

|---yashandb_sqlalchemy    
          |---__init__.py    
          |---base.py    
          |---provision.py    
          |---yaspy.py    
  |---setup.py    
  |---setup.cfg    
  |---    [READEME.md](http://READEME.md)  

  


setup.py定义插件entry_points，entry_points 的group名固定为sqlalchemy.dialets；接口名对应url的第一个字段，可以是dialect 或者dialect.dirver  **；**  模块名就是对SQLAlchemy Dialect接口的具体实现类。

用户创建引擎连接时使用yashandb(数据库名)或yashandb+yaspy（数据库名+python驱动名）对接YashanDB服务端。

setup(    
      name="yashandb-sqlalchemy",    
      version="1.0",    
      description="YashanDB Dialect for SQLAlchemy",    
      author="Cod",    
      author_email="Cod",    
      license="MIT",    
      packages=["yashandb_sqlalchemy"],    
      include_package_data=True,    
      entry_points={    
        "sqlalchemy.dialects": [    
            "yashandb = yashandb_sqlalchemy.yaspy:YasDialect_yaspy",    
            "yashandb.yaspy = yashandb_sqlalchemy.yaspy:YasDialect_yaspy",    
        ]    
      },    
  )

创建yashan db 连接引擎示例：

engine = create_engine("    [yashandb://username:password@host:port/database_name](yashandb://username:password@hostport)    ")

或

engine = create_engine("    [yashandb+yaspy://username:password@host:port/database_name](yashandb://username:password@hostport)    ")

  


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

|功能|设计表现|设计说明|
|:---|:---|:---|
|支持SQLAlchemy|插件入口：,entry_points={    
        "sqlalchemy.dialects": [    
            "yashandb = yashandb_sqlalchemy.yaspy:YasDialect_yaspy",    
            "yashandb.yaspy = yashandb_sqlalchemy.yaspy:YasDialect_yaspy",    
        ]    
      },|提供yashandb_sqlalchemy模块，继承并重写sqlalchemy.engine.default.DefaultDialet，,sqlalchemy.sql.compiler.SQLCompiler，,sqlalchemy.sql.compiler.DDLCompiler，,sqlalchemy.sql.compiler.GenericTypeCompiler，,sqlalchemy.sql.compiler.IdentifierPreparer，,sqlalchemy.engine.default.DefaultExecutionContext|
|  
|  
|  
|


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

  


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。

不支持或差异化特性/接口/配置/属性：

|  
|特性/接口/配置/属性|说明|python驱动相关|
|---|---|---|---|
|1|异步执行|未适配|未提供异步实现的python驱动|
|2|sqlalchemy.sql.dml.py:ValuesBase.return_defaults 支持不完全|returning 语法/out参数流程，返回类型支持不完整。,支持：,sqlalchemy.sql.sqltypes.Integer,其他类型都不支持：,sqlalchemy.sql.sqltypes.String(包括其子类 CHAR、VARCAHR等),,Text,,Unicode,,UnicodeText,,SmallInteger,,BigInteger,,Numberic,,Float,,DateTime,,Date,,Time,,Binary,,LargeBinary,,SchemaType,,Enum,,Boolean,,Interval，,JSON，,ARRAY，,REAL|不支持：,dbapi.STRING,,NUMBER,,DATETIME,,BINARY,,ROWID,  
,其他数据库类型需要通过扩展dbapi 类型映射，也需要支持。|
|3|sqlalchemy.sql.sqltypes类型|不支持：,LargeBinary，,DateTime（适配不正确，返回值缺少时分秒部分），,Text （默认映射为Clob类型，python类型对象实现未支持CLOB类型）,,Decimal(python驱动未支持decimal.Decimal 绑定入参解析),,UnicodeText,,Binary,,SchemaType,,Enum,,Interval，,JSON，,ARRAY|对象实现未支持LOB类型|
|4|sqlalchemy.testing.requirements属性|1）standalone_null_binds_whereclause 属性不支持：,where语法中绑定参数null类型推导问题，服务端filter报错无法比较：sqlalchemy.exc.DatabaseError: (yaspy.DatabaseError) [3:51]YAS-04311 cannot be compared    
  [SQL: SELECT       [date_table.id](http://date_table.id/)      
  FROM date_table    
  WHERE CASE WHEN (:foo IS NOT NULL) THEN :foo ELSE date_table.date_data END = date_table.date_data]    
  [parameters: [None, None]],2）implicit_decimal_binds 属性不支持：,python驱动未支持Number类型到 deciaml.Decimal类型映射，实际返回的是string值；,3） floats_to_four_decimals 属性不支持，即：sqlalchemy.sql.sqltypes.Float类型的asdecimal 属性不支持；,4）empty_strings_text 属性未支持，空串处理为PyNone，不支持返回空字符串；    
,5）empty_inserts_executemany 属性不支持；|python驱动处理deciaml.Decimal 绑定值有问题|
|5|sqlalchemy.sql.sqltypes.String 不支持不带长度|sqltypes.String 不指定长度时，报错；（Oracle表现相同）;,String(n)   映射到sql为 va  rcahr2（n char），单机OK，但是  **分布式还未支持n char 语法**  ；|  
|
|6|主键默认值|示例：,students = Table(    
  'test_students', meta,     
  Column('id', Integer,   **Sequence('stu_sql')**  , primary_key=True),     
  Column('name', String(20)),     
  Column('lastname', String(20)),    
  extend_existing=True,     
  ),meta.create_all(engine),conn = engine.connect(),conn.execute(students.insert(), dict(name = 'Ravi6', lastname = 'Kapoor6')),上述示例最后的insert未指定主键值；yashan需要 attach sequence到主键列（Oracle也是），执行效果是用sequence id 作为主键值；,这里对于客户迁移数据库，需要改写应用。,**分布式还未支持Sequence。**|  
|
|7|列包含双引号|方言包处理有问题，暂不支持|  
|
|8|元数据接口|支持：,get_schema_names，,get_temp_table_names,,get_view_names,,get_sequence_names,,get_columns,,get_table_comment,,get_indexes,,get_pk_constraint,,get_foreign_keys,,get_unique_constraints,,get_view_definition,,get_check_constraints,其他都不支持：    
  get_table_names,,get_table_options,|  
|


  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 5.1 Dialet接口适配

|  
|方法|python驱动是否支持|说明|
|---|---|---|---|
|1|def     type_descriptor  (  cls  ,   typeobj  ):|部分支持|提供对某类型的私有实现。,暂不支持类型：CLOB、NCLOB、BLOB、INTERVAL、ROWID、JSON|
|2|def     get_columns  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  ):|  
|元数据接口，直接在Dialet适配|
|3|def     get_pk_constraint  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|4|def     get_foreign_keys  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|5|def     get_table_names  (  self  ,   connection  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|6|def     get_temp_table_names  (  self  ,   connection  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|7|def     get_view_names  (  self  ,   connection  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|8|def     get_sequence_names  (  self  ,   connection  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|9|def     get_temp_view_names  (  self  ,   connection  ,   schema  =  None  ,   **  kw  )|  
|不支持|
|10|def     get_view_definition  (  self  ,   connection  ,   view_name  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|11|def     get_indexes  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|12|def     get_unique_constraints  (    
            self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw    
      )|  
|元数据接口，直接在Dialet适配|
|13|def     get_check_constraints  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|14|def     get_table_comment  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  )|  
|元数据接口，直接在Dialet适配|
|15|def     has_table  (  self  ,   connection  ,   table_name  ,   schema  =  None  ,   **  kw  )|  
|判断表是否存在，直接在Dialet适配|
|16|def     has_index  (  self  ,   connection  ,   table_name  ,   index_name  ,   schema  =  None  )|  
|判断索引是否存在，直接在Dialet适配|
|17|def     has_sequence  (  self  ,   connection  ,   sequence_name  ,   schema  =  None  ,   **  kw  )|  
|判断序列是否存在，直接在Dialet适配|
|18|def     _get_server_version_info  (  self  ,   connection  )|暂不支持|获取数据库版本信息。,在python驱动中增加支持|
|19|def     _get_default_schema_name  (  self  ,   connection  )|  
|直接在Dialet适配|
|20|def     do_begin  (  self  ,   dbapi_connection  )|  
|无需支持|
|21|def     do_rollback  (  self  ,   dbapi_connection  )|  
|回滚事务|
|22|def     do_commit  (  self  ,   dbapi_connection  )|  
|提交事务|
|23|def     do_terminate  (  self  ,   dbapi_connection  )|  
|关闭连接|
|24|def     do_close  (  self  ,   dbapi_connection  )|  
|关闭连接|
|25|def     do_set_input_sizes  (  self  ,   cursor  ,   list_of_tuples  ,   context  )|暂不支持|python驱动可以在调用 .execute*() 之前使用setinputsize()，预定义数据库操作参数所需的内存区域,可选|
|26|def     create_xid  (  self  )|  
|两阶段事务，暂不支持|
|27|def     do_prepare_twophase  (  self  ,   connection  ,   xid  )|  
|两阶段事务，暂不支持|
|28|def     do_rollback_twophase  (    
            self  ,   connection  ,   xid  ,   is_prepared  =  True  ,   recover  =  False    
      )|  
|两阶段事务，暂不支持|
|29|def     do_commit_twophase  (    
            self  ,   connection  ,   xid  ,   is_prepared  =  True  ,   recover  =  False    
      )|  
|两阶段事务，暂不支持|
|30|def     do_recover_twophase  (  self  ,   connection  )|  
|两阶段事务，暂不支持|
|31|def     do_savepoint  (  self  ,   connection  ,   name  )|  
|创建save point|
|32|def     do_rollback_to_savepoint  (  self  ,   connection  ,   name  )|  
|回滚到某save point|
|33|def     do_release_savepoint  (  self  ,   connection  ,   name  )|YashanDB不支持该特性|无需支持|
|34|def     do_executemany  (  self  ,   cursor  ,   statement  ,   parameters  ,   context  =  None  )|暂不支持|可选|
|35|def     do_execute  (  self  ,   cursor  ,   statement  ,   parameters  ,   context  =  None  )|  
|执行SQL|
|36|def     do_execute_no_params|  
|执行SQL|
|37|def     is_disconnect  (  self  ,   e  ,   connection  ,   cursor  )|  
|断连判断|
|38|def     connect  (  self  ,   *  cargs  ,   **  cparams  )|  
|创建连接|
|39|def     reset_isolation_level  (  self  ,   dbapi_conn  )|  
|设置session隔离级别|
|40|def     set_isolation_level  (  self  ,   dbapi_conn  ,   level  )|  
|设置session隔离级别|
|41|def     get_isolation_level  (  self  ,   dbapi_conn  )|  
|获取session隔离级别|
|42|def     get_default_isolation_level  (  self  ,   dbapi_conn  )|  
|设置session默认隔离级别|


  


创建连接，关键函数：

def     connect  (  self  , *  cargs  , **  cparams  ):    
            return     self  .  dbapi  .connect(*  cargs  , **  cparams  )

实现：

   @  classmethod    
        def     dbapi  (  cls  ):    
            import   yaspy

          return   yaspy

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#51-architecture%E6%9E%B6%E6%9E%84)  

  


  


###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#52-dfx%E8%AE%BE%E8%AE%A1)  

  


###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#53-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## 7. 自测用例

  


## 8    [. ](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)    参考文档

  [https://github.com/sqlalchemy/sqlalchemy/blob/main/README.dialects.rst](https://github.com/sqlalchemy/sqlalchemy/blob/main/README.dialects.rst)  

## Attachments:

[class_uml.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDY4OTcwYzJhZjRmNTFmZDc1IiwicmVmX2lkIjoiNjczOTZhNDY1OTNmOTljOWZmMjM1ODU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzk2LCJleHAiOjE3ODIyOTg3OTZ9.LzyDJ79UXdkGeyHQogUf8er_ijgaFwEo9i4uDiVPl5c)

 (image/png)    


[class_uml.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDc4OTcwYzJhZjRmNTFmZDc2IiwicmVmX2lkIjoiNjczOTZhNDY1OTNmOTljOWZmMjM1ODU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzk2LCJleHAiOjE3ODIyOTg3OTZ9.uctCexBDGLXRlDv0k7XQGAV6S9yPbFcfhYZV35SRU_8)

 (image/png)    
