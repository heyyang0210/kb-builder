Created by 王林, last modified on 四月 25, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

审计是维护数据库安全的一个必不可少的功能。通过配置不同的审计项，针对指定用户的指定行为进行审计记录，达到能够方便快捷查询指定用户操作的具体内容，维护数据库的安全性。

对于不再需要保留的审计记录，提供了高级包 DBMS_AUDIT_MGMT来进行处理，通过创建定时任务，周期性删除指定时间段之前的数据。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

    数据库运维需求，创建审计清理定时任务，需要支持删除申请清理定时任务的功能。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**Oracle数据库**

    Oracle提供了高级包 DBMS_AUDIT_MGMT来管理审计记录。该高级包主要功能如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396cdca1ad9a3311dc8d32/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQwMjUsImV4cCI6MTc4MjMxNDgyNX0.WFCUz-Tjt_yeG-MiK9K6ROI5PKH8a_CsiFMUqhYS1e0)

Oracle 审计清理内容，参见：    [Oracle 审计记录清理](https://conf.yasdb.com/pages/viewpage.action?pageId=91758651)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

通过高级包的存储过程的形式，支持DROP_PURGE_JOB子存储过程。

**语法**

DBMS_AUDIT_MGMT.DROP_PURGE_JOB(

    audit_trail_purge_name IN VARCHAR2) ;

**参数**

|参数|描述|
|---|---|
|audit_trail_purge_name|审计清理定时任务名称，通过视图   DBA_AUDIT_MGMT_CLEANUP_JOBS 可以查看已存在的审计清理定时任务。|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|--|  
|  
|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

### 2.1 SQL语法

无

### 2.2 函数

无

### 2.3 高级包

  


|SET_LAST_ARCHIVE_TIMESTAMP|存储过程|```
 DBMS_AUDIT_MGMT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SET_LAST_ARCHIVE_TIMESTAMP<span class="token punctuation" style="color: rgb(204,204,204);">(</span>
    audit_trail_type <span class="token keyword" style="color: rgb(204,153,205);">IN</span> INTEGER<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
    last_archive_time <span class="token keyword" style="color: rgb(204,153,205);">IN</span> <span class="token keyword" style="color: rgb(204,153,205);">TIMESTAMP</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|设置清理时间点，成功设置的清理时间点可以在  DBA_AUDIT_MGMT_CLEANUP_JOBS   视图中查询。,  
|
|:---|:---|:---|:---|


|接口|函数/存储过程|接口说明|接口表现|
|---|---|---|---|
|DROP_PURGE_JOB|存储过程|DBMS_AUDIT_MGMT.DROP_PURGE_JOB,(audit_trail_purge_name IN VARCHAR2) ;|删除审计清理定时任务|


### 2.4 系统视图

视图DBA_AUDIT_MGMT_CLEANUP_JOBS显示存在的审计清理定时任务，当前只允许有1个审计清理定时任务。

```
SQL> desc DBA_AUDIT_MGMT_CLEANUP_JOBS
NAME                                                             NULL?     DATATYPE                          
---------------------------------------------------------------- --------- --------------------------------- 
OWNER                                                            NOT NULL  VARCHAR(64)                       
JOB_NAME                                                         NOT NULL  VARCHAR(64)                       
JOB_SUBNAME                                                                VARCHAR(64)                       
JOB_STYLE                                                                  CHAR(7)                           
JOB_CREATOR                                                      NOT NULL  VARCHAR(64)                       
CLIENT_ID                                                                  VARCHAR(64)                       
PROGRAM_OWNER                                                              VARCHAR(4000)                     
PROGRAM_NAME                                                               VARCHAR(4000)                     
JOB_TYPE                                                                   VARCHAR(16)                       
JOB_ACTION                                                                 VARCHAR(4000)                     
NUMBER_OF_ARGUMENTS                                                        INTEGER                           
SCHEDULE_OWNER                                                             VARCHAR(4000)                     
SCHEDULE_NAME                                                              VARCHAR(4000)                     
SCHEDULE_TYPE                                                              CHAR(5)                           
START_DATE                                                                 TIMESTAMP                         
REPEAT_INTERVAL                                                            VARCHAR(4000)                     
END_DATE                                                                   TIMESTAMP                         
ENABLED                                                          NOT NULL  BOOLEAN                           
AUTO_DROP                                                                  VARCHAR(5)                        
STATE                                                                      VARCHAR(9)                        
RUN_COUNT                                                                  INTEGER                           
MAX_RUNS                                                                   INTEGER                           
FAILURE_COUNT                                                              INTEGER                           
MAX_FAILURES                                                               INTEGER                           
RETRY_COUNT                                                                INTEGER                           
LAST_START_DATE                                                            TIMESTAMP                         
LAST_RUN_DURATION                                                          INTERVAL DAY(9) TO SECOND(6)      
NEXT_RUN_DATE                                                              TIMESTAMP                         
MAX_RUN_DURATION                                                           INTERVAL DAY(3) TO SECOND(0)      
COMMENTS                                                                   VARCHAR(4000)   

而oracle 为

SQL> desc DBA_AUDIT_MGMT_CLEANUP_JOBS
 名称                                      是否为空? 类型
 ----------------------------------------- -------- ----------------------------
 JOB_NAME                                  NOT NULL VARCHAR2(128)
 JOB_STATUS                                         VARCHAR2(8)
 AUDIT_TRAIL                                        VARCHAR2(28)
 JOB_FREQUENCY                                      VARCHAR2(100)
 USE_LAST_ARCHIVE_TIMESTAMP                         VARCHAR2(3)
 JOB_CONTAINER                                      VARCHAR2(7)
见 https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_AUDIT_MGMT_CLEANUP_JOBS.html
```

  


### 2.5 动态视图

无

  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

略

  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

### 4.1 功能点

通过DBMS_AUDIT_MGMT.DROP_PURGE_JOB 删除审计清理定时任务。内部通过 DBMS_SCHEDULER.DROP_JOB 来实现。

  


### 4.2 特性性能点

  


### 4.3 特性可维可测设计

  


### 4.4 特性安全设计

  


##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

略

  


## #6 参考

  [审计概要设计](/pages/createpage.action?spaceKey=YAS&title=%E5%AE%A1%E8%AE%A1%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1)  

  [审计详细设计](/pages/createpage.action?spaceKey=YAS&title=%E5%AE%A1%E8%AE%A1%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  [审计日志清理](/pages/createpage.action?spaceKey=YAS&title=%E5%AE%A1%E8%AE%A1%E6%97%A5%E5%BF%97%E6%B8%85%E7%90%86)  

  


  


  


  


  


  


  


  


  


  


## Attachments: