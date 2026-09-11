# 1. 概述

支持processlist，通过information_schema.processlist实现

# 2. 需求分析

## 2.1 功能点分析

- 之前的需求已经实现了processlist的部分功能，本需求补充实现processlist的DB、COMMAND、TIME、STATE字段。
- 各个字段解释如下：


|字段名|含义|
|:---|:---|
|ID|唯一连接标识。|
|USER|当前线程连接数据库的用户，提交该语句的mysql用户。|
|HOST|提交语句的客户端的 host|
|DB|当前线程在哪个数据库执行|
|COMMAND|线程根据客户端行为正在执行的命令的类型。查询Query，休眠Sleep，后台常驻Daemon，连接Connect等。|
|TIME|线程处于当前状态的时间，以秒计。|
|STATE|显示使用当前连接的sql语句的状态|
|INFO|线程正在执行的语句，如果没有执行则为 NULL 。|


![image.png](https://pingcode.yasdb.com/atlas/files/public/673ae0be8970c2af4f53b4ed/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs)

![image.png](https://pingcode.yasdb.com/atlas/files/public/673ae0c68970c2af4f53b4ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs)

## 2.2 应用场景

- 支持并兼容MYSQL的PROCESSLIST视图


## 2.3 规格约束

- command的规格：


MySQL的command值不能为null，所以在yashan模式的缺省值就是EXECUTE

- state的规格：


MySQL的state值可以为null，故只对矩阵中有的等待事件做映射，剩余情况直接为null

  [(552) 【mysql兼容】支持PROCESSLIST系统视图设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/MASHIJIE/pages/6739c00e728206efb930d97e)  

# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用边界值、等价类和场景分析等测试设计工程方法

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|条件1|条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|公共部分||  [test_sdv_YDBRD34281_PROCESSLIST_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZDhlMTVhMWFkOWEzMzExZGUzNDg1IiwicmVmX2lkIjoiNjczOWJkZDY3MjgyMDZlZmI5MzBiNzZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMDgyLCJleHAiOjE3ODI1NDY0ODJ9.gBBz-KPlUsmK6JBo8lPSWIl91910KTCSHrw9LRRJ5E8)  ||||
|语句语法|  
,语法|SHOW FULL PROCESSLIST；   ,等同于 ,SELECT     *     FROM   INFORMATION_SCHEMA.PROCESSLIST;,desc   information_schema.processlist;|1、执行结果正确,2、语句不报错,4、select带过滤条件,like 'pattern'中使用%和_,where expr：覆盖常用表达式类型|1、错误语法：关键字缺失/错误,2、非mysql模式下执行|执行报错，报错信息明确|
|会话列表信息|SHOW PROCESSLIST|不使用FULL关键字， SHOW PROCESSLIST则仅显示字段中每个语句的前 100 条||||
||SHOW FULL PROCESSLIST|显示所有会话信息|100个会话？|||
|字段/  ID|id字段使用v$session.sid|SID在当前session的话是唯一的,exit后再次conn，是否会改变？,conn到其他用户，是否会改变？  
newsess{},根据id结束会话||||
|USER|user字段使用v$session上的CLI_OSUSER，即客户端用户名|1、sys用户(DBA用户),2、普通用户，grant权限,3、对于无权限要求的，新建用户有创建session权限，无其他权限||||
|HOST|host字段使用v$session上的CLI_HOSTNAME，即客户端服务器名,以上作废，更改为：,host字段使用v$session上的IP_ADDRESS和IP_PORT合并成ip:port的形式。,在v$session上新增ip_port，标识当前session对应的port,对于localhost连接，host只显示localhost，不显示端口,|ip登录yasql regress/regress@192.168.7.120,主机名登录yasql regress/regress@AchorBase:1688,![image.png](https://pingcode.yasdb.com/atlas/files/public/673af00b8970c2af4f53b505/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs)|那就不能上ci看护，每天跑Ci的机器不一样|||
|DB|db字段使用v$session上的USERNAME，即当前的schema用户名，,对应MySQL兼容模式下的db名称,,,,|alter session SET CURRENT_SCHEMA =sys;,or,use sys;,不同database下,多个会话查询结果,![image.png](https://pingcode.yasdb.com/atlas/files/public/673af0438970c2af4f53b506/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs),![image.png](https://pingcode.yasdb.com/atlas/files/public/673af0be8970c2af4f53b507/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs),![image.png](https://pingcode.yasdb.com/atlas/files/public/673af0f88970c2af4f53b50b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs)|alter session set COMPAT_VECTOR=MYSQL;下建database|||
|COMMAND|线程根据客户端行为正在执行的命令的类型。查询Query，休眠Sleep，后台常驻Daemon，连接Connect等。,,一个存储过程循环执行，另一个会话进行查询收集,,|command的规格：,MySQL的command值不能为null，所以在yashan模式的command缺省值（默认值）是EXECUTE,mysql支持的：,```
线程可以具有以下任意 Command值：

Binlog Dump

这是复制源上用于将二进制日志内容发送到副本的线程。

Change user

该线程正在执行更改用户操作。

Close stmt

该线程正在关闭一个准备好的语句。

Connect

副本已连接到其源。

Connect Out

副本正在连接到其源。

Create DB

该线程正在执行创建数据库操作。

Daemon

该线程是服务器内部的，而不是服务客户端连接的线程。

Debug

该线程正在生成调试信息。

Delayed insert

该线程是一个延迟插入处理程序。

Drop DB

该线程正在执行删除数据库操作。

Error

Execute

该线程正在执行一个准备好的语句。

Fetch

该线程正在获取执行准备好的语句的结果。

Field List

该线程正在检索表列的信息。

Init DB

该线程正在选择默认数据库。

Kill

该线程正在终止另一个线程。

Long Data

该线程正在检索执行准备好的语句的结果中的长数据。

Ping

该线程正在处理服务器 ping 请求。

Prepare

该线程正在准备一份准备好的语句。

Processlist

该线程正在生成有关服务器线程的信息。

Query

该线程正在执行一条语句。

Quit

线程正在终止。

Refresh

该线程正在刷新表，日志或缓存，或者重置状态变量或复制服务器信息。

Register Slave

该线程正在注册副本服务器。

Reset stmt

该线程正在重置准备好的语句。

Set option

该线程正在设置或重置客户端语句执行选项。

Shutdown

该线程正在关闭服务器。

Sleep

该线程正在等待客户端向其发送新的语句。

Statistics

该线程正在生成服务器状态信息。

Time

未使用
```,1、开多个session同时进行,**@subSess s2 { update tablex set f1=1; }; **    { }中的  ** update tablex set f1=1;**,执行时会处于等待不结束状态，因为它要等session s1执行commit后才能结束，所以要启动子线程执行它，主线程会往后执行,2、一个会话循环执行，一个会话show 收集|alter session set COMPAT_VECTOR=MYSQL；,的场景下，是会出现这些command,![673d7ff9a1ad9a3311de3478.png](https://pingcode.yasdb.com/atlas/files/public/673d8019a1ad9a3311de3479/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs),,MySQL客户端连接的情况下，command都会是query,相关场景一起跑，结果大|||
|TIME|表示线程处于当前状态的时间（以秒为单位）|1.活跃的线程：除sleep外的所有操作,time反应其等待事件的持续时间，v$session新增一个列获取session的当前等待事件（如果有的话）的持续时间,锁等待场景,2.不活跃的线程：被锁,新增一个接口来获取其休眠的时间，表现为 command为sleep，同时time不断增加||||
|STATE|显示使用当前连接的sql语句的状态,,|##### **freeing items**  状态：表示服务器正在释放内部缓存或临时结构中的资源；,1. 执行一个复杂的查询，如全表扫描或涉及大量数据的JOIN操作
1. 包含多个列的表，执行一个包含 ORDER BY 或 GROUP BY 子句的查询
1. 涉及临时表的子查询或复杂JOIN
1. 并发、不断创建不同的表，并往里面插入数据
1. 调小DATA_BUFFER_SIZE参数，大量读写
,~~**init**~~  ~~状态：初始化执行某个操作时(只会在分布式cn出现)~~,1. ~~输入增删改查等语句，不执行，看下init（手动，拼手速）~~
1. ~~START TRANSACTION~~
1. ~~？？？？？？？？~~
,**Sending to client **  状态：表示线程正在将结果集发送给客户端,1. 插入大量数据，查询一个很长时间才能返回结果的sql语句
1. 不同数据类型表，查询
1. ？用高级包进行等待exec DBMS_LOCK.SLEEP (2);
,##### **System lock**   状态：正在被其他的表读写的状态,1. 并发表dml+ddl，另一个会话show
,##### **Waiting for global read lock **  状态：当block正处于从磁盘读上来的过程，另外的会话也尝试访问该block会等待；访问block时，如果正处于淘汰过程，也会产生此等待事件；,1. 三个会话，一个插入，一个查询，一个show，三个会话同时疯狂循环，show去收集
,~~**Waiting for table level lock**~~  ~~状态：只在集群下出现~~,![image.png](https://pingcode.yasdb.com/atlas/files/public/673b118c8970c2af4f53b52e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs),~~1、锁定：LOCK TABLES test_table WRITE;~~,~~2、释放锁：UNLOCK TABLES;~~,,  [(552) 【mysql兼容】支持PROCESSLIST系统视图设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/MASHIJIE/pages/6739c00e728206efb930d97e)  ,对于没有映射的等待事件，将其转为null|mysql下Waiting for global read lock,![image.png](https://pingcode.yasdb.com/atlas/files/public/673c8629a1ad9a3311de3437/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs),,,gdb打断点|||
|INFO|采用v$sql.SQL_TEXT作为info的值，即线程正在执行的语句|##### SELECT （带 WHERE ）、INSERT、UPDATE、DELETE 、复杂查询（JOIN、子查询等）、plsql,如果没有执行则为 NULL ,一个session循环执行以上操作，一个session循环show   processlist |由于show processlist会被改写成select * from information_schema.processlist，所以查出来的时候会是这个样子的,![WXWorkLocal_17320910665201.png](https://pingcode.yasdb.com/atlas/files/public/673da23ca1ad9a3311de349b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFRQ0FBQUFBQUJBQUFCQUFBQUFBZ0FBZ0FBQUFBQWdBQUFBQUFJQUFBQUFBQUFRQ0FDQUFpQUFCQUFDSUFBaVFCNEFDQUFBQUFBSUFBQUFBQUFBSUlBQXdBRUFBQUFBQUFBQUFBUUFBQUFBQUFCQWdBQUFBQUFBQWdBQkFFQUFBQUVBQUFBQWdDQUFCQUlBQUFRQUNBQUlCQUFBQUFBQkNBa0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NjAwODIsImV4cCI6MTc4MjQ3MDg4Mn0.9C5Z_BlwzmH18yD1WYt81PRId15FlJgMmlHijxUWCOs)|||


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|是|mysql客户端连接yasdb并发执行功能点用例，获取字段结果|
|KT|否  
|  
|
|长稳|否  
|  
|
|一致性|否  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否  
|  
|
|DFR|否|  
|
|HA|否|  
|
|压力|否|  
|
|性能|否|  
|
|可维护性|否  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  