Created by 林永豪, last modified on 八月 24, 2023

#   [YDBRD-13327 : DB Link Metadata Design（DBLINK元数据管理设计）](#ydbrd-13327--db-link-metadata-designdblink元数据管理设计)  

SR链接：    [YDBRD-13327](https://jira.yasdb.com/browse/YDBRD-13327)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-overview%E6%A6%82%E8%BF%B0)  

归属IR: YDBRD-4986

部署形态支持：主备（单机）

暂不支持：分布式、集群

功能概要描述：

（1）支持DBLINK的CREATE/DROP/ALTER    
  （2）支持DBLINK在系统表LINK$落盘    
  （3）进行  用户/密码管理

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### （1）CREATE

![](https://conf.yasdb.com/download/attachments/109591779/image2023-5-12_16-49-58.png?version=1&modificationDate=1683881398000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

![](https://conf.yasdb.com/download/attachments/109591779/image2023-5-12_15-47-20.png?version=1&modificationDate=1683877641000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

![](https://conf.yasdb.com/download/attachments/109591779/image2023-5-11_17-56-29.png?version=1&modificationDate=1683798989000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

![](https://pingcode.yasdb.com/atlas/files/public/67396ae4a1ad9a3311dc7e45/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

![](https://pingcode.yasdb.com/atlas/files/public/67396ae4a1ad9a3311dc7e46/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

SHARED: 共享模式；约束：不支持创建；    
  PUBLIC: 公共的；创建后属于PUBLIC用户；不指定SHARED/PUBLIC时，为私有的；私有和公共的link name可以同名；    
  dblink_authentication：  AUTHENTICATED BY   user   IDENTIFIED BY   password，只做语法兼容；    
  connect_string: 网络链接属性，目前指定格式为：'ORACLE:IP:PORT/SERVICE_NAME'。

  


创建链接时，您确定哪个用户应连接到远程数据库以访问数据。

#### 用户类别

|用户类型|描述|示例链接创建语法|
|:---|:---|:---|
|连接用户（  Connected user link  ）|该link type下用户在远端和本地数据库都有相同的用户名和密码|  `CREATE PUBLIC DATABASE LINK hq USING 'hq';`  |
|当前用户（  Current user link  ）|常用于存储过程中，B用户在存储过程执行语境中以存储过程创建者用户B的权限去访问远端数据库|  `CREATE PUBLIC DATABASE LINK hq CONNECT TO CURRENT_USER using 'hq';`  |
|固定用户（  Fixed user link  ）|固定使用link创建时指定的用户名和密码 这样要确保在远端数据库上已经对link中的用户授权,用户名/密码是链接定义的一部分的用户。如果链接包含固定用户，则固定用户的用户名和密码用于连接到远程数据库。|  `CREATE PUBLIC DATABASE LINK hq CONNECT TO jane IDENTIFIED BY`      `password`      `USING 'hq';`  |


####  数据库链接的类型

Oracle 数据库允许您创建  私有  、  公共  和  全局  数据库链接。这些基本链接类型根据允许访问远程数据库的用户而有所不同：

|类型|所有者|描述|
|:---|:---|:---|
|PRIVATE|创建链接的用户。通过以下方式查看所有权数据：,-   `DBA_DB_LINKS`  
-   `ALL_DB_LINKS`  
-   `USER_DB_LINKS`  
|在本地数据库的特定模式中创建链接。只有私有数据库链接或模式中的 PL/SQL 子程序的所有者才能使用此链接访问相应远程数据库中的数据库对象。|
|PUBLIC|名为 PUBLIC 的用户。通过为私有数据库链接显示的视图查看所有权数据。|创建数据库范围的链接。数据库中的所有用户和PL/SQL子程序都可以使用该链接访问相应远程数据库中的数据库对象。|
|GLOBAL|不支持，23.1版本没有规划支持|  
|


#### SHARED 共享模式的LINK

本地服务器进程和远程数据库之间的链接是可以多个会话共享的，不支持，23.1版本没有规划支持。

#### （2）ALTER

![](https://conf.yasdb.com/download/attachments/109591779/image2023-5-19_11-15-3.png?version=1&modificationDate=1684466103822&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

目前只支持fixed user下user_name和password修改；

dblink_authentication可以指定，不会产生任何影响，只做语法兼容。

#### （3）DROP

![](https://conf.yasdb.com/download/attachments/109591779/image2023-5-11_18-2-45.png?version=1&modificationDate=1683799365000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ2dBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk4MDgsImV4cCI6MTc4MjMwMDYwOH0.GG2g0zqtQb2jWhjJA0XQUJnPu36uc_gxJSEsltz0sjw)

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

LINK$系统表

|字段|yashan实现情况|oracle实现情况|备注|
|---|---|---|---|
|OBJ#|√|×|YASHANDB对应LINK对象落盘产生的OBJECT ID|
|OWNER#|√|√|YASHANDB是bigint,ORACLE是number|
|NAME|√|√|链接名|
|CTIME|√|√|链接创建的时间|
|HOST|√|√|主机名|
|USERNAME|√|√|ORACLE为USERID，不对齐|
|PASSWORD|√|√|YASHANDB的类型是RAW(256)，ORACLE是VARCHAR2(128),ORACLE无内容，YASHANDB是加密字节流（不对齐）,  
|
|FLAG|√|√|link正常的情况下，oracle的值是2，yashan的值是0|
|AUTHUSER|√|√|YASHANDB只做了记录，未生效|
|AUTHPWD|√|√|YASHANDB只做了记录，未生效,yashan的类型是RAW(256)，oracle是VARCHAR2(128)（不对齐）|
|PASSWORDX|√|√|对齐扩展用，当前没有值|
|CREDNAME|√|√|对齐扩展用，当前没有值|
|CREDOWNER|√|√|对齐扩展用，当前没有值|
|ACREDNAME|√|√|对齐扩展用，当前没有值|
|ACREDOWNER|√|√|对齐扩展用，当前没有值|


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

|参数|1|场景|约束|备注|
|---|---|---|---|---|
|YDBC：一个模块，该模块负责yex_server调用oracle oci接口或yashan C驱动接口|  
|  
|  
|  
|
|MAX_DBLINK_CONNS|1|并发场景下，不同用户session访问同一个dblink，在同一个时间窗口使用的conn数量超过上限|1. 对此dblink同时使用的conn
1. 不能超过  MAX_DBLINK_CONNS  。否则报错too many connections for dblink。（当前使用一个sql语句申请一个conn，执行完后释放该conn）
1. MAX_DBLINK_CONNS默认值为64
1. MAX_DBLINK_CONNS可以在${YASDB_HOME}/external/server/yex_server.ini中进行配置，配置值小于64时内部会强制将值改成64，最大值是uint32最大值。
|并发场景，对同一个dblink， 同时使用超过MAX_DBLINK_CONNS|
|YDBC_BUFFER_SIZE|1|控制ydbc驱动内存池大小（基于64K页管理）,使用dblink功能时，ydbc驱动需要的空间|1.使用ydbc驱动空间不能超过YDBC_BUFFER_SIZE，否则报错no free block in driver memory pool,2.YDBC_BUFFER_SIZE默认值为32M,3.YDBC_BUFFER_SIZE可以在${YASDB_HOME}/external/server/yex_server.ini中进行配置，配置值小于32M时内部会强制将值改成32M，最大值是uint64最大值。|drv_base.c: doAll  ocMem,引用处：,[1]allocDriverMem;,[2]allocConnMem;,[3]allocStmtMem;,[4]allocColumnMemory/allocParamMemory,  
,allocDriverConn使用点：,(1)yex_server与远端数据库的每一个连接(YdbcConn)，其本身需要分配空间(Ys/OraConn)（远端是Yashan则占用33,065字节，远端是Oracle则占用33089字节）,  
,allocConnMem使用点：  【占用很大的情况：多个link、多个link上connPool中的conn很多，对外表现在并发频繁地使用某个dblink】,(1)yex_server与远端数据库的每一个连接(YdbcConn)，其空闲stmts句柄要先占用64字节,(2)yex_server与远端数据库的每一个连接(YdbcConn)，其stmts句柄要先占用72字节,  
,allocStmtMem的使用点：  【占用很大的情况：多个link、多个link上connPool中的conn很多、DML/DQL涉及的列很多、涉及的列很长、记录条数很多  ，对外表现在并发频繁地使用某个dblink，且DML/DQL场景中dblink表涉及的列很多、涉及的列很长、记录条数很多】,(1)prepare阶段完成后，记录每列元数据信息（Ys/OraCloumn）（远端是Yashan则每列占用40字节，远端是Oracle则每列占用132字节）,(2)使用绑定参数时，每列绑定参数元数据信息（Ys/OraParam）（远端是Yashan则每列占用36字节，远端是Oracle则每列占用52字节）,  
,allocColumnMemory/allocParamMemory的使用点：,每个字段都会分配出一段空间，用处是将从远程数据库fetch回来的结果进行缓存。分配空间的大小取决于该字段是定长还是变长。如果定长，则大小为列宽；如果变长，则长度为字符串长度加上\0的总长。,  
,  
,  
,  
,  
|
|DRV_MAX_COLUMN_SIZE|  
|远端表的最大列宽长度|写死64KB-1|远端表的最大列宽不能等于0，也不能大于64KB-1|
|DRV_MESSAGE_BUFFER_SIZE|  
|远端是oracle时，报错情况下返回的错误信息长度最大值|写死1024|  
|
|EXS:管理yex_server与远端数据库之间的交互|  
|  
|  
|  
|
|EXS_DBLINK_MAX_ITEMS|1,场景明确例子|DBLINK的hwm（高水位值），控制  当前正在使用状态的dblink的数量|写死1024|1.create database link的时候，实际上只是将用户创建的dblink信息写入系统表，并没有真的与远程数据库建立连接，也就是说yex_server上并没有生成exs object（只有生成exs object的时候，表明会基于exs object与远程数据库进行信息交互），所以  本地创建database link的数量没有上限  ，与建普通表的规格一致,  
,2.当发起insert/update/delete/select的时候，这个时候yasdb会进行和yex_server的交互，此时yasdb会把之前写入系统表的dblink信息发送到yex_server。,然后yex_server会检查exsObjMaganer的freeList上，有没有之前使用过的exs object空间。,有的话则从freeList上摘下来并赋值dblink信息。,没有则根据dblink信息生成一个exs object，此时hwm的值自增1。,exs object在yex_server的生命周期中会一直存在。当hwm的值超过1024则报错。|
|EXS_DBLINK_BUCKETS|  
|dblink exs object基于桶管理，每个桶上是exsobject的链表|写死1023|  
|
|EXS_MAX_XACT_BRANCHS|  
|  
,同一个用户session上事务总数上限|写死32|SQL> declare    
  2 sql_text varchar(200);    
  3 i int;    
  4 begin    
  5 for i in 1 .. 33 loop    
  6 sql_text := 'insert into dblink_remote_trans_16335@link_YDBRD13327_13332_11_' || lpad(i, 4, 0) || ' values (' || i || ', ' || i * 3 || ')';    
  7 execute immediate sql_text;    
  8 end loop;    
  9 end;    
  10 /,YAS-07318 failed to call external moudle    
  YAS-07326 transaction branches in same session can not exceed 32,SQL> commit;,Succeed.,SQL>     
  SQL> select count(*) from dblink_remote_trans_16335@link_YDBRD13327_13332_11_0002;,COUNT(*)     
  ---------------------     
  32,1 row fetched.|
|EXS_MAX_XACTS|  
|dblink同时处理事务的最大个数|写死1024|超过则报错too many active dblink transactions|
|EXS_DBLINK_ROWARRAY_SIZE|  
|dblink从远端获取结果集，每次fetch的最大行数|不会超过1024|  
|
|YEX:管理yasdb和yex_server之间的交互|  
|  
|  
|  
|
|DBLINK_DEFAULT_CURSORS|  
|在同一个时间窗口中，结果集缓存池上，正在使用结果集缓存的最大数量|写死32|超过时，报错too many dblink resultsets|
|DBLINK_DEFAULT_DATASET_SIZE|1 可配形式？,16M合理性?|dblink每个结果集缓存大小|写死512KB|  
|
|YEX_MIN_CONNS|  
|yasdb和yex_server会预先提供16个初始的空闲连接|写死16|yasdb和yex_server的连接管理器中管理16个连接和8个连接池，16个连接均分到8个连接池中|
|YEX_CONN_POOLS|  
|控制yasdb和yex_server连接，每个管理器中连接池数组的大小|写死8个|同上，即每个连接管理器有8个连接池，每个连接池通过链表管理连接|
|YEX_PACKET_SIZE|  
|控制yasdb和yex_server连接中，协议包的大小|写死1MB|  
|
|YEX_DEFAULT_THREAD_STACK_SIZE|  
|yex_server线程栈|写死1024KB|  
|
|YEX_SERVER进程管理：|  
|  
|  
|  
|
|YEX_DAEMON_INTERVAL 0.1秒,YEX_HEARTBEATING_TIMEOUT 10秒|  
|  
|  
|yex_server进程管理：,1.yasdb startup的时候拉起yex_server，首先执行拉起yex_server的命令,2.线程正常运行（未关闭时），等待0.1秒，等待yex_server进程启动,3.  yasdb去检测yex_server进程心跳  ，如果yex_server正常活着，则重置等待时间，重复【等待0.1s后检测yex_server进程心跳】流程；,4.如果yex_server没活着，则累加等待时间。如果等待时间小于10s，则重复【等待0.1s后检测yex_server进程心跳】流程；,5.如果超过了10s等待时间，则再尝试执行拉起yex_server的命令，拉起成功则重置等待时间，重复【等待0.1s后检测yex_server进程心跳】流程；,6.拉起失败则将拉起失败的信息打印到${YASDB_HOME}/log/external/server/yex_server.log日志中|
|yasdb执行dblink语句时(增删改查），与yex_server建立的连接流程：|  
|  
|  
|  
|
|YEX_POLLING_INVTEVAL 0.01秒,DBLINK_TIMEOUT 10秒|  
|  
|  
|1.根据dblink cursor上的session id去尝试获取连接，如果获取不到现有连接，则由yasdb和yex_server连接管理器分配出一个连接,2.分配连接的流程：,遍历连接管理器上8个连接池（完整遍历一次花费0.08秒），过程中如果有空闲连接则使用该空闲连接并退出；,完整遍历一次后如果没找到空闲连接，会判断总等待时间是否超过10s，没超过10s的话则等待0.01s后再进入下一次【遍历连接管理器上8个连接池】,总等待时间超过10s则报错external module timeout, reason: no idle connections|


（1）因为架构上DBLINK需要通过yex_server进行连接，所以在YASDB_DATA下要预留好空间。这点对数据库部署有影响，涉及OM；

（2）yasdb启动后，默认会拉起yex_server，当yex_server与yasdb的心跳失败超过3次，会主动干掉yex_server；

**（3）yashan连yashan时，目前支持的是只用输入IP:PORT**

**（4）目前只支持 yashan连yashan，yashan连oracle 两种连接形式**

**（5）SHARED/CURRENT_USER暂做拦截**

**（6）database_type：语法上可以选择Oracle、mysql、odbc，功能上不支持mysql、odbc。不选择database_type则使用yashan。**

**（7）创建db link的时候，用户名/密码/connect string不校验的，只要符合语法规则就可以创建成功，但后续使用时连接不上会报错。**

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

从IR层级架构方案设计的说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

  


**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

无，未使用第三方组件

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#51-architecture%E6%9E%B6%E6%9E%84)  

说明方案的总体架构，IR拆解SR的阶段，需要优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

通过架构图的划分，可以较为清晰的展现SR拆解的逻辑和完全性。

###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#52-dfx%E8%AE%BE%E8%AE%A1)  

1. 与远端数据库连接链路的安全原则；
1. DBA_DB_LINKS视图。
1. YEX(DB)与EXT_SERVER、EXT_SERVER与远端数据库，这个链路上发生异常，如DB coredump、EXT_SERVER coredump、远端数据库断链等异常情况下的考虑；事务提交超时的异常。


###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#53-%E5%85%B6%E4%BB%96)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

（1）create/alter/drop语法测试

（2）create/alter/drop并发

  


已用regress/unittest自测，自测通过testkill

## Attachments:

[dblink.ebnf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTRhMWFkOWEzMzExZGM3ZTQzIiwicmVmX2lkIjoiNjczOTZhZTM1OTNmOTljOWZmMjM1YjAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5ODA4LCJleHAiOjE3ODIzNzYyMDh9.nPhh1nkU2urU0FBLZJylRjPeRAOdblD_z-MG3sczvrw)

 (application/octet-stream)    


[dblink.ebnf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTQ4OTcwYzJhZjRmNTFmZmNkIiwicmVmX2lkIjoiNjczOTZhZTM1OTNmOTljOWZmMjM1YjAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5ODA4LCJleHAiOjE3ODIzNzYyMDh9.Atxm5_LmI8Vtt7LnuD7NNVY7w8891Oey3rVwdXFU9W8)

 (application/octet-stream)    
