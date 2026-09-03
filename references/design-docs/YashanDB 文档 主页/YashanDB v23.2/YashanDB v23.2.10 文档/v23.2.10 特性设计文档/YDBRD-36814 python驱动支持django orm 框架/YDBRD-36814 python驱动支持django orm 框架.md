IR链接：  [https://pingcode.yasdb.com/ship/ideas/67629aafc3c68d84e9d6bc10?](https://pingcode.yasdb.com/ship/ideas/67629aafc3c68d84e9d6bc10?)  

#YASHAN-3547  python驱动支持django orm 框架

SR链接：  [https://pingcode.yasdb.com/pjm/items/6766364b64bf51159818a92d?](https://pingcode.yasdb.com/pjm/items/6766364b64bf51159818a92d?)  

#YDBRD-36814 python驱动支持django orm 框架



##   [1. 总述](https://pingcode.yasdb.com/#1-总述)  

###   [1.1 需求来源](https://pingcode.yasdb.com/#11-需求来源)  

深智城-国家保密项目中使用了开源工具Label Studio（1.13.0），该工具通过Django ORM框架与数据库进行交互。目前YashanDB暂未适配Django ORM框架，本文档旨在设计方言包通过Python驱动对接Django ORM框架。

###   [1.2 特性调研](https://pingcode.yasdb.com/#12-特性调研)  

|产品名称|是否支持Django ORM|是否支持label studio|备注|
|---|---|---|---|
|MySQL|是|是||
|Oracle|是|否|与YashanDB语法兼容度高，大部分接口参考Oracle的实现来适配|
|PostgreSQL|是|是||
|SQLite|是|是||


- 上一小节的四个数据库产品都是Django官方提供支持，兼容性和性能较好，直接在框架中提供语法补丁提高兼容性。
- YashanDB与Oracle的语法兼容度高，在官方Oracle方言包的基础上修改以保证功能的完善度和适配效率。
- YashanDB相较上面四种数据库缺少一些功能特性，比如inline 自增列声明、约束延迟检查等
- Label studio官方目前不支持YashanDB，所以在框架中使用Django ORM生成的语法在YashanDB会报错，需要修改label studio框架源码适配YashanDB


###   [1.3 需求分析](https://pingcode.yasdb.com/#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|开发支持Django ORM框架的yasdb方言包|见下文|是|是|
|周边配合|Python驱动增加django-yasdb方言包所需接口|见下文|是|是|


###   [1.4 开源依赖](https://pingcode.yasdb.com/#14-开源依赖)  

- Django 3.2.25


##   [2. 接口](https://pingcode.yasdb.com/#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|函数|def bind_named_parameter(self)|Python驱动YasParameter类通过名称进行参数绑定|是|
|成员属性|statement|Python驱动Cursor类实例用于记录上一次执行的SQL语句|是|
|函数|def Binary(value)|Python驱动用于兼容Django ORM框架调用的接口|是|
|函数|def to_yac_ds_interval(td: datetime.timedelta)|Python驱动转换timedelta到yac_ds_interval的接口，修正了对包含负数timedelta的处理|是|
|函数|def alloc_yac_binary(value)|Python驱动用于Binary类型set_value使用，原先的string_buffer方案不能正确处理包含\x00字节的数据||
|依赖库|django_yashandb|用于Django框架中配置连接数据库的engine库，django调用yashandb的方言包|是|


##   [3. 规格与约束](https://pingcode.yasdb.com/#3-规格与约束)  

|类型|描述|技术原理|
|---|---|---|
|约束|不要手动给auto列插入一个跨度很大的值|自增列的sequence每次手动插入一个新自增列值后会循环更新sequence的nextval，如果插入一个跨度很大的值会导致耗费很长时间来更新sequence|
|约束|不支持日期时间字段的时区转换|内核暂不支持|
|约束|不支持约束的延迟检查|内核暂不支持|
|约束|不支持在事务中停用约束|目前可通过alter table来停用约束，但是DDL执行会破坏Django原子事务块导致提前提交|
|约束|不支持分布式部署|最基本的AutoField类型需要Sequence来生成自增列，分布式暂不支持|
|约束|Duration类型不支持聚合函数|内核暂不支持|
|约束|包含绑定参数的投影列返回数据类型不正确|内核对带绑定参数的列默认返回varchar，需要协议支持修改返回数据类型|
|约束|不支持在groupby中使用子查询|内核暂不支持|
|约束|JSON和LOB类型的列不支持比较、聚合、Group by、order by|内核暂不支持|
|约束|不支持对已经索引的列重复创建索引|内核暂不支持|
|约束|MD5函数对空字符串的输出与其他数据库以及标准MD5算法输出不匹配|内核对空字符串进行MD5操作后返回空字符串|
|约束|CASE WHEN ELSE表达式的结果数据类型必须一致，不支持自动转换|内核限制|


##   [4. 特性](https://pingcode.yasdb.com/#4-特性)  

![image.png](https://pingcode.yasdb.com/atlas/files/public/67877740a1ad9a3311de6b3e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUzOTYsImV4cCI6MTc4MjM1NjE5Nn0.G0Q2bwXOARYVyTX8vOmsdGVOmnBEBnp_OLm3_LD7ZNw)

- Label Studio：客户平台工具
- Django：客户工具使用的Python框架
- django_yashandb：YashanDB支持Django ORM的方言包
- python-yasdb：YashanDB的Python驱动


###   [4.1 YashanDB Python驱动](https://pingcode.yasdb.com/#41-python驱动)  

Python驱动目前执行SQL通过直接发送原始SQL语句到数据库执行，调用接口执行绑定参数。SQL语法的兼容工作主要放在方言包部分，驱动需要增加的特性：

1. 支持通过名称绑定执行参数
    1. YasParameter类添加_name属性用于记录绑定参数名称；
    1. YasParameter类增加接口完成通过名称绑定参数的功能；
    1. Cursor类中修改bind_parameter接口，当传入参数为dict类型时按照名称的方式来绑定参数
1. 支持处理Python包含负数的timedelta数据处理
    1. python中负数timedelta存储的方式为所有字段（days、seconds、microseconds）加和的值，比如-2s实际为timedelta(days=-1, seconds=86398)=-86400+96398=-2s。目前的python驱动处理方式对于-2s会直接变成- 1day 23:59:58
1. 支持记录上一次执行的SQL语句
    1. Cursor类添加字段statement，用于每次执行SQL时记录当前SQL语句
1. 增加Binary函数兼容Django内部接口调用
    1. 添加一个bypass的Binary函数兼容Django调用，因为python驱动对于binary类型能够正确转换无需手动调用Binary函数转换
1. Binary类型转为C指针时修改为c_uint8存储，之前的string_buffer在binary数据中包含\x00的字节时会出现异常截断，比如b'\x00\x46\xfe'会被转为b''。导致传递给数据库时参数错误。


###   [4.2 Django-yasdb方言包](https://pingcode.yasdb.com/#42-方言包)  

Django方法提供了一套base类和接口，包含了base.py、client.py、creation.py、features.py、introspection.py、operations.py、scheme.py、validation.py，作用分别为：

- base.py：数据库连接相关的操作接口
- client.py：数据库客户端相关接口
- creation.py：数据库创建相关接口
- features.py：数据库特性开关定义接口
- introspection.py：数据库内部元数据相关接口
- operations.py：数据库行数据操作相关接口
- scheme.py：数据库模式操作相关接口
- validation.py：数据库验证相关接口


在Django官方支持的数据库后端中YashanDB与Oracle的语法最为相似，二者不同之处：

|技术点|YashanDB|Oracle|修改方案|
|---|---|---|---|
|自增列|创建sequence后将列的默认值设置为seq.nextval|定义列为identity|在每个表创建之前先定义名称为{table_name}_seq的sequence，然后为表中auto字段设置默认值为{table_name}_seq.nextval。Django允许一个表至多有一个auto列，所以每个表一个seq足够|
|约束检查|执行SQL校验外键是否有效，外键引用的主键值在父表是否存在|通过SET CONSTRAINTS ALL IMMEDIAT/SET CONSTRAINTS ALL DEFERRED触发约束检查|check_constraints函数中模拟检验过程|
|时区|不支持|通过时区相关函数转换|不支持时区转换语法|
|约束延迟检查|不支持|设置约束为DEFERRED|可以通过disable/enable validate/novalidate开启关闭约束的校验，但是因为是DDL语句会提交事务破坏django内部的原子事务，所以不支持事务内部的约束关闭开始。但是sql_flush中支持关闭约束来清理表数据|
|truncate有外键约束的父表|报错|支持|使用delete语句指定on delete cascade来避免先删主表时的报错|
|自增列手动插入一个值后，seq的值自动更新|不支持，sequence和自增列手动插入的值不相干|支持自动更新，后续不会有重复值|每次插入数据后，如果涉及手动设置auto列的值，调用sequence reset sql更新sequence的下一个值大于当前自增列的最大值|
|LOB/JSON字段进行比较、聚合等操作|对于小于32000的转字符串处理，大于的报错|非JSONField转字符串后进行|非JSON字段且小于32000转字符串后操作，否则报错|
|列collate|不支持|支持|不支持|


语法方面django_yashandb自定义了查询和插入的SQLCompiler来生成兼容YashanDB的语法：

- oracle不兼容的函数名在compile时修改名称。
- CASE表达式的结果类型全部转为varchar，保证类型一致。
- Coalesce函数中的表达式类型转换为相同类型。
- Order by子句中子查询使用select中列的别名，避免SQL解析报错。
- 查询带distinct时，将lob类型列转为字符类型。
- JSON字段实际采用CLOB类型存储，因为原生JSON字段不支持诸如GROUP_CONCAT这些函数。


###   [4.3 Label Studio框架语法修改](https://pingcode.yasdb.com/#43-labelstudio)  

label studio中对于SQL语法的分支只包含了SQLite和Postgresql的区分，YashanDB存在两者语法都不兼容的情况，需要在label studio框架源码中增加兼容YashanDB的接口调用分支：

1. 对于distinct时包含LOB类型列时，在方言包侧转换为字符类型。前提是确认过label studio中distinct的lob列不会超过32000字节。
1. 对于annotate调用生成group by子句中包含LOB列的场景，通过子查询的方式避免对LOB进行Group BY操作。
1. 配置文件中添加YashanDB相关设置，支持通过环境变量切换为YashanDB持久化存储。
1. 对avg聚合函数返回None的场景在框架源码中适配，避免程序走向错误分支。


功能限制：

- JSON列annotations_result/predictions_result不能作为排序键和过滤键，具体体现为label studio工程页面上选用这两个键进行排序和过滤时会报错。
    - 原理：目前方言包通过CLOB存储JSON字段以支持更多的操作，但是CLOB不能进行比较、lookup相关操作，且这两个字段是存在超过32000字节长度的场景，所以转字符串也会报错。CLOB虽然能通过DBMS_LOB.compare进行比较但是也仅仅能使用equal、not equal，对于contains无法支持。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**label studio官方测试用例（除对JSON/LOB列进行不支持操作的用例外，540个用例）- 全部通过**

**Django 3.2.25官方测试用例（除规格约束之外的用例，13236个用例）- 全部通过**

##   [6.资料设计章节](#6资料设计章节)  

增加”  **doc/产品文档/开发手册/生态兼容性说明/ORM工具对接示例（Django）.md**  “

##   [7.未来规划](#7未来规划)  

当前适配的方言包只保证了label studio使用到的django orm框架功能，后续在YashanDB功能允许的情况下完善对django orm框架的适配程度。

