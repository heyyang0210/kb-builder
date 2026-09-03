Created by 孟麟, last modified on 六月 27, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6618f1acfd997db58ad84d31](https://pingcode.yasdb.com/pjm/items/6618f1acfd997db58ad84d31)    ?    
  #YDBRD-26200 支持管理MySQL兼容会话

描述

需求描述： 支持管理和查看MySQL连接会话    
  需求范围：    
  1 V$SESSION视图可查询MySQL连接会话    
  2 Kill Session命令支持Kill MySQL连接会话    
  3 V$SQL等视图可查询MySQL连接会话产生的SQL活动

## 1.1相关文档

开发文档：    [YDBRD-26200 支持管理MySQL兼容会话](156117952.html)  

测试调研：    [YASHAN-936_测试调研](/pages/createpage.action?spaceKey=YAS&title=YASHAN-936_%E6%B5%8B%E8%AF%95%E8%B0%83%E7%A0%94)  

# 2. 需求分析

## 2.1 功能点分析

1、会话管理模式

- yasdb支持独占和共享会话模式，独占模式：每个会话连接独占一个工作线程，每次新建连接，均新建1个线程来处理该会话，会话结束后，线程退出；共享模式：系统以线程池的方式管理工作线程，  每次新建连接，会从线程池里分出一个空闲线程来处理该会话连接，会话完成后，该线程将回到线程池中，等待新的客户端会话连接。
- 默认独占模式，配置参数MAX_REACTOR_CHANNELS为非0值时，系统为共享线程会话模式
- 相关参数：  1）    [MAX_SESSIONS](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0.html#max-sessions)    ，默认1024，范围  [64 + MAX_PARALLEL_WORKERS,16384]，2）  **MAX_PARALLEL_WORKERS**  ，默认32，范围[1,MIN(MAX_SESSIONS - 64,4096)]，3）  **MAX_WORKERS**  ，默认0，范围0 和 [8,16368]，当线程池启用后，该参数表示线程池中最大的线程数，当MAX_WORKERS设置为0时，实际取MAX_WORKERS值为CPU数 * 2，当MAX_WORKERS >=    [MAX_SESSIONS](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0.html#MAX_SESSIONS)    时，线程池关闭
- **mysql只独占模式，如果配置为共享模式，怎么处理？——yashan的连接使用共享模式，mysql使用独占模式**


2、会话管理

（1）会话状态

1）v$session：mysql会话与yasql会话一致，  **差异：**  由于mysql客户端连接时未携带主机名信息，不会显示客户端主机名（CLI_HOSTNAME）

SQL> select * from v$session where type='USER';

SID SERIAL# PADDR XID XRMID LOCKWAIT WAIT_EVENT USER# USERNAME STATUS CLI_OSUSER CLI_PROGRAM   **CLI_HOSTNAME**   COMMAND SQL_HASH_VALUE SQL_ID TYPE SERVER LOGON_TIME IP_ADDRESS EXEC_START_TIME IS_HEARTBEAT RETRY_CNT RETRY_INFO EXEC_STATUS AUDSID CLIENT_IDENTIFIER     
  -------- ------------ --------------------- --------------------- ------------ --------------------- --------------------------------- ------------ ---------------------------------------------------------------- --------- ---------------------------------------------------------------- ---------------------------------------------------------------- ---------------------------------------------------------------- ------------ --------------------- ----------------- ----------------- ------------- ---------------------------------------------------------------- ------------------------------------------------- ---------------------------------------------------------------- ------------ ------------ ------------ ------------ --------------------- ----------------------------------------------------------------    
  20 1618 140599404484352 4657709119 20 0 SYS ACTIVE dblink_u1 /data/dblink_u1/yasdb_home/yashandb/23.2.3.4/bin/yasql AchorBase 1 1824087786 0qzrnyc65p2pw USER DEDICATED 2024-06-14 10:05:36.510111 2024-06-17 15:29:54.943420 NO 0 0 0 4294967295

1 row fetched.

![](https://pingcode.yasdb.com/atlas/files/public/67396e57a1ad9a3311dc96d4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBZ0FBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE0NTEsImV4cCI6MTc4MjM4MjI1MX0.nHadJ6R-pZoRmohdasY0a82-afbYYhaKQkKsyM6sZfM)

**会话相关其他视图：**  v$session_event，v$session_roles，v$session_wait，v$session_worker

2）V$SQL视图记录客户端执行过的SQL语句

（2）会话资源：如默认1024，yasql和mysql会话均受该限制（共用）

（3）kill session命令，指alter system kill session 'session_id,serial#';v$session视图有相关信息

（4）mysql客户端和jdbc：没有差异

## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

仅支持独占模式。即无论YashanDB实例配置的是独占模式还是共享模式，MySQL只用独占模式。

# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用等价类、边界值、场景分析等测试设计工程方法

## 3.2 详细测试设计

1、功能测试分析

|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|mysql会话管理|yashan默认模式（独占）,——yasql和mysql共用  **max_sessions-内部消耗数(类型为background)-32(并行)-1(sys专用)-2(保留连接)**|会话生命周期-连接|1、数量：单个、多个、并发,2、用户类型：sys（dba）用户、普通用户,3、连接方式：mysql客户端（细分：登录到命令行、-e 执行sql语句、< 执行sql文件），jdbc,mysql client不支持在会话内conn|1、每个连接，成功后查询v$session确认信息正确(也验证了可以执行sql),2、其他相关视图：v$session_event，v$session_roles，v$session_wait，v$session_worker|登录失败（密码错误）|1、v$session中不会有记录,2、资源正确释放：连续失败1024次|
|  
|  
|会话生命周期-使用|执行sql（按类别覆盖：dcl、dml、ddl，mysql特定命令：set、show）|1、sql执行成功，v$sql视图记录相关信息|/|/|
|  
|  
|会话生命周期-退出|1、主动退出：exit,2、被动退出：kill，alter system kill session，数据库shutdown,3、超时退出：mysql客户端连接有超时机制|公共：v$session视图中记录变化,2、客户端有对应提示，无其他异常,3、表现与mysql一致（连续执行2条sql，第1条报断开，第2条重连成功）|/|/|
|  
|  
|会话资源-连接,与yasql共用max_sessions个资源|1、只mysql连接数=max_sessions-内部消耗数(类型为background)-32(并行)-1(sys专用)-2(保留连接),2、yasql+mysql连接数=max_sessions-内部消耗数(类型为background)-32(并行)-1(sys专用)-2(保留连接),连接方式含串行和并发|均能连接成功可成功执行sql，v$session有记录且正确|1、连接数消耗完，yasql连接,2、连接数消耗完，mysql连接|均连接失败，无其他异常|
|  
|  
|会话资源-释放|退出资源释放：,1、基本场景构造方法：在mysql连接数=max_sessions-内部消耗数-2 状态，不同退出方式（主动退出，kill，alter system kill session，mysql超时）退出后，新建mysql或yasql连接,2、复杂场景：频繁连接和退出|1、退出后，成功新建连接|/|/|
|  
|yashan共享模式,——yasql共享线程（线程和会话概念有差异，  MAX_WORKERS控制线程数  ），session资源还是yasql和mysql共用|会话生命周期-连接|同上|同上|同上|同上|
|  
|  
|会话生命周期-使用|同上|同上|/|/|
|  
|  
|会话生命周期-退出|同上|同上|/|/|
|  
|  
|会话资源-连接,与yasql共用max_sessions个资源|同上|同上|同上|同上|
|  
|  
|会话资源-释放|同上|同上|同上|同上|


  


**经过测试，可用连接实际规则：**

|配置|客户端|场景1|场景2|场景3|
|:---|:---|:---|:---|:---|
|max_sessions=96,并行worker=默认32,background=默认23|yasql|先可  **udc方式**  连38个  **普通用户**  ，总数61(v$session视图记录数)，该状态下sys、普通用户均无法ip方式连接，sys可以udc方式连2个，总数63(v$session视图记录数)|**sys用户**  可  **udc方式**  连40个，总数63|先可  **tcp方式**  连38个  **sys用户，**  剩下  **同场景1**|
||mysql|先可通过  **tcp方式**  连38个  **sys用户**  ，剩下  **同上场景1**|先可通过  **tcp方式**  连38个  **sys用户**  ，剩下  **同上场景1**|/|


  


2、经分析不涉及专项测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|Y|
|KT|Y|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


# 4. 测试用例

1. 冒烟：
1. 文本用例：


# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：

## Attachments:

## Comments:

|  [](null)  ,测试设计评审,会议时间：2024/06/21 15:30~16:00,与会人：张鹏飞、林永豪、冯浩博、史鑫、孟麟,会议纪要：,1、可用会话连接=max_sessions-内部消耗-2(预留),2、共享模式是worker线程共享，session数量还是yasql和mysql共用,Posted by menglin at 六月 21, 2024 16:23|
|---|
