*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/66f3f06b52495bd785c485a6?](https://pingcode.yasdb.com/ship/ideas/66f3f06b52495bd785c485a6?)  

#YASHAN-3352  AWR快照存储优化和支持设置TOP SQL的数量

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/67186a42e489dd0868fccb2f?](https://pingcode.yasdb.com/pjm/items/67186a42e489dd0868fccb2f?)  

#YDBRD-34616 AWR快照存储优化和支持设置TOP SQL的数量

##   [1. 总述](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#1-overview%E6%A6%82%E8%BF%B0)  

当前生成快照时，wrh$_sqltext和wrh$_sqlstat会插入系统视图v$sqlarea的全部数据，如果该视图有几十万行sql，则每次生成快照都会写进去导致sysaux空间扩展较快。   

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求来源：

      深圳环水

场景：

     1、在特定场景下，yasdb 8天的快照大小超过100G，并且对比生成一个快照跟Oracle对比，存储占用是100多倍

  [ https://jira.yasdb.com/browse/SAISSUE-624 ](https://jira.yasdb.com/browse/SAISSUE-624)  

     2、Oracle通过exec dbms_workload_repository.modify_snapshot_settings(topnsql=>100);设置AWR的TOPSQL输出行数，默认30

需求描述：

    AWR快照存储优化，至少持平Oracle

需求范围：

1. 单机、集群


##   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [(548) AWR快照存储优化调研 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/QINQIUTING/pages/674ad3dda03b823486051e18)  

  [(548) AWR快照存储优化友商原理调研 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/QINQIUTING/pages/6763feacd2baff0fd55dd3d9)  

***1.***  *oracle支持通过*  exec dbms_workload_repository.modify_snapshot_settings(topnsql=>100);设置AWR的TOPSQL输出行数

  [https://docs.oracle.com/en/database/oracle/oracle-database/18/arpls/DBMS_WORKLOAD_REPOSITORY.html#GUID-78F7565C-0CA2-49BE-9D58-DDE96F87E381](https://docs.oracle.com/en/database/oracle/oracle-database/18/arpls/DBMS_WORKLOAD_REPOSITORY.html#GUID-78F7565C-0CA2-49BE-9D58-DDE96F87E381)  

![WXWorkLocalPro_17320060531024.png](https://pingcode.yasdb.com/atlas/files/public/673c50c4a1ad9a3311de3408/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFnQUFBQUFBUUFBQkFBQWdBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyMDQsImV4cCI6MTc4MjM1NjAwNH0.m73UTt-KMF8QD030yOAryBhHol3L4zrabSGPyxQ5eQo)

![WXWorkLocalPro_17320059651925.png](https://pingcode.yasdb.com/atlas/files/public/673c51518970c2af4f53b5b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFnQUFBQUFBUUFBQkFBQWdBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyMDQsImV4cCI6MTc4MjM1NjAwNH0.m73UTt-KMF8QD030yOAryBhHol3L4zrabSGPyxQ5eQo)

在WRM$_WR_CONTROL通过topnsql字段（number类型）记录该值的变化，并且当设置topnsql=>MAXIMUM时，WRM$_WR_CONTROL的topnsql值为2000000001。

**2.**  oracle通过topnsql控制生成快照时插入到wrh$_sqlstat、wrh$_sqltext的sql数量，表现为生成快照时wrh$_sqlstat插入每个SQL条件(Elapsed Time, CPU Time, Parse Calls, Shareable Memory, Version Count)的TOP SQL且去除重复sql，wrh$_sqltext插入wrh$_sqlstat本次插入的sql对应的sql_text且不存在在当前wrh$_sqltext表的sql_text。

wrh$_sqlstat数据来源X$KEWRSQLIDTAB、X$KGLCURSOR_CHILD_SQLIDPH，wrh$_sqltext表数据来源x$kewrtsqltext，但相关插入sql没有对于top sql的处理，就是普通的insert into select，自己查询X$KEWRSQLIDTAB、x$kewrtsqltext表也没有数据，并且查询不到这两个x$表的机制，可能生成快照时有特殊处理。

**3.**  收集到系统表的sql是和上一次快照之间有增量变化的top sql。



###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|支持设置top sql的数量|通过dbms_awr.  modify_snapshot_settings设置topnsql|是|是|
||快照存储优化|通过设置的topnsql控制  插入到wrh$_sqlstat、wrh$_sqltext的sql数量|是|是|
|  
|记录的top sql为和上一次快照时间间隔内有变化的sql|context再记录一组last snap stat，查询x$sqlarea时_delta值为统计项当前值 - last snap记录值|是|是|
|性能|性能场景1|----|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

**高级包函数接口变更：**

```
--原来
DBMS_AWR.MODIFY_SNAPSHOT_SETTINGS(
	retention       IN NUMBER   DEFAULT NULL,        
	interval        IN NUMBER   DEFAULT NULL,        
	dbid            IN NUMBER   DEFAULT NULL);	

--优化后
DBMS_AWR.MODIFY_SNAPSHOT_SETTINGS(
	retention       IN NUMBER   DEFAULT NULL,        
	interval        IN NUMBER   DEFAULT NULL,
	dbid            IN NUMBER   DEFAULT NULL,
    topnsql         IN VARCHAR2 DEFAULT NULL);	

```

topnsql：允许用户指定以下值：（DEFAULT、MAXIMUM、N）。N是生成快照时每个SQL标准刷新的Top SQL数量，可指定范围为[30,50000]；指定DEFAULT会使系统恢复默认行为，即TOP 30；指定MAXIMUM会获取视图中的全部SQL。该参数默认为NULL，表示保持当前设置。

##   [3. 规格与约束](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#3-interfaces%E6%8E%A5%E5%8F%A3)  

无

##   [4. 特性](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

### **总体方案：**

1.通过exec dbms_workload_repository.modify_snapshot_settings(topnsql=>30);设置每次创建快照时收集到系统表的每个sql标准（elapsed_time、cpu_time、parse_calls、sharable_mem）的sql数量；

2.收集到系统表的sql是和上一次快照之间有增量变化的top sql；

3.增量变化在x$sqlarea增加一组_delta值展示，通过在context->stat上记录每个统计项的当前值和last snap值，视图的_delta值即为统计项的当前值 - last snap值。

4.创建快照时，在收集完快照信息之后更新last snap stat。



###   [4.1 支持设置topnsql](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

1.WRM$_WR_CONTROL增加tonsql字段（number类型）；

2.modify_snapshot_settings存储过程增加入参topnsql IN VARCHAR2 DEFAULT NULL；

3.入参topnsql为N时，直接更新WRM$_WR_CONTROL的topnsql；入参topnsql为DEFAULT时，更新WRM$_WR_CONTROL的topnsql为默认值30；入参topnsql为MAXIMUM时，更新WRM$_WR_CONTROL的topnsql为2000000001。



###   [4.2 内部sqlstat调整](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

**1.x$sqlarea表新增字段：**

（此处增量值指的是当前统计项的值距离上一次快照的增量）

||字段名|类型|含义|
|---|---|---|---|
|1|FETCHES_DELTA|CodUint64|fetch次数的增量值|
|2|END_OF_FETCH_COUNT_DELTA|CodUint64|fetch到末尾的次数的增量值|
|3|SORTS_DELTA|CodUint64|排序次数的增量值|
|4|EXECUTIONS_DELTA|CodUint64|执行次数的增量值|
|5|PX_SERVERS_EXECS_DELTA|CodUint64|并行执行引擎的执行次数的增量值|
|6|LOADS_DELTA|CodUint64|执行计划加载的次数的增量值|
|7|INVALIDATIONS_DELTA|CodUint64|执行计划失效的次数的增量值|
|8|PARSE_CALLS_DELTA|CodUint64|解析调用次数的增量值|
|9|DISK_READS_DELTA|CodUint64|磁盘读取次数的增量值|
|10|BUFFER_GETS_DELTA|CodUint64|从缓存区获取buffer的次数的增量值|
|11|ROWS_PROCESSED_DELTA|CodUint64|处理的行数的增量值|
|12|CPU_TIME_DELTA|CodUint64|解析，执行，取数据的CPU时间的增量值（单位：微秒）|
|13|ELAPSED_TIME_DELTA|CodUint64|解析 ，执行，取数据所经历的时间的增量值，如果是分布式集群，则包含DN侧的执行时间（单位：微秒）|
|14|USER_IO_WAIT_TIME_DELTA|CodUint64|用户I/O等待时间的增量值（单位：微秒）|
|15|CLUSTER_WAIT_TIME_DELTA|CodUint64|集群间的等待时间的增量值（保留字段）（单位：微秒）|
|16|APPLICATION_WAIT_TIME_DELTA|CodUint64|应用等待时间的增量值（单位：微秒）|
|17|CONCURRENCY_WAIT_TIME_DELTA|CodUint64|并发等待时间 的增量值（单位：微秒）|
|18|DIRECT_WRITES_DELTA|CodUint64|直接写的次数的增量值|
|19|PLSQL_EXEC_TIME_DELTA|CodUint64|PL执行时间的增量值（单位：微秒），保留字段|
|20|IO_INTERCONNECT_BYTES_DELTA|CodUint64|数据库和存储系统之间的I/O交互次数的增量值|
|21|PHYSICAL_READ_REQUESTS_DELTA|CodUint64|物理读请求次数的增量值|
|22|PHYSICAL_READ_BYTES_DELTA|CodUint64|物理读的字节数的增量值|
|23|PHYSICAL_WRITE_REQUESTS_DELTA|CodUint64|物理写的请求次数的增量值|
|24|PHYSICAL_WRITE_BYTES_DELTA|CodUint64|物理写的字节数的增量值|


**2.context->stat（AnlSqlStat）新增成员AnlLastSnapStat  lastSnapStat;  用于记录上一次生成快照时各个sql统计项的值。**

```
typedef struct StAnlLastSnapStat {
    CodUint64 lastFetches;
    CodUint64 lastFetchEndCount;
    CodUint64 lastSorts;
    CodUint64 lastExecutions;
    CodUint64 lastPxServerExecutions;
    CodUint64 lastLoads;
    CodUint64 lastInvalidations;
    CodUint64 lastParseCalls;
    CodUint64 lastDiskReads;
    CodUint64 lastBufferGets;
    CodUint64 lastRowProcessed;
    CodDate   lastCpuTime;
    CodDate   lastElapsedTime;
    CodDate   lastIoWaitTime;
    CodUint64 lastApwait;
    CodUint64 lastCcwait;
    CodUint64 lastDirectWrites;
    CodDate   lastPlsqlExec;
    CodUint64 lastIoInterconnectBytes;
    CodUint64 lastPhysicalReadRequests;
    CodUint64 lastPhysicalReadBytes;
    CodUint64 lastPhysicalWriteRequests;
    CodUint64 lastPhysicalWriteBytes;
} AnlLastSnapStat;

typedef struct StAnlSqlStat {
    AnlSqlRunStat      runStat;
    AnlSqlTimeStat     timeStat;
    AnlSqlIOStat       ioStat;
    AnlSqlRealtimeStat realtimeStat;
    AnlSqlGcStat       gcStat;
    AnlLastSnapStat    lastSnapStat; //AWR sqlstat for last snapshot record
    CodBool            isReOptimizable;
    CodUint8           reserved[7];
} AnlSqlStat;
```

查询x$sqlarea时各个统计项的_delta值即为统计项的当前值 - last snap值。



**3.新增内置高级包dbms_awr_extra，即辅助AWR高级包功能实现，用c实现，不对外：**

      **3.1 update_sqlstat_last_snap存储过程实现每次创建快照时对AnlLastSnapStat的更新**  ，无入参：

       3.1.1 遍历plan cache的每个bucket；

       3.1.2 如果context != NULL，则对bucket加spinLock:

          3.1.2.1 context->refCount++；

          3.1.2.2 AnlLastSnapStat每个统计项的last snap值更新为对应统计项的当前值。

       3.1.3 bucket解锁，然后close context。

     **3.2 update_sqlstat_last_snap存储过程调用时先获取调用栈的top，确保高级包是通过SYS.DBMS_AWR.CREATE_SNAPSHOT调用的。**

**4.创建快照时，收集完快照信息并提交之后，调用dbms_awr_extra.update_sqlstat_last_snap()更新sqlstat。**  （因为收集sql统计信息和更新sqlstat并不是同步进行，所以在有并发时，下一次执行创建快照可能会发现和上一次的结果存在些许误差）





###   [4.3 快照存储优化](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

**1.获取WRM$_WR_CONTROL记录**  **的topnsql控制**  **插入到wrh$_sqlstat、wrh$_sqltext的每个sql标准的sql数量。**

**2.SQL标准取：elapsed_time、cpu_time、parse_calls、sharable_mem**  （version_count我们当前没有用到，都是1，就没必要去徒增排序的工作量了）。

   2.1 elapsed_time、cpu_time、parse_calls用的是和上一次快照的增量值，即x$sqlarea的elapsed_time_delta、cpu_time_delta、parse_calls_delta；

   2.2   **sharable_mem用delta值还是total值，需要讨论？**  （oracle用的是total值，我们当前报告展示用的是delta值；oracle的awr的sql统计信息是按plan粒度收集的，sharable_mem对于有变化的sql该是取当前占用的top sql更有意义）

**3.WRH$_SQLSTAT调整：**

   3.1 topnsql <= 50000 ：用ROW_NUMBER()实现取每个SQL标准的top sql且没有重复sql，并且是和上一次快照之间的时间内有增量值变化的sql（可以控制当topnsql比较大时收集的sql也是有意义的sql）。

   3.2 topnsql > 50000：不做排序，直接取这段时间内有增量值变化的sql。

```
--topnsql <= 50000
INSERT INTO SYS.WRH$_SQLSTAT(...)
select ...   
from     
    (select  ...,     
        row_number() over(order by elapsed_time_delta desc) elapsed_time_delta_rank,     
        row_number() over(order by cpu_time_delta desc) cpu_time_delta_rank,    
        row_number() over(order by parse_calls_delta desc) parse_calls_delta_rank,
        row_number() over(order by sharable_mem desc) sharable_mem_rank		
    from x$sqlarea  
    ) 
where     
    (elapsed_time_delta_rank <= :topnsql or cpu_time_delta_rank <= :topnsql or parse_calls_delta_rank <= :topnsql or sharable_mem_rank <= :topnsql)
	and (elapsed_time_delta > 0 or cpu_time_delta > 0 or parse_calls_delta > 0);
    
--topnsql > 50000
INSERT INTO SYS.WRH$_SQLSTAT(...)
select ...   
from x$sqlarea    
where elapsed_time_delta > 0 or cpu_time_delta > 0 or parse_calls_delta > 0;
```

**4.WRH$_SQLTEXT调整：**

   4.1 插入本次WRH$_SQLSTAT插入的sql_id对应的sql_text，并且是原来WRH$_SQLTEXT表中没有的sql_text。

   4.2 删除快照时WRH$_SQLTEXT的数据则不能用drop分区删除，而是delete，delete数据后分区空则drop分区。

```
--insert
INSERT INTO SYS.WRH$_SQLTEXT(...)
select ...
from x$sqlarea
where sql_id in (select distinct sql_id from wrh$_sqlstat where dbid = ? and snap_id = ?) and sql_id not in (select distinct sql_id from wrh$_sqltext where dbid = ?);

--delete
DELETE FROM SYS.WRH$_SQLTEXT stt WHERE stt.dbid = :dbid  
AND NOT EXISTS (SELECT 1 FROM SYS.WRH$_SQLSTAT sst WHERE sst.dbid = stt.dbid and sst.sql_id = stt.sql_id);


```



**5.AWR报告SQL Statistics模块调整：**

   4.1 8个对应的子存储过程order_by_elapsed_time、order_by_cpu_time、order_by_iowait_time、order_by_buffer_gets、order_by_physical_reads、order_by_exec、order_by_parse_call、order_by_shared_mem，两个快照的差异对比调整为begin snap 和end snap之间快照的sum(_delta)值；

   4.2 输出时，输出为wrh$_sqlstat内两个快照信息对比的topnsql的结果。



###   [4.4 升级](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

ALTER TABLE SYS.WRM$_WR_CONTROL ADD COLUMN TOPNSQL NUMBER NOT NULL DEFAULT 30



##   [5. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

|测试场景|测试步骤|预期|备注|
|---|---|---|---|
|测试modify_snapshot_settings接口|设置不同topnsql，观察WRM$_WR_CONTROL值变化，以及观察报错是否合理|WRM$_WR_CONTROL值变化符合预期；报错符合预期||
|测试设置不同topnsql快照存储的变化|设置不同topnsql，观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量|快照存储的sql数量符合预期||
|测试存储的sql是否是和上一次快照之间有变化的sql|创建快照后，增加测试sql，再次执行创建快照|快照存储的sql是和上一次快照之间有变化的sql||
|测试高级包dbms_awr_extra|手动执行高级包后调试观察last snap stat|last snap stat按预期变化||


##   [6. 资料设计章节](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#7-document%E8%B5%84%E6%96%99)  

修改doc/产品文档/开发手册/PL参考手册/内置高级包/DBMS_AWR.md

##   [7. 未来规划](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1.该需求后考虑分布式AWR需求的上车：

dbms_awr_extra.update_sqlstat_last_snap()需要通过cn下发到各个节点，因为不涉及元数据的提交回滚，可以简单通过分布式dml流程增加个cmd实现（参考gv视图实现），向当前所有正常节点下发cmd，过程中发生异常则报错。