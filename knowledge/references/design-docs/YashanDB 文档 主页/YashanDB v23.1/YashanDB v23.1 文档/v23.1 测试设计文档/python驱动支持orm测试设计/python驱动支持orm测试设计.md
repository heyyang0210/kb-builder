Created by 李美娥, last modified on 一月 15, 2024

# 1. 参考资料

        需求：       [YDBRD-23050](https://jira.yasdb.com/browse/YDBRD-23050?src=confmacro)    -  【生态适配】支持应用通过sqlalchemy操作yasdb  完成

        开发设计：    [SqlAlChemy框架对接 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=100090342)  

        测试概要设计：    [YDBRD-23050 测试概要设计 - 范瑜 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135618244)  

        对外提供的函数：清单待开发输出后补齐，下面是通过资料调研的Oracle适配的接口，对于oracle的单独适配，我们yashan均不保留。

|  
|  
|
|---|---|
|create_engine|1、max_identifier_length设置不同的值时，可以查看其编译的sql语句的长度不一样（结合naming_convention）,engine = create_engine(    
  "oracle+    [cx_oracle://scott:tiger@oracle122](null)    ",    
  max_identifier_length=30)    
  oracle_dialect = oracle.dialect(max_identifier_length=30)    
  max_identifier_length  在高版本默认值已经是128，对接低版本时，默认是30    
  2、  enable_offset_fetch    
  3、optimize_limits，默认值是false    
  4、use_binds_for_limits默认是true    
  5、  use_ansi  被设置成false,具有将所有JOIN短语转换为WHERE子句的效果，并且在LEFT OUTER JOIN的情况下，使用Oracle的（+）运算符    
  ,NVARCHAR2和NCLOB数据类型不再作为DDL生成，而是发出VARCHAR2和CLOB。(为false时，跟低版本数据库比如不支持NCLOB的，我们的结果）    
  备注：从库上用例搜索，还支持echo=True, future=True, pool_size=10, max_overflow=20|
|MetaData（继承未改造）|1、naming_convention    
  备注：从库上用例搜索，还支持  MetaData()、  MetaData(bind=engine)、  metadata.create_all(engine)、metadata.create_all()、metadata.drop_all(engine)、,metadata.create_all(connection) oracle可能并不支持里面传入的是engine|
|TABLE|1、类型,2、主键或约束,3、主键的时候，结合,Identity（start 递增值、Identity.aways设置为None以使用默认生成模式、Identity.on_null设置为True ）、  Sequence使用    
  4、  autoload_with  =  engine    
  5、  prefixes指定表空间,6、建表的时候指定  oracle_on_commit  (给临时表使用）    
  7、  oracle_compress  可以指定任意的integer（实测除0外，其他值不行，待继续研究）,指定为true对应的是默认的|
|INDEX|1、oracle_bitmap为TRUE创建的是btree索引，若带上unique=True或oracle_compress=1不支持的选项，orm不报错，底层数据库会检测,2、oracle_compress可以指定任意的integer,指定为true对应的是默认的|
|事务|READ COMMITTED 、SERIALIZABLE、AUTOCOMMIT采用的是alter session进行的操作，连接返回时，数据库恢复成默认值，不指定的时候其,默认值是 AUTOCOMMIT, Connection.get_isolation_level()、Connection.execution_options()，可设置用户对v$transaction表无读写权限，执行接,口会默认为READ COMMITTED（Oracle的低版本是报错，高版本是默认为READ COMMITTED）|
|大小写区分|## Identifier Casing|
|## LIMIT/OFFSET/FETCH|1、若create_engine设置enable_offset_fetch为false，使用 Select.limit() and Select.offset()内部将会强制转换为使用窗口函数, Select.limit() and Select.offset()and Query.limit() and Query.offset() |
|## RETURNING Support|   INSERT, UPDATE and DELETE   ,我们应该就支持execute跟insert结合，其他的都是要报错；executemany跟insert也要报错|
|## ON UPDATE CASCADE|deferrable=True, initially=’deferred’, and specify “passive_updates=False”,我们数据库本身不支持，这个orm估计不会适配|
|## Synonym/DBLINK Reflection|1、some_table = Table('some_table', autoload_with=some_engine,   oracle_resolve_synonyms=True  ),在系统表ALL_TABLES 、ALL_SYNONYMS里面有对应的信息，同时将同名词跟DBLINK关联，oracle可以通过dblink知道表的信息, MetaData.reflect() and Inspector.get_columns().|
|获取约束信息、表信息|1、Inspector.get_foreign_keys(), Inspector.get_unique_constraints(), Inspector.get_check_constraints(), and Inspector.get_indexes(),含inspect类，有上述方法，可以获取约束的信息,返回IS NOT NULL约束，需要设置include_all=True，否则返回的时NOT NULL。,若表上带primary key会有索引信息。索引列表不含SYS_NC开头的字段,2、 Inspector.get_table_names() and Inspector.get_temp_table_names()结果是 MetaData.reflect()的一部分，默认是SYSTEM and SYSAUX tablespaces,下的表，除非单独指定改变表空间,e = create_engine("oracle+    [cx_oracle://scott:tiger@xe",exclude_tablespaces=["SYSAUX](null)    ", "SOME_TABLESPACE"])|
|数据类型|BFILE, BLOB, CHAR, CLOB, DATE, DOUBLE_PRECISION, FLOAT, INTERVAL, LONG, NCLOB, NCHAR, NUMBER, NVARCHAR, NVARCHAR2, RAW, TIMESTAMP, VARCHAR, VARCHAR2,|


oracle单独实现的资料：

  [Oracle — SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/dialects/oracle.html)  

最终yashan的实现，不支持或差异化特性/接口/配置/属性（清单中未说明支持的，默认不支持，除最基本的用法是支持的）

|  
|特性/接口/配置/属性|说明|python驱动相关|  
|
|:---|:---|:---|:---|---|
|1|异步执行|未适配|未提供异步实现的python驱动|容错：test_sdv_YDBRD_23317_yb.py|
|2|sqlalchemy.sql.dml.py:ValuesBase.return_defaults 支持不完全|returning 语法返回类型支持不完整。,支持：,sqlalchemy.sql.sqltypes.Integer,其他类型都不支持：,sqlalchemy.sql.sqltypes.String,,Text,  Unicode,  UnicodeText,  SmallInteger,,BigInteger,  Numberic,  Float,,DateTime,  Date,  Time,  Binary,,LargeBinary,  SchemaType,  Enum,,Boolean,  Interval，  JSON，  ARRAY，REAL|不支持：,dbapi.STRING,,NUMBER,,DATETIME,,BINARY,,ROWID,  
,其他数据库类型需要通过扩展dbapi 类型映射，也需要支持。|insert into returning库上找用例，若无，单独写|
|3|sqlalchemy.sql.sqltypes类型|不支持：,LargeBinary，,DateTime（适配不正确，返回值缺少时分秒部分），,Text （默认映射为Clob类型，python类型对象实现未支持CLOB类型）,,UnicodeText,  Binary,  SchemaType,,Enum,  Interval，  JSON，  ARRAY|对象实现未支持LOB类型|BFILE, BLOB, CHAR, CLOB, DATE, DOUBLE_PRECISION, FLOAT, INTERVAL, LONG, NCLOB, NCHAR, NUMBER, NVARCHAR, NVARCHAR2, RAW, TIMESTAMP, VARCHAR, VARCHAR2,测试支持程度，我们不支持DOUBLE_PRECISION、TIMESTAMP(timezone=True)、N类型是lsc表不支持，VARCHAR相关的、Unicode(255)都会映射成类似这种 VARCHAR(50 CHAR)，都不支持，单独的 CHAR(200)是支持的,from sqlalchemy import  NUMBER不存在。,from sqlalchemy import RAW不存在。,跟开发确认，LOB类型都没支持，包括CLOB BLOB,![](https://pingcode.yasdb.com/atlas/files/public/67396965a1ad9a3311dc7650/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcxMTUsImV4cCI6MTc4MjEzNzkxNX0.9k1K_z64Imo0U0hJEKtDbiOiOW-L7Lg1m5QbqLEtZkw),  
|
|4|sqlalchemy.testing.requirements属性|1）standalone_null_binds_whereclause 属性不支持：,where语法中绑定参数null类型推导问题，服务端filter报错无法比较：sqlalchemy.exc.DatabaseError: (yaspy.DatabaseError) [3:51]YAS-04311 cannot be compared    
  [SQL: SELECT       [date_table.id](http://date_table.id/)      
  FROM date_table    
  WHERE CASE WHEN (:foo IS NOT NULL) THEN :foo ELSE date_table.date_data END = date_table.date_data]    
  [parameters: [None, None]],2）implicit_decimal_binds 属性不支持：,python驱动未支持Number类型到 deciaml.Decimal类型映射，实际返回的是string值；,3） floats_to_four_decimals 属性不支持，即：sqlalchemy.sql.sqltypes.Float类型的asdecimal 属性不支持；,4）empty_strings_text 属性未支持，空串处理为PyNone，不支持返回空字符串；    
,5）empty_inserts_executemany 属性不支持；|python驱动处理deciaml.Decimal 绑定值有问题|  
|
|5|sqlalchemy.sql.sqltypes.String 不支持不带长度|sqltypes.String 不指定长度时，报错；（Oracle表现相同）;,String(n)     映射到sql为 varcahr2（n char），单机OK，但是分布式还未支持n char 语法；|  
|  
|
|6|主键默认值|示例：,students = Table(    
  'test_students', meta,    
  Column('id', Integer,     **Sequence('stu_sql')**  , primary_key=True),    
  Column('name', String(20)),    
  Column('lastname', String(20)),    
  extend_existing=True,    
  ),meta.create_all(engine),conn = engine.connect(),conn.execute(students.insert(), dict(name = 'Ravi6', lastname = 'Kapoor6')),上述示例最后的insert未指定主键值；yashan需要 attach sequence到主键列（Oracle也是），执行效果是用sequence id 作为主键值；,这里对于客户迁移数据库，需要改写应用。|  
|orm上有用例，单独也写过，不支持序列|
|7|元数据接口|支持：,get_schema_names，,get_temp_table_names,,get_view_names,,get_sequence_names,,get_columns,,get_table_comment,,get_indexes,,get_pk_constraint,,get_foreign_keys,,get_unique_constraints,,get_view_definition,,get_check_constraints,其他都不支持：    
  get_table_names,,get_table_options,|  
|get_temp_table_names即可，这块需要借助驱动接口先创建tac的全局临时表、私有临时表，然后接口去查，其他暂时复用接口，参考test_temp_table_names_no_system.py,get_sequence_names：接口可能本身没用，分布式创建不了,get_foreign_keys：lsc创建外键受限，继续看服务端表现|


  


(1)create_engine的资料：    [https://zhuanlan.zhihu.com/p/616126182](https://zhuanlan.zhihu.com/p/616126182)    ，里面的port是可选项目，同时driver要小写，大写不识别

  [https://www.cnblogs.com/root-123/p/16571006.html](https://www.cnblogs.com/root-123/p/16571006.html)      支持指定echo=True功能是打印sql语句信息，连接方式还可以是tns,  engine = create_engine('oracle+cx_oracle://scott:tiger@tnsname'),

sessionmaker(bind=engine)?

  [https://docs.sqlalchemy.org/en/20/core/metadata.html#sqlalchemy.schema.MetaData](https://docs.sqlalchemy.org/en/20/core/metadata.html#sqlalchemy.schema.MetaData)      含orm的库的类都提供了哪些方法，2.0版本。    [https://www.bookstack.cn/read/sqlalchemy-1.3/6abb4ffe2d25e67d.md](https://www.bookstack.cn/read/sqlalchemy-1.3/6abb4ffe2d25e67d.md)       1.3版本

# 2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1 函数功能

      我们主要实现的是dialect的方言包部分，其他都是默认Orm的行为，所以主要测试dialect方言提供的对外接口，其他的orm的接口，简单覆盖测试。

方言包的测试，自己新增用例+复用库上oracle的第三方下的用例。orm的其他功能，复用orm库上的部分用例。

# 3.   **测试设计方法**

等价类，边界值，场景分析。

接口函数的测试点：

|测试分类|测试点|
|---|---|
|功能测试|1、接口的功能实现正常,2、接口的返回值测试,3、功能强相关的测试点|
|逻辑业务|有依赖关系的接口B依赖A，A不先调用，直接调用B会报错或者依赖的A接口调用后关闭了，再调用B报错|
|异常测试|参数异常：参数为空、参数多或者少、参数名错误|
||数据异常：数据为空、值不是接口要求的值、值的类型跟要求的不符合、参数的格式不符合要求|
|性能|用例并发执行是否支持，同时测试大并发下的反应时间|
|安全|create_engine里面涉及的账号密码是否是明文记日志|
|平台|linux 、windows（转测不提供windows）|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

   主要当时参考的oracle适配做法的新增用例，目前做法不是参考oracle，采用的是库上的用例。

[sqlachemy.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjQ4OTcwYzJhZjRmNTFmN2QxIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.Bvl-h2vPmwaocVYMYwDS13naKgpA39u2VfvTUNPFuSk)

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR/testkill|是|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


# 5.   **测试用例**

[sqlachemy文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjQ4IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9._v72Es1hR8GQuT43_-58bt7vetrPmhdqskznQQ9WfIc)

|oracle第三方包下的4个py文件（优先级高）|
|---|
|sqlalchemy-rel_1_4\test\sql下的37个py文件|
|examples下的用例，随机挑选5个左右|
|新增的用例（10）,当时针对标准参考Oracle,无法复用|


对于AC 、dumplicated表，驱动测可以去创建，但是后面Orm的查询等接口无法使用，还需要定义个同名table，字段类型等跟驱动创建的保持一致。

复用库上的执行方式，把lib下的oracle的更名，然后lib下创建yashandb，把安装orm产生的第三方文件拷贝过去，同时用例库上带上from yashandb_sqlalchemy import base as yashandb，后面注册的方式执行。

pytest -v --requirements yashandb_sqlalchemy.requirements:Requirements --db yashandb test/dialect/yashandb_oracle/test_compiler.py --log-info=sqlalchemy.engine

补充：长时间循环跑用例，查看是否有内存泄漏等。

          单个连接，不停跑，cusor连接，conn连接

          数据量大，借助Orm接口执行查询等

分析失败记录：

[oram记录.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjU4OTcwYzJhZjRmNTFmN2QyIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.mRNJYqGY9H71a_d6o1lzqZ2ni5-0c0vRPMR9gv2RPCc)

未上库，手工用例：单个连接，不停跑（test_sdv_YDBRD_23317_12.py），cusor连接test_sdv_YDBRD_23317_bf_cusor_2.py，conn连接：test_sdv_YDBRD_23317_bf_conn_2.py，    
  数据量大，借助Orm接口执行查询等（test_sdv_YDBRD_23317_table.py）。

[test_sdv_YDBRD_23317_12.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjQ5IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.NXCLFYzhOsV_8J7hSuJNAHYiV7tBnb-kEnO98-xcT3s)

[test_sdv_YDBRD_23317_bf_conn_2.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjU4OTcwYzJhZjRmNTFmN2Q0IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.446EV1CABDMz6tB6zb9dA7z7hv3oboM2ksYwvg1NNhs)

[test_sdv_YDBRD_23317_bf_cusor_2.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjRiIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.0BXCAE72PWy_cie1JiDxcX35P8EoWCIqSBoz3mUGp_I)

[test_sdv_YDBRD_23317_table.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjRjIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.8u3DJoiqmCxD5Zc41MON0NmIUiPjPOlpY5H7bBS02Uc)

备注：最终版本的去掉了service_name,脚本可能未全部更新。

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# 8  **. 差异点记录**

|序号|描述|  
|
|:---|:---|:---|


## Attachments:

[sqlachemy.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjRlIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.g3HBFUxzxTHx2VwUbhzdW32y2ljlhgwnNyVLTn2PdBw)

 (application/x-xmind)    


[sqlachemy.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjU4OTcwYzJhZjRmNTFmN2Q4IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.GxBCDcdy1qUDfzneFD_q9D70qOzOgHtsqdop9_Rs6JQ)

 (application/x-xmind)    


[sqlachemy.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjQ4OTcwYzJhZjRmNTFmN2QxIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.Bvl-h2vPmwaocVYMYwDS13naKgpA39u2VfvTUNPFuSk)

 (application/x-xmind)    


[sqlachemy文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjU4OTcwYzJhZjRmNTFmN2RhIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.Ep2huwrtcCfy2qox_PuDvwcwTjBaKdKHYr2CI8hsr_I)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[sqlachemy文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjQ4IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9._v72Es1hR8GQuT43_-58bt7vetrPmhdqskznQQ9WfIc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[oram记录.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjU4OTcwYzJhZjRmNTFmN2QyIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.mRNJYqGY9H71a_d6o1lzqZ2ni5-0c0vRPMR9gv2RPCc)

 (application/vnd.ms-excel)    


[test_sdv_YDBRD_23317_12.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjQ5IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.NXCLFYzhOsV_8J7hSuJNAHYiV7tBnb-kEnO98-xcT3s)

 (text/plain)    


[test_sdv_YDBRD_23317_bf_conn_2.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjU4OTcwYzJhZjRmNTFmN2Q0IiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.446EV1CABDMz6tB6zb9dA7z7hv3oboM2ksYwvg1NNhs)

 (text/plain)    


[test_sdv_YDBRD_23317_bf_cusor_2.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjRiIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.0BXCAE72PWy_cie1JiDxcX35P8EoWCIqSBoz3mUGp_I)

 (text/plain)    


[test_sdv_YDBRD_23317_table.py](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjRjIiwicmVmX2lkIjoiNjczOTY5NjQ1OTNmOTljOWZmMjM0ZTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTE1LCJleHAiOjE3ODIyMTM1MTV9.8u3DJoiqmCxD5Zc41MON0NmIUiPjPOlpY5H7bBS02Uc)

 (text/plain)    


## Comments:

|  [](null)  ,补充：长时间循环跑用例，查看是否有内存泄漏等。,          单个连接，不停跑，cusor连接（驱动，statemnet)，conn连接(orm),Posted by limeie at 十二月 27, 2023 11:01|
|---|
