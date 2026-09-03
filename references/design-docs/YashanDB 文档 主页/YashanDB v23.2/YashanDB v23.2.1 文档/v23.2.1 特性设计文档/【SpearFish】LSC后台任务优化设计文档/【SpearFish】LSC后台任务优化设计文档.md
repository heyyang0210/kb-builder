Created by 李子怡, last modified on 一月 19, 2024

SR链接：    [YDBRD-20468](https://jira.yasdb.com/browse/YDBRD-20468?src=confmacro)    -  LSC后台任务优化  待RMT评审

IR链接：    [YDBRD-22905](https://jira.yasdb.com/browse/YDBRD-22905?src=confmacro)    -  LSC后台任务执行控制  完成    [YDBRD-21599](https://jira.yasdb.com/browse/YDBRD-21599?src=confmacro)    -  LSC后台任务优化  设计中

              

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

当LSC后台任务与前台业务并发执行时，后台任务会消耗占用cpu，内存等资源影响前台任务的执行性能，

**现有场景，当前措施及优化点**

|场景|当前措施|优化点|
|:---|:---|:---|
|后台任务与bulkload导入并发时，导入速度下降（    [YDBRD-19868](https://jira.yasdb.com/browse/YDBRD-19868)    ）|1.关闭后台任务   ALTER SYSTEM SET DATA_TRANSFORMER_ENABLED = FALSE ,2.导入数据,3.开启后台任务   ALTER SYSTEM SET DATA_TRANSFORMER_ENABLED = TRUE,避免了后台compact与bulkload导入的并发。|自动打断后台任务，待导入结束后再自动恢复。|
|后台任务与DDL并发|ddlPreLock的时候后台任务暂停，DDL上排它锁，ddlPostLock的时候后台任务恢复|  
|
|后台任务与DML并发|只打断有冲突的slice: ankCancelHandler|1.时间控制,控制  后台任务的开始时间和结束时间，将DML与后台任务执行时间错开。,2.资源控制,减少后台任务。|
|后台任务与查询语句并发|后台任务不会被打断  。|1.资源控制,减少后台任务的内存占用。,2.时间控制,控制  后台任务的开始时间和结束时间，  避免后台任务与业务查询高峰重叠  。|
|后台任务合并的时机|删除达到一半后台考虑合并|通过空闲率和空洞所占百分比优化当前合并策略|


需要可以查询某个时间段内发生的XFMR，包含起止时间，内存消耗，读写数据量大小，因此需要对现有的系统表进行完善。

需要支持时间控制、资源控制来加强对后台任务的管理，从而有效避免前后台业务冲突，方便定位与处理性能问题。

  


部署模式限制：

- 特性支持的部署形态为 单机, 分布式。


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=107384763#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 在执行bulkload导入任务的时候，自动打断后台任务，导入完成后，后台任务自动恢复。（补充正在做的insert /*+bulkload*/场景，也进行自动打断和恢复）
1. 将xfmr的submit模式调整为WORKER_SUBMIT_REBALANCE，用于优化使用线程资源。
1. 支持合并策略，将删除达到一半才合并的约束优化，调整为可根据需要调整空闲率约束和空洞所占百分比进行合并。
1. 时间管理，通过dbms_job的方式设置定时任务，  定时开启/关闭后台任务。
1. 后台任务可观察，方便性能定位，  XFMR_HIS$系统表加入START_TIME，END_TIME，MAX_MEM_COST，READ_SIZE, WRITE_SIZE，SWAP_SIZE 用于可以查询某个时间段内发生的XFMR，包含起止时间，内存消耗，读写数据量大小。  补充相关动态视图，方便查看当前后台任务状态，以及是否为强制执行。


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#3-interfaces%E6%8E%A5%E5%8F%A3)  

**1.SQL语法，必须给出EBNF。禁止描述不存在的分支。**

**2.与数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出设计说明**

系统表字段有少量变化

|系统表|内容说明|
|:---|:---|
|TABXFMR$|新增字段CREATE_TIME, 记录产生后台任务的时间|
|XFMR_HIS$|新增字段CREATE_TIME, 记录后台任务创建的时间|
|  
|新增字段START_TIME, 记录后台任务开始执行的时间|
|  
|新增字段END_TIME, 记录后台任务结束执行的时间|
|  
|新增字段MAX_MEM_COST, 记录后台任务内存消耗|
|  
|新增字段READ_SIZE信息， 记录后台任务读取的大小|
|  
|新增字段WRITE_SIZE信息，记录后台任务写数据的大小|
|  
|新增字段SWAP_SIZE信息，记录swap数据的大小|


系统表新增字段详细说明：

#####   [TABXFMR$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)  

|字段|数据类型|说明|
|:---|:---|:---|
|CREATE_TIME|DATE|后台任务创建时间|


#####   [XFMR_HIS$](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#materialized-view)  

|字段|数据类型|说明|
|:---|:---|:---|
|CREATE_TIME|DATE|后台任务创建时间（单位s）|
|START_TIME|DATE|后台任务开始时间（单位s）|
|END_TIME|DATE|后台任务结束时间（单位s）|
|MAX_MEM_COST|BINARY_BIGINT|后台任务最大内存开销|
|READ_SIZE|BINARY_BIGINT|后台任务读取数据的大小|
|WRITE_SIZE|BINARY_BIGINT|后台任务写入数据的大小|
|SWAP_SIZE|BINARY_BIGINT|记录swap数据的大小|


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#51-architecture%E6%9E%B6%E6%9E%84)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

#### 时间控制：定时开启/关闭后台任务

1.dbms_job的方式, 分布式需要对接OM。

创建定时任务，START_XFMR_JOB，每天1点开启后台转换任务开关。

创建定时任务，END_XFMR_JOB，每天6点关闭后台转换任务开关。

内置定时任务START_XFMR_JOB，默认每日凌晨1:00打开后台转换任务开关。用户可以通过DBMS_SCHEDULER高级包维护该定时任务。

#### 业务控制1：当发现存在bulkload导入任务的时候，主动打断已有的后台任务

1.优先级控制，优先bulkload（实现复杂，暂不使用）。

2.如果有bulkload任务，主动打断, bulkload结束后恢复。

3.补充正在做的insert /*+bulkload*/场景。

![](https://pingcode.yasdb.com/atlas/files/public/67396c618970c2af4f520ba4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBUUFRQUFBQUFBQUFDQUFBQUFBQUFBQUFBUUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFCQUtFQUFBQUFCQVFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1MDUsImV4cCI6MTc4MjMxMTMwNX0.KlXh-JNN_ftppLC3sx2YSimeCcxeKnyWbgpTq3isrEk)

#### 业务控制2：支持合并策略

当前     [Slice Compact](https://conf.yasdb.com/pages/viewpage.action?pageId=104233133)    ，删除达到一半才合并，考虑到可能存在slice比较大，删除并未达到一半，但急需合并释放空间的场景，考虑在配置文件中添加配置项SCOL_  COMPACT_PRECENT, SCOL_EMPTY_PRECENT进行控制。

SCOL_COMPACT_PRECENT 表示：小slice的百分比，即 rowCount / scolSliceRows 取值范围为 [0,100], 默认50;

SCOL_EMPTY_PRECENT 表示：空洞率，即 1- rowCount/meta→rowCnt 取值范围为 [0,100], 默认1; 

洞超过scol_empty_precent考虑compact行为，是否compact依赖scol_compact_precent

![](https://pingcode.yasdb.com/atlas/files/public/67396c618970c2af4f520ba5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBUUFRQUFBQUFBQUFDQUFBQUFBQUFBQUFBUUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFCQUtFQUFBQUFCQVFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1MDUsImV4cCI6MTc4MjMxMTMwNX0.KlXh-JNN_ftppLC3sx2YSimeCcxeKnyWbgpTq3isrEk)

  


####   
  资源控制：

当前：后台任务的submit 模式为  **WORKER_SUBMIT_CREATE**  ， workpool在分配worker的时候，只要worker没有达到_DATA_TRANSFORMER_WORKERS，都会新增worker, 并创建线程，线程数越来越多，直到shutdown的时候，才会进行清理。

           运行后，线程一旦创建，_DATA_TRANSFORMER_WORKERS 调小，并不会进行清理。

优化：

           新增submit模式  **WORKER_SUBMIT_REBALANCE,  **  有任务提交的时候，检查最近一段时间worker是否空闲，如果空闲，则进行线程销毁。

           常驻线程：XFMR, 按需启动。

动态扩展收缩的线程：  **DATA_TRANSFORMER_MAX_WORKERS**   取值范围[1,256], 默认值32。  **（非隐藏参数）   **

           可在线调整DATA_TRANSFORMER_MAX_WORKERS的值。

```
select * from v$parameter where name ='DATA_TRANSFORMER_MAX_WORKERS';
alter system set DATA_TRANSFORMER_MAX_WORKERS = 64;
alter system set DATA_TRANSFORMER_MAX_WORKERS = 16;


```

  


手动：当执行alter system set   DATA_TRANSFORMER_MAX_WORKERS   = target; 的时候，workPool按照要求进行扩缩。

自动：当wPoolSubmit 的时候，判断workPool中是否有worker空闲，如果空闲，则进行线程销毁。

|当前worker数：workCount|当前最大值：maxWorkers|目标最大值：target|行为|
|---|---|---|---|
|8|16|无|maxWorkers不变，wPoolSubmit的时候按需自动选择reuse/create worker/decrease worker |
|8|16|32 (target>maxWorkers)|手动扩线程，修改maxWorkers为target|
|8|8|32|手动扩线程，修改maxWorkers为target,  pool→isWorkerFull: true 调整为 false|
|8 |16|10 (target<maxWorkers)|手动缩线程，修改maxWorkers为target|
|8|8|5|手动缩线程，修改maxWorkers为target，STOP target-workerCount个线程|
|8|16|5|手动缩线程，修改maxWorkers为target，STOP target-workerCount个线程，pool→isWorkerFull: false 调整为 true|


规则1：有target值，pool→attr.maxWorkers 就要设置为target， target取值范围即为  **DATA_TRANSFORMER_MAX_WORKERS**   取值范围

规则2：workerCount > target 需要收缩线程，且需要收缩的线程数确定为（target-workerCount）。

规则3：自动缩线程时，需要收缩的线程数不确定，线程id由大到小开始判断， 线程可以收缩的标准为  **worker→runningTask =NULL， **  **worker**  **>**  **queue**  **->**  **count =0 **  **且 当前时间与worker->lastTaskEndTime的差值大于15分钟（**  **15 * COD_US_1M）**  **。**

  


**新增接口：wPoolModifyMaxWorkers**    调整maxWorkers的值，并通过判断target和workerCount的大小关系，判断是否需要手动收缩。

![](https://pingcode.yasdb.com/atlas/files/public/67396c618970c2af4f520ba7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBUUFRQUFBQUFBQUFDQUFBQUFBQUFBQUFBUUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFCQUtFQUFBQUFCQVFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1MDUsImV4cCI6MTc4MjMxMTMwNX0.KlXh-JNN_ftppLC3sx2YSimeCcxeKnyWbgpTq3isrEk)

内部函数：idlewPoolDecrese用于控制其收缩行为，target为要收缩到的目标值，从大到小进行收缩。

**空闲判断：worker→runningTask =NULL， **  **worker**  **>**  **queue**  **->**  **count =0**  ** 且 当前时间与worker->lastTaskEndTime的差值大于15分钟。**

![](https://pingcode.yasdb.com/atlas/files/public/67396c61a1ad9a3311dc8a14/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBUUFRQUFBQUFBQUFDQUFBQUFBQUFBQUFBUUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFCQUtFQUFBQUFCQVFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1MDUsImV4cCI6MTc4MjMxMTMwNX0.KlXh-JNN_ftppLC3sx2YSimeCcxeKnyWbgpTq3isrEk)

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

有系统表字段新增，其他旧版本使用需要走升级脚本。

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#54-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#55-%E5%85%B6%E4%BB%96)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测基础场景：

正常场景：

（1）基本语法、系统表和系统视图验证

（2）升级

并发场景：

（1）后台任务和bulkload并行

（1）后台任务和dml并行执行

（2）后台任务和ddl并行执行

（3）后台任务和查询并行执行

异常场景：

 （1）各种异常场景，资源不足等

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

####   [大纲：](https://conf.yasdb.com/pages/viewpage.action?pageId=133567101#%E5%A4%A7%E7%BA%B2)  

  [后台任务管理调研 - 谢锐 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133569390)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=122074149#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments:

[image2023-12-20_15-11-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWZhMWFkOWEzMzExZGM4OWY1IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.M9lhqoua6h_Jt7bwHdyUulW1O0o2Oieu6IsOLDW3c1E)

 (image/png)    


[image2023-12-15_18-34-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWZhMWFkOWEzMzExZGM4OWY5IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.7c_EH4cda4VWRyZznrsb1TjG69ItPEx9E1urH52o43M)

 (image/png)    


[image2023-12-15_18-1-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWY4OTcwYzJhZjRmNTIwYjhhIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.v3-WMvpPh1_UacqwOVGuGaV1ktdFnoEE9LaCp9pqLwo)

 (image/png)    


[image2023-11-27_9-55-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4OWZjIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.45aYgMMR51DxYmCN2LFs8USVV5RujHhMou_HnWWEyjw)

 (image/png)    


[image2023-11-24_11-25-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjhkIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.QulNg6MjTcMLQp17YzLavsUx-yTSoKvbKB2EL9aRM5c)

 (image/png)    


[image2023-11-21_22-3-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4OWZkIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.U8u0BrT1jX3rVSXNrn6ZKYZ0Uat2NFZYFFazf_oLt4o)

 (image/png)    


[image2023-11-20_18-54-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjhmIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.Rfh-iPHVPROXktCMYOAO7S-v35fMAIjvtuk510BFv4o)

 (image/png)    


[image2023-11-20_18-53-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjkwIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.dYUX7sEzDsrFVPupnoyeoGW8Ha1VYhlDxdhUgCoyze4)

 (image/png)    


[image2023-11-17_18-38-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4YTAwIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9._ihi9zA0ma5RqeBtpp3QAkywnuiaWtiPhyKvY2sdHyM)

 (image/png)    


[image2023-11-17_18-37-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjkyIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.9XIGVxUGGGQ1g1o3fPkqkI26j7IfrIMxvPbKytFBaqY)

 (image/png)    


[image2023-11-17_18-26-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjk0IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.FsUB0KNWPVgrOAqw7fW9JfZ3AEYbfS1bxwbi7sYHSIs)

 (image/png)    


[image2023-11-15_14-46-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjk1IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.OIj2JkoXQaNcN3paSBaNoHAD-DtEPUf79JSV3-virH0)

 (image/png)    


[image2023-11-15_14-16-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4YTAzIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.AmOoM7mYZHlHh7-ojj1W2YclvIAlZU2hvwFrKBuGL2s)

 (image/png)    


[image2023-11-15_12-14-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4YTA1IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.66Ys_NYHur4NsnPhBLFSuvw52ZlL93iG_ex2i4seYCw)

 (image/png)    


[image2023-11-15_12-13-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4YTA2IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.UiGlWcQjoOIywkbNXvBpjPEQR05ovyEgT9UO8DYQR64)

 (image/png)    


[image2023-11-14_16-31-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjk4IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.WyFl2qPICGZB2l_Cn3LG4jxSwQ3nQI1l9AwOtB8N-OI)

 (image/png)    


[image2023-11-14_16-9-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjlhIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.GRkdSVOxbu1RUwtDPppftQKGHZ3Ndl8XxHcnzHt2k-Q)

 (image/png)    


[image2023-11-14_16-4-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjBhMWFkOWEzMzExZGM4YTA3IiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.JHmE2bOpHqVpDAm7LIYT29qW5VsLvlMtQDF5QTbc6ZE)

 (image/png)    


[image2023-11-13_15-35-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjlkIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.guYQ8Vmli3-BdmmTitrpXHdzwj2sGWbEIAy2hHtK7A4)

 (image/png)    


[image2023-11-9_11-58-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjllIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.dPGjK15XDc2iDL7BaKzz4FQInaETutjRghFtjAtZqyQ)

 (image/png)    


[image2023-11-8_12-5-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjA4OTcwYzJhZjRmNTIwYjlmIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.ghsa27HShUkrezmCNDIwDBsovDPOBwiNlmPKMtXRQI4)

 (image/png)    


[image2023-11-7_12-30-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjE4OTcwYzJhZjRmNTIwYmEwIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.adKakyQHziBcVdAWgbDs5dRFLLZNlvikEDQ6HGopkQM)

 (image/png)    


[image2023-10-31_13-3-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjFhMWFkOWEzMzExZGM4YTBmIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.JO_Nar7p3R6ANjss9TnAERrkjx1exX0h-uyBxhhZdwA)

 (image/png)    


[image2023-10-31_11-5-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjFhMWFkOWEzMzExZGM4YTEwIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.QZ2yM1pmpJxFqbGQqBn31-lwQTwibv1uhGOHedxV8Ls)

 (image/png)    


[image2023-10-30_14-13-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjE4OTcwYzJhZjRmNTIwYmEyIiwicmVmX2lkIjoiNjczOTZjNWY3MjgyMDZlZmI5MmYxMTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTA1LCJleHAiOjE3ODIzODY5MDV9.R0yFOqWQ6UPklluhwItTnSK21jk4pqVGxYAVfWiS7Pc)

 (image/png)    
