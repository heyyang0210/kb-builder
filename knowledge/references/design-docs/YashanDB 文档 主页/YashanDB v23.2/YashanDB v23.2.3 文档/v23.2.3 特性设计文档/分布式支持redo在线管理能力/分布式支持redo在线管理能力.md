Created by 廖增康, last modified on 五月 21, 2024

  [https://pingcode.yasdb.com/pjm/items/66168275fd997db58ad707ab](https://pingcode.yasdb.com/pjm/items/66168275fd997db58ad707ab)    ?    
  #YDBRD-26057 分布式支持redo在线管理能力

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#1-overview%E6%A6%82%E8%BF%B0)  

分布式数据库系统支持直连节点的方式，在线管理redo文件

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持sys用户直接DN/MN节点，增加/删除redo文件.

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
1. 新增redo日志文件:
ALTER DATABASE ADD LOGFILE ('/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840,'/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840);
ALTER DATABASE ADD LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840 BLOCKSIZE 512;
ALTER DATABASE ADD LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840 PARALLEL 4;

2.删除redo日志文件:
ALTER DATABASE DROP LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5';


```

  


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

|  
|功能限制|  
|
|---|---|---|
|1|只允许sys用户直连节点新增/删除日志文件，不执行alter database分布式DDL执行|  
|
|2|DN节点新增/删除redo文件，扩容新dn节点redo文件按默认的redo文件.|直连DN节点新增或者删除redo文件，扩容不迁移，只支持默认redo文件，如果用户需要变更可以直连新扩容DN变更|
|3|CN节点不支持直连支持alter database DDL支持|CN节点可以通过自动清理管理redo和归档日志|


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

分布式支持在线redo管理方式:

        放开分布式数据库系统直连ALTER DATABASE DDL语句  ALTER_DATABASE_ADD_LOGFILE  和  ALTER_DATABASE_DROP_LOGFILE   Action限制。DDL直连执行跟单机执行保持一致。

       增/删redo日志会同步到备节点.

分布式DDL不执行ALTER DATABASE语句执行，ALTER DATABASE只能通过sys用户直连节点执行,分布式执行直连节点执行ALTER DATABASE的语句:

|alter database 语法|语法功能描述|语法执行sql语句|分布式是否支持直连节点操作|支持/不支持原因|扩容是否需要同步 |分布式支持直连操作节点|备注|
|---|---|---|---|---|---|---|---|
|ALTER_DATABASE_STATUS|该语句用于MOUNT和OPEN数据库，以便用户访问|```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> MOUNT<span class="token punctuation" style="color: rgb(204,204,204);">;
</span>
```,```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> <span class="token keyword" style="color: rgb(204,153,205);">OPEN</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```,```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> <span class="token keyword" style="color: rgb(204,153,205);">OPEN</span> UPGRADE<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```,```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> <span class="token keyword" style="color: rgb(204,153,205);">OPEN</span> <span style="color: rgb(44,62,80);">RESETLOGS</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_SWITCHOVER|从备用库切换回主数据库|ALTER DATABASE SWITCHOVER;|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_FAILOVER|当备用库出现故障时，强制切换回主数据库|ALTER DATABASE FAILOVER;|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_SET|  
|ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PERFORMANCE;,ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION;,ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;,ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION FORCE;,ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION TIMEOUT 100;|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_ARCHIVELOG|启用或停止数据库的日志归档模式|ALTER DATABASE ARCHIVELOG;,ALTER DATABASE NOARCHIVELOG;|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_CONVERT|  
|ALTER DATABASE CONVERT TO NORMAL;,ALTER DATABASE CONVERT TO PHYSICAL STANDBY;,ALTER DATABASE CONVERT FILENAME;,```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> <span class="token keyword" style="color: rgb(204,153,205);">CONVERT</span> FILENAME INCLUDING ARCHIVELOG<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_EXIT_UPGRADE|当数据库升级完成之后，可以直接退出升级模式进入正常OPEN模式，无需重启|ALTER DATABASE EXIT UPGRADE;|已经支持|  
|  
|  
|  
|
|ALTER_DATABASE_ADD_LOGFILE|  
|ALTER DATABASE ADD LOGFILE '?/dbfiles/redo5' SIZE 72355840 BLOCKSIZE 512;|需要支持|  
|否|主备会同步操作，在DN/MN主节点执行|  
|
|ALTER_DATABASE_DROP_LOGFILE|  
|ALTER DATABASE DROP LOGFILE '?/dbfiles/redo6';|需要支持|  
|否||  
|
|ALTER_DATABASE_DELETE_ARCHIVELOG|用于对数据库的归档文件进行手动清理，释放磁盘空间|```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> <span class="token keyword" style="color: rgb(204,153,205);">DELETE</span> ARCHIVELOG <span class="token keyword" style="color: rgb(204,153,205);">ALL</span><span class="token punctuation" style="color: rgb(204,204,204);">;
</span>
```,```
<span class="token keyword" style="color: rgb(204,153,205);">ALTER</span> <span class="token keyword" style="color: rgb(204,153,205);">DATABASE</span> <span class="token keyword" style="color: rgb(204,153,205);">DELETE</span> ARCHIVELOG <span class="token keyword" style="color: rgb(204,153,205);">ALL</span> <span class="token keyword" style="color: rgb(204,153,205);">FORCE</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|需要支持|  
|否|归档日志各个节点各自维护，需要直连DN/MN主节点和备节点操作|  
|
|ALTER_DATABASE_ADD_SUPPLEMENTAL|该语句用于配置数据库级别的附加日志|ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;,ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (PRIMARY KEY) COLUMNS;,ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;ALTER DATABASE ADD SUPPLEMENTAL LOG TABLE TYPE (HEAP, TAC);|分布式不支持|分布式数据库支持场景不明确（没有需要支持的场景）|否|  
|  
|
|ALTER_DATABASE_DROP_SUPPLEMENTAL||ALTER DATABASE DROP SUPPLEMENTAL LOG DATA (ALL, PRIMARY KEY) COLUMNS;,ALTER DATABASE DROP SUPPLEMENTAL LOG DATA;,ALTER DATABASE DROP SUPPLEMENTAL LOG TABLE TYPE (LSC);|分布式不支持||否|  
|  
|
|ALTER_DATABASE_DATAFILE_NAME|  
|  
|分布式不支持|  
  提供数据文件丢失或者数据文件损坏情况下的数据库逃生通道,  修改文件操作会影响到分布式DDL执行    
    
|  
|  
|  
|
|ALTER_DATABASE_DATAFILE_STATUS|  
|ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/file' OFFLINE;,ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/file' OFFLINE DROP;|分布式不支持||否|  
|  
|
|ALTER_DATABASE_DATAFILE_AUTOEXTEND|  
|ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/users' AUTOEXTEND OFF;    
  ALTER DATABASE TEMPFILE '/home/yasdb/YASDB_DATA/dbfiles/swap' AUTOEXTEND OFF;,ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/users' AUTOEXTEND ON NEXT 8M MAXSIZE 64M;    
  ALTER DATABASE TEMPFILE '/home/yasdb/YASDB_DATA/dbfiles/swap' AUTOEXTEND ON NEXT 8M MAXSIZE 64M;|分布式不支持||否|  
|  
|
|ALTER_DATABASE_DATAFILE_RESIZE|  
|ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/users' RESIZE 1048576;    
  ALTER DATABASE TEMPFILE '/home/yasdb/YASDB_DATA/dbfiles/temp' RESIZE 1048576;|分布式不支持||否|  
|  
|
|ALTER_DATABASE_DOUBLE_WRITE|该语句用于重新指定双写文件的大小|ALTER DATABASE DOUBLE_WRITE RESIZE FILE 32M;|分布式不支持|各个节点不一致，分布式不支持|否|  
|  
|
|ALTER_DATABASE_STANDBY_RECOVER|该语句用于备库回放操作|ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;,ALTER DATABASE RECOVER MANAGED STANDBY DATABASE;,ALTER DATABASE RECOVER MANAGED STANDBY DATABASE UNTIL SCN 123123123;,ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;    
  ALTER DATABASE RECOVER MANAGED STANDBY DATABASE UNTIL SCN 123123123 DISCONNECT FROM SESSION;|分布式不执行|分布式不支持，节点故障通过组内扩缩容|否|  
|  
|
|ALTER_DATABASE_REGISTER_ARCHIVELOG|该语句用于手动注册归档。,该SQL的功能约束有：,- RESTORE DATABASE后且数据库未open，可以用该SQL手动注册归档。
- 数据库恢复或创建完整后，此操作的对象必须是备库，并且配置参数SANDBOX_STANDBY为TRUE。
- 指定的归档的路径可以为绝对路径，也可以为文件名，使用文件名时默认路径为归档路径（配置参数ARCHIVE_LOCAL_DEST）
,or replace,    如果发现归档已经注册，就替换 原有注册的归档，该操作比较危险，需要谨慎使用。|ALTER DATABASE REGISTER ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC';    
  ALTER DATABASE REGISTER ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC', '/home/yashan/archive/arch_0_2.ARC';    
  ALTER DATABASE REGISTER ARCHIVELOG 'arch_0_1.ARC';    
  ALTER DATABASE REGISTER ARCHIVELOG 'arch_0_1.ARC', 'arch_0_2.ARC';,-- 结合RESTORE DATABASE使用    
  RESTORE DATABASE FROM 'BAK1';    
  ALTER DATABASE REGISTER ARCHIVELOG 'arch_0_1.ARC', 'arch_0_2.ARC';    
  RECOVER DATABASE;    
  ALTER DATABASE OPEN;,  
,--or replace,ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC';    
  ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC', '/home/yashan/archive/arch_0_2.ARC';    
  ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG 'arch_0_1.ARC';    
  ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG 'arch_0_1.ARC', 'arch_0_2.ARC';|分布式不执行| 会改变元数据一致性，分布式不支持|否|  
|  
|




###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

```

--新增redo文件
ALTER DATABASE ADD LOGFILE '?/dbfiles/redo5' SIZE 72355840 BLOCKSIZE 512;
ALTER DATABASE ADD LOGFILE '?/dbfiles/redo6' SIZE 72355840 PARALLEL 4;

--删除redo文件:
ALTER DATABASE DROP LOGFILE '?/dbfiles/redo5';
ALTER DATABASE DROP LOGFILE '?/dbfiles/redo6';



```

##   [7. Document（资料）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#7-document%E8%B5%84%E6%96%99)  

##   [8. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[set_false.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjdhMWFkOWEzMzExZGM5MGYwIiwicmVmX2lkIjoiNjczOTZkNjc1OTNmOTljOWZmMjM3YWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MDE0LCJleHAiOjE3ODIzOTQ0MTR9.Gab0pN-HlQlsm_8cG0g6yg351ycbklQXSrz2UmawwzI)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,会议时间： 2024-04-29  10:00 - 10:30,参与人员： 何金阳，何阳，施新华，廖增康,结论：,          1. 确认DN主节点增删redo文件是否会同步到备节点.,          2. 梳理alter databse sql语句分布式直连不能执行，给出不能支持的原因，已经使用建议，形成类别方式记录。,Posted by liaozengkang at 四月 29, 2024 10:10|
|---|
|  [](null)  ,新增执行节点,Posted by liaozengkang at 五月 09, 2024 16:56|
|  [](null)  ,会议纪要：,会议时间： 2024-05-09  17:00 - 17:30,参与人员： 何金阳，何阳，施新华，廖增康,结论：,          1. 新增alter database 直连执行节点.,          2. 确认之前归档文件删除直连操作不放开原因. – 施新华 （之前不支持是分布式直连没放开）,Posted by liaozengkang at 五月 09, 2024 17:16|
