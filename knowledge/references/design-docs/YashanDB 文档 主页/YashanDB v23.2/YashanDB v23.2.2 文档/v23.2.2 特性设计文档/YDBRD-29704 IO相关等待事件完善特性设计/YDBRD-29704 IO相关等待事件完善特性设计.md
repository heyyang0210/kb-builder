Created by 李佐龙, last modified on 四月 08, 2024

*详细设计-YDBRD-29704: IO相关等待事件完善*

* IR链接：*    [[YDBRD-29668] 等待事件完善 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29668)  

*SR链接：*    [[YDBRD-29704] IO相关等待事件完善 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29704)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

等待事件是一种用于衡量数据库运行状态的重要指标和依据，它可以辅助我们进行性能分析和故障诊断。

当前的YashanDB中，当VM block正在换入或者换出，或是数据文件扩展时，这样的IO操作并没有相应的等待事件来统计，本需求主要为它们增设相应的等待事件。

这些动作在单机、分布式和集群的部署形态下都会发生，所以三种部署形态均会增设等待事件。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

- VM的换入换出可参考：    [VM模块设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=38802082)  
- 数据文件扩展可参考：
    -   [表空间 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=38043706)  
    -   [RESIZE DATAFILE - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/RESIZE+DATAFILE)  


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

不需引入新的组件。

##   [2. 接口](#2-接口)  

###   [2.1 视图 x$system_event](#21-视图-xsystem-event)  

可以查询到新增的三类等待事件：

```
SQL&gt; select event, event_id, wait_class from sys.x$system_event;

EVENT                                 EVENT_ID WAIT_CLASS
--------------------------------- ------------ -----------------
...............                             .. ..................
swapping in vm block                        84 System I/O
swapping out vm block                       85 System I/O
extending data file                         86 System I/O
...............                             .. ..................

89 rows fetched.

SQL&gt;

```

###   [2.2 视图 v$system_event](#22-视图-vsystem-event)  

当发生了相应等待事件后，可以查询该视图看到新增等待事件，包括其命中次数、前台耗时等等。

###   [2.3 视图 v$session_event](#23-视图-vsession-event)  

当发生了相应等待事件后，可以查询该视图看到各个会话中的新增等待事件，包括其命中次数、前台耗时等等。

##   [3. 规格与约束](#3-规格与约束)  

VM的换入换出和数据文件的扩展不依赖于具体的部署形态，所以单机、集群和分布式均涉及这些等待事件的加入。

##   [4. 特性](#4-特性)  

在本加入之前，通过    [2. 接口](#2.%20%E6%8E%A5%E5%8F%A3)    中描述的视图无法查询到下述等待事件；

在加入特性之后，    `x$system_event`    中可以直接查询到这些事件，当它们命中之后，可以在    `v$system_event`    和    `v$session_event`    中查询到它们的统计数据。

查询视图    `x$system_event`    、    `v$system_event`    、    `v$session_event`    可以通过各个字段查看其统计数据：

- TOTAL_WAITS：总等待次数
- TIME_WAITED：等待时间（毫秒）
- TOTAL_WAITS_FG：前台等待次数
- TIME_WAITED_FG：前台等待时间（毫秒）


更加具体的统计数据说明可以参考：

-   [V$SYSTEM_EVENT - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/V%24SYSTEM_EVENT)  
-   [V$SESSION_EVENT](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$SESSION_EVENT.html)    、    [【YDBRD-23742】支持v$session_event视图测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138545754)  


###   [4.1 VM换出等待事件](#41-vm换出等待事件)  

当VM需要使用内存里的block，但是内存不足时，会将暂时不用的block换出到SWAP表空间。

命中之后可以观察到    `swapping out vm block`    的统计数据发生变化。

###   [4.2 VM换入等待事件](#42-vm换入等待事件)  

VM需要打开已经换出到磁盘的block时，将SWAP表空间上的block换入到内存。

命中之后可以观察到    `swapping in vm block`    的统计数据发生变化。

###   [4.3 数据文件扩展等待事件](#43-数据文件扩展等待事件)  

当触发数据文件扩展或对数据文件RESIZE需要进行扩展时，会对数据文件进行扩展。

命中之后可以观察到    `extending data file`    的统计数据发生变化。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

###   [5.1 自测：确认等待事件列表已变更](#51-自测确认等待事件列表已变更)  

MR门禁中会查    `x$system_event`    来确认事件列表，可以看到新加入的三种等待事件

```
SQL&gt; select event, event_id, wait_class from sys.x$system_event;

EVENT                                 EVENT_ID WAIT_CLASS
--------------------------------- ------------ -----------------
...............                             .. ..................
swapping in vm block                        84 System I/O
swapping out vm block                       85 System I/O
extending data file                         86 System I/O
...............                             .. ..................

89 rows fetched.

SQL&gt;

```

###   [5.2 自测：RESIZE时数据文件扩展等待事件触发](#52-自测resize时数据文件扩展等待事件触发)  

下面的自测用例中启动DB，接着创建一个表空间，查询    `v$session_event`    和    `v$system_event`    确认数据文件扩展等待事件未命中过，然后扩展表空间的数据文件，在查询视图确认其已经命中。

- 单机部署模式已测试
- 集群模式下RESIZE文件提示: feature "resize datafile on cluster" has not been implemented yet (SQL State: 0A000)
- 分布式下RESIZE提示：YAS-00004 feature "alter database DATAFILE" has not been implemented yet


```
sys@127.0.0.1:1688 &gt; -- 扩展文件前确认等待事件未命中过
sys@127.0.0.1:1688 &gt; select * from v$session_event where SID in (select distinct sid from v$mystat);
╭─────┬───────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬────────────╮
│ SID │ EVENT                     │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS │
├─────┼───────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼────────────┤
│ 21  │ SQL*Net message to client │ 2           │ 0              │ 0           │ 0            │ 74                │ 2              │ 0                 │ 0              │ 0               │ 74                   │ 50       │ Network    │
╰─────┴───────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴────────────╯
1 row(s) fetched
sys@127.0.0.1:1688 &gt; select * from v$system_event;
╭─────────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬───────────────╮
│ EVENT                       │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS    │
├─────────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼───────────────┤
│ db file scattered read      │ 3018        │ 0              │ 373         │ .12          │ 373902            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 9        │ User I/O      │
│ db file sequential read     │ 77          │ 0              │ 226         │ 2.94         │ 226929            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 10       │ User I/O      │
│ db file parallel write      │ 3           │ 0              │ 14          │ 4.67         │ 14538             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 11       │ System I/O    │
│ log file single write       │ 2           │ 0              │ 0           │ 0            │ 144               │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 31       │ System I/O    │
│ log file parallel write     │ 17          │ 0              │ 3           │ .18          │ 3069              │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 32       │ System I/O    │
│ log file sync               │ 14          │ 0              │ 3           │ .21          │ 3462              │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 33       │ Commit        │
│ recovery read               │ 1           │ 0              │ 129         │ 129          │ 129911            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 34       │ User I/O      │
│ log file switch completion  │ 1           │ 0              │ 1           │ 1            │ 1243              │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 36       │ Configuration │
│ redo remote sync complete   │ 192643      │ 0              │ 63          │ 0            │ 63886             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 38       │ Commit        │
│ SQL*Net message from client │ 17          │ 0              │ 209175      │ 12304.41     │ 209175965         │ 17             │ 0                 │ 209175         │ 12304.41        │ 209175965            │ 49       │ Idle          │
│ SQL*Net message to client   │ 16          │ 0              │ 0           │ 0            │ 361               │ 16             │ 0                 │ 0              │ 0               │ 361                  │ 50       │ Network       │
╰─────────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴───────────────╯
11 row(s) fetched
sys@127.0.0.1:1688 &gt; -- 创建表空间并扩展数据文件
sys@127.0.0.1:1688 &gt; CREATE TABLESPACE test_tbs DATAFILE '?/dbfiles/test_tbs' size 20M autoextend off;
Succeed
sys@127.0.0.1:1688 &gt; ALTER DATABASE DATAFILE '?/dbfiles/test_tbs' RESIZE 100M;
Succeed
sys@127.0.0.1:1688 &gt; -- 确认等待事件已命中
sys@127.0.0.1:1688 &gt; select * from v$session_event where SID in (select distinct sid from v$mystat);
╭─────┬───────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬────────────╮
│ SID │ EVENT                     │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS │
├─────┼───────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼────────────┤
│ 21  │ log file parallel write   │ 3           │ 0              │ 0           │ 0            │ 280               │ 3              │ 0                 │ 0              │ 0               │ 280                  │ 32       │ System I/O │
│ 21  │ log file sync             │ 3           │ 0              │ 0           │ 0            │ 299               │ 3              │ 0                 │ 0              │ 0               │ 299                  │ 33       │ Commit     │
│ 21  │ SQL*Net message to client │ 6           │ 0              │ 0           │ 0            │ 218               │ 6              │ 0                 │ 0              │ 0               │ 218                  │ 50       │ Network    │
│ 21  │ extending data file       │ 1           │ 0              │ 119         │ 119          │ 119785            │ 1              │ 0                 │ 119            │ 119             │ 119785               │ 86       │ System I/O │
╰─────┴───────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴────────────╯
4 row(s) fetched
sys@127.0.0.1:1688 &gt; select * from v$system_event;
╭─────────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬───────────────╮
│ EVENT                       │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS    │
├─────────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼───────────────┤
│ db file scattered read      │ 3018        │ 0              │ 373         │ .12          │ 373902            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 9        │ User I/O      │
│ db file sequential read     │ 77          │ 0              │ 226         │ 2.94         │ 226929            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 10       │ User I/O      │
│ db file parallel write      │ 5           │ 0              │ 18          │ 3.6          │ 18536             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 11       │ System I/O    │
│ log file single write       │ 2           │ 0              │ 0           │ 0            │ 144               │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 31       │ System I/O    │
│ log file parallel write     │ 21          │ 0              │ 3           │ .14          │ 3432              │ 3              │ 0                 │ 0              │ 0               │ 280                  │ 32       │ System I/O    │
│ log file sync               │ 17          │ 0              │ 3           │ .18          │ 3761              │ 3              │ 0                 │ 0              │ 0               │ 299                  │ 33       │ Commit        │
│ recovery read               │ 1           │ 0              │ 129         │ 129          │ 129911            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 34       │ User I/O      │
│ log file switch completion  │ 1           │ 0              │ 1           │ 1            │ 1243              │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 36       │ Configuration │
│ redo remote sync complete   │ 279024      │ 0              │ 94          │ 0            │ 94082             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 38       │ Commit        │
│ SQL*Net message from client │ 26          │ 0              │ 304861      │ 11725.42     │ 304861017         │ 26             │ 0                 │ 304861         │ 11725.42        │ 304861017            │ 49       │ Idle          │
│ SQL*Net message to client   │ 25          │ 0              │ 0           │ 0            │ 565               │ 25             │ 0                 │ 0              │ 0               │ 565                  │ 50       │ Network       │
│ extending data file         │ 1           │ 0              │ 119         │ 119          │ 119785            │ 1              │ 0                 │ 119            │ 119             │ 119785               │ 86       │ System I/O    │
╰─────────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴───────────────╯
12 row(s) fetched
sys@127.0.0.1:1688 &gt;

```

###   [5.3 自测：触发表空间autoextend时命中数据文件扩展事件](#53-自测触发表空间autoextend时命中数据文件扩展事件)  

下面的自测用例中启动DB，接着创建一个表空间和表，查询    `v$session_event`    和    `v$system_event`    确认数据文件扩展等待事件未命中过，然后向表中插入数据触发表空间数据文件自动扩展，在查询视图确认其已经命中。

- 单机、集群模式均已测试，可以观察到等待事件触发
- 分布式可参考5.4用例测试：建一个表，插入大量数据


```
sys@127.0.0.1:1688 &gt; -- 准备一个表空间（初始数据文件1M方便触发扩展），开启autoextend，并创建一个表
sys@127.0.0.1:1688 &gt; CREATE TABLESPACE test_tbs DATAFILE '?/dbfiles/test_tbs' size 1M autoextend on;
Succeed
sys@127.0.0.1:1688 &gt; create table test_tb(f1 integer,f2 bigint,f3 double,f4 number(10,2),f5 char(30),f6 varchar(1000),f7 date,f8 timestamp) tablespace test_tbs;
Succeed
sys@127.0.0.1:1688 &gt; -- 确认事件未命中过
sys@127.0.0.1:1688 &gt; select * from v$system_event;
╭─────────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬───────────────╮
│ EVENT                       │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS    │
├─────────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼───────────────┤
│ db file scattered read      │ 2378        │ 0              │ 44          │ .02          │ 44565             │ 29             │ 0                 │ 0              │ 0               │ 240                  │ 9        │ User I/O      │
│ db file sequential read     │ 80          │ 0              │ 0           │ 0            │ 934               │ 10             │ 0                 │ 0              │ 0               │ 113                  │ 10       │ User I/O      │
│ db file parallel write      │ 5           │ 0              │ 13          │ 2.6          │ 13187             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 11       │ System I/O    │
│ log file single write       │ 2           │ 0              │ 0           │ 0            │ 115               │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 31       │ System I/O    │
│ log file parallel write     │ 25          │ 0              │ 3           │ .12          │ 3853              │ 8              │ 0                 │ 1              │ .13             │ 1016                 │ 32       │ System I/O    │
│ log file sync               │ 20          │ 0              │ 3           │ .15          │ 3863              │ 8              │ 0                 │ 1              │ .13             │ 1079                 │ 33       │ Commit        │
│ recovery read               │ 1           │ 0              │ 125         │ 125          │ 125258            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 34       │ User I/O      │
│ log file switch completion  │ 1           │ 0              │ 1           │ 1            │ 1032              │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 36       │ Configuration │
│ redo remote sync complete   │ 130582      │ 0              │ 46          │ 0            │ 46585             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 38       │ Commit        │
│ SQL*Net message from client │ 11          │ 0              │ 140602      │ 12782        │ 140602800         │ 11             │ 0                 │ 140602         │ 12782           │ 140602800            │ 49       │ Idle          │
│ SQL*Net message to client   │ 10          │ 0              │ 0           │ 0            │ 260               │ 10             │ 0                 │ 0              │ 0               │ 260                  │ 50       │ Network       │
╰─────────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴───────────────╯
11 row(s) fetched
sys@127.0.0.1:1688 &gt; select * from v$session_event where SID in (select distinct sid from v$mystat);
╭─────┬───────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬────────────╮
│ SID │ EVENT                     │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS │
├─────┼───────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼────────────┤
│ 19  │ db file scattered read    │ 24          │ 0              │ 0           │ 0            │ 195               │ 24             │ 0                 │ 0              │ 0               │ 195                  │ 9        │ User I/O   │
│ 19  │ db file sequential read   │ 10          │ 0              │ 0           │ 0            │ 113               │ 10             │ 0                 │ 0              │ 0               │ 113                  │ 10       │ User I/O   │
│ 19  │ log file parallel write   │ 8           │ 0              │ 1           │ .13          │ 1016              │ 8              │ 0                 │ 1              │ .13             │ 1016                 │ 32       │ System I/O │
│ 19  │ log file sync             │ 8           │ 0              │ 1           │ .13          │ 1079              │ 8              │ 0                 │ 1              │ .13             │ 1079                 │ 33       │ Commit     │
│ 19  │ SQL*Net message to client │ 5           │ 0              │ 0           │ 0            │ 178               │ 5              │ 0                 │ 0              │ 0               │ 178                  │ 50       │ Network    │
╰─────┴───────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴────────────╯
5 row(s) fetched
sys@127.0.0.1:1688 &gt; -- 插入一些数据触发自动扩展
sys@127.0.0.1:1688 &gt; declare
    f5 char(30) := 'test_tb_001';
    f6 varchar(1000) := 'test_tb_';
    f7 date := '2020-12-31';
    f8 timestamp :='2020-01-31 01:59:58.999999';
begin
    for i in 1 .. 10000 loop
        insert into test_tb values(i,i*2,i*3,i*2.1,f5,f6||cast(i as varchar(10)),f7+i,f8+i);
        commit;
    end loop;
end;
/
Succeed
sys@127.0.0.1:1688 &gt; -- 确认事件已触发
sys@127.0.0.1:1688 &gt; select * from v$system_event;
╭─────────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬───────────────╮
│ EVENT                       │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS    │
├─────────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼───────────────┤
│ free buffer wait            │ 2544        │ 0              │ 1           │ 0            │ 1743              │ 2543           │ 0                 │ 1              │ 0               │ 1742                 │ 8        │ Configuration │
│ db file scattered read      │ 2381        │ 0              │ 44          │ .02          │ 44605             │ 32             │ 0                 │ 0              │ 0               │ 280                  │ 9        │ User I/O      │
│ db file sequential read     │ 10095       │ 0              │ 118         │ .01          │ 118795            │ 10024          │ 0                 │ 117            │ .01             │ 117965               │ 10       │ User I/O      │
│ db file parallel write      │ 193         │ 0              │ 670         │ 3.47         │ 670116            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 11       │ System I/O    │
│ undo segment extending      │ 1           │ 0              │ 40          │ 40           │ 40977             │ 1              │ 0                 │ 40             │ 40              │ 40977                │ 18       │ Configuration │
│ log file single write       │ 2           │ 0              │ 0           │ 0            │ 115               │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 31       │ System I/O    │
│ log file parallel write     │ 10041       │ 0              │ 1103        │ .11          │ 1103269           │ 10011          │ 0                 │ 1099           │ .11             │ 1099078              │ 32       │ System I/O    │
│ log file sync               │ 10023       │ 0              │ 1132        │ .11          │ 1132097           │ 10011          │ 0                 │ 1129           │ .11             │ 1129313              │ 33       │ Commit        │
│ recovery read               │ 1           │ 0              │ 125         │ 125          │ 125258            │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 34       │ User I/O      │
│ log file switch completion  │ 1           │ 0              │ 1           │ 1            │ 1032              │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 36       │ Configuration │
│ redo remote sync complete   │ 132266      │ 0              │ 47          │ 0            │ 47130             │ 0              │ 0                 │ 0              │ 0               │ 0                    │ 38       │ Commit        │
│ SQL*Net message from client │ 18          │ 0              │ 140750      │ 7819.44      │ 140750192         │ 18             │ 0                 │ 140750         │ 7819.44         │ 140750192            │ 49       │ Idle          │
│ SQL*Net message to client   │ 17          │ 0              │ 0           │ 0            │ 401               │ 17             │ 0                 │ 0              │ 0               │ 401                  │ 50       │ Network       │
│ extending data file         │ 2           │ 0              │ 210         │ 105          │ 210854            │ 2              │ 0                 │ 210            │ 105             │ 210854               │ 86       │ System I/O    │
╰─────────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴───────────────╯
14 row(s) fetched
sys@127.0.0.1:1688 &gt; select * from v$session_event where SID in (select distinct sid from v$mystat);
╭─────┬───────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────┬───────────────────┬────────────────┬───────────────────┬────────────────┬─────────────────┬──────────────────────┬──────────┬───────────────╮
│ SID │ EVENT                     │ TOTAL_WAITS │ TOTAL_TIMEOUTS │ TIME_WAITED │ AVERAGE_WAIT │ TIME_WAITED_MICRO │ TOTAL_WAITS_FG │ TOTAL_TIMEOUTS_FG │ TIME_WAITED_FG │ AVERAGE_WAIT_FG │ TIME_WAITED_MICRO_FG │ EVENT_ID │ WAIT_CLASS    │
├─────┼───────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────┼───────────────────┼────────────────┼───────────────────┼────────────────┼─────────────────┼──────────────────────┼──────────┼───────────────┤
│ 19  │ free buffer wait          │ 2543        │ 0              │ 1           │ 0            │ 1742              │ 2543           │ 0                 │ 1              │ 0               │ 1742                 │ 8        │ Configuration │
│ 19  │ db file scattered read    │ 27          │ 0              │ 0           │ 0            │ 235               │ 27             │ 0                 │ 0              │ 0               │ 235                  │ 9        │ User I/O      │
│ 19  │ db file sequential read   │ 10024       │ 0              │ 117         │ .01          │ 117965            │ 10024          │ 0                 │ 117            │ .01             │ 117965               │ 10       │ User I/O      │
│ 19  │ undo segment extending    │ 1           │ 0              │ 40          │ 40           │ 40977             │ 1              │ 0                 │ 40             │ 40              │ 40977                │ 18       │ Configuration │
│ 19  │ log file parallel write   │ 11          │ 0              │ 1           │ .09          │ 1566              │ 11             │ 0                 │ 1              │ .09             │ 1566                 │ 32       │ System I/O    │
│ 19  │ log file sync             │ 11          │ 0              │ 1           │ .09          │ 1649              │ 11             │ 0                 │ 1              │ .09             │ 1649                 │ 33       │ Commit        │
│ 19  │ SQL*Net message to client │ 7           │ 0              │ 0           │ 0            │ 233               │ 7              │ 0                 │ 0              │ 0               │ 233                  │ 50       │ Network       │
│ 19  │ extending data file       │ 2           │ 0              │ 210         │ 105          │ 210854            │ 2              │ 0                 │ 210            │ 105             │ 210854               │ 86       │ System I/O    │
╰─────┴───────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────┴───────────────────┴────────────────┴───────────────────┴────────────────┴─────────────────┴──────────────────────┴──────────┴───────────────╯
8 row(s) fetched
sys@127.0.0.1:1688 &gt; -- 移除表空间和表
sys@127.0.0.1:1688 &gt; drop table test_tb;
Succeed
sys@127.0.0.1:1688 &gt; drop TABLESPACE test_tbs including contents and datafiles;
Succeed
sys@127.0.0.1:1688 &gt;

```

###   [5.4 自测：VM换入换出事件](#54-自测vm换入换出事件)  

启动DB后，先查询    `v$system_event`    和    `v$session_event`    确认事件目前的统计数据，然后创建一张表并插入大量数据，执行一些需要使用VM的语句（如    `order by`    ），接着再次查询视图对比事件的统计数据变化。（为了更容易触发VM换入换出，将    `VM_BUFFER_SIZE`    设置为了    `8M`    ），该用例也可以测出数据文件扩展的等待事件。

- 在单机模式和集群模式下均可观察到VM换入和换出事件的统计数据变化。


```
-- 确认事件未命中过
select * from v$system_event;
select * from v$session_event where SID in (select SID from v$session where username = 'SYS' and SID = (select distinct sid from v$mystat));
--10W条
drop table tb_vm_01;
create table tb_vm_01(c1 number,c2 int,c3 integer,c4 int,c5 binary_float,c6 binary_double,c7 number,c8 char(2000),c9 varchar(2000),c10 date,c11 clob,c12 blob);
declare
begin
 for i in 1..20000
 loop
  insert into tb_vm_01 values(1,i,i%483647,i-9223372,i/32767,i/483647,sqrt(i),'c8_char','c9_archar',to_date('2021-04-20', 'YYYY-MM-DD') + (interval '1' DAY)*(i%365),'c11_clob',null);
  commit;
  insert into tb_vm_01 values(2,i,i%483647,i-9223372,i/32767,i/483647,sqrt(i),'c8_char','c9_archar',to_date('2021-04-20', 'YYYY-MM-DD') + (interval '1' DAY)*(i%365),'c11_clob',null);
  commit;
  insert into tb_vm_01 values(3,i,i%483647,i-9223372,i/32767,i/483647,sqrt(i),'c8_char','c9_archar',to_date('2021-04-20', 'YYYY-MM-DD') + (interval '1' DAY)*(i%365),'c11_clob',null);
  commit;
  insert into tb_vm_01 values(4,i,i%483647,i-9223372,i/32767,i/483647,sqrt(i),'c8_char','c9_archar',to_date('2021-04-20', 'YYYY-MM-DD') + (interval '1' DAY)*(i%365),'c11_clob',null);
  commit;
  insert into tb_vm_01 values(5,i,i%483647,i-9223372,i/32767,i/483647,sqrt(i),'c8_char','c9_archar',to_date('2021-04-20', 'YYYY-MM-DD') + (interval '1' DAY)*(i%365),'c11_clob',null);
  commit;
 end loop;
end;
/
select c1 from tb_vm_01 order by c1;
select c1 from tb_vm_01 group by c1;
select distinct c1 from tb_vm_01 order by c1;
select count(distinct c1) from tb_vm_01 order by c1;
select max(distinct c1) from tb_vm_01 order by c1;
select min(distinct c1),avg(distinct c4) from tb_vm_01 group by c1;
select sum(distinct c2) from tb_vm_01 group by c2;
select sum(distinct c3),max(distinct c4),avg(distinct c6),min(distinct c10) from tb_vm_01 order by count(distinct c7);
select avg(distinct c3),avg(distinct c4),avg(distinct c6),avg(distinct c5) from tb_vm_01 order by avg(distinct c6);
select sum(distinct c3 +10),max(distinct c4 -10),avg(distinct c6 *10),min(distinct c10 -10) from tb_vm_01 order by count(distinct c7 *10);
-- 确认事件已触发
select * from v$system_event;
select * from v$session_event where SID in (select SID from v$session where username = 'SYS' and SID = (select distinct sid from v$mystat));
-- 移除表空间
drop table tb_vm_01;

```

##   [6.资料设计章节](#6资料设计章节)  

- 在    `等待事件.md`    补充增加事件的说明


##   [7.未来规划](#7未来规划)  