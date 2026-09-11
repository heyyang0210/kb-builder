Created by 施新华, last modified on 五月 22, 2024

# 1. 概述

     分布式部署模式下，直连节点alter database 部分命令当前拦截，不利于实际应用中维护使用，因此支持部分功能放开。

# 2. 需求分析

  [https://pingcode.yasdb.com/pjm/items/66168275fd997db58ad707ab](https://pingcode.yasdb.com/pjm/items/66168275fd997db58ad707ab)    ?    
  #YDBRD-26057 分布式支持redo在线管理能力

参考：    [分布式支持redo在线管理能力](150632082.html)  

## 2.1 功能点分析

### 2.1.1 分布式部署模式下alter database支持概述

|alter database 语法|  
|语法功能描述|语法执行sql语句|分布式是否支持|
|---|---|---|---|---|
|**ALTER DATABASE startup**|ALTER DATABASE MOUNT|启动数据库到MOUNT|ALTER DATABASE MOUNT;|已支持|
||ALTER DATABASE OPEN|启动数据库到OPEN状态|ALTER DATABASE OPEN [READWRITE];,ALTER DATABASE OPEN UPGRADE;,ALTER DATABASE OPEN RESETLOGS;|已支持|
|**ALTER DATABASE database file**|ALTER DATABASE DATAFILE|用于对数据库的数据文件进行自动扩展的开关控制、大小指定等。此操作需要数据库处于OPEN状态。 在设置数据文件自动扩展或RESIZE数据文件时，对于TEMP表空间和SWAP表空间的数据文件使用tempfile选项，其它表空间的数据文件使用datafile选项|ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/users' AUTOEXTEND OFF;,ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/users' AUTOEXTEND ON NEXT 8M MAXSIZE 64M;    
  ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/users' RESIZE 1048576;,ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/file' OFFLINE;,--非归档模式下只能用如下语句offline    
  ALTER DATABASE DATAFILE '/home/yasdb/YASDB_DATA/dbfiles/file' OFFLINE DROP;|**分布式不支持(CN、MN,DN已拦截)**|
||ALTER DATABASE TEMPFILE||ALTER DATABASE TEMPFILE '/home/yasdb/YASDB_DATA/dbfiles/swap' AUTOEXTEND OFF;,ALTER DATABASE TEMPFILE '/home/yasdb/YASDB_DATA/dbfiles/swap' AUTOEXTEND ON NEXT 8M MAXSIZE 64M;,ALTER DATABASE TEMPFILE '/home/yasdb/YASDB_DATA/dbfiles/temp' RESIZE 1048576;|**分布式不支持(CN、MN,DN已拦截)**|
||ALTER DATABASE CONVERT FILENAME|当数据库整库迁移到其它目录后，该语法可用于将数据库记录在控制文件中的路径进行转换，从而使数据库继续正常启动、运行。该语句仅在实例处于NOMOUNT阶段时使用。|ALTER DATABASE CONVERT FILENAME;,--包含归档日志的路径转换使用如下语句    
  ALTER DATABASE CONVERT FILENAME INCLUDING ARCHIVELOG;|已支持|
|**ALTER DATBASE logfile**    
    
,  
|ALTER DATBASE ARCHIVELOG|启用数据库的日志归档模式，此操作需要数据库实例处于MOUNT状态|ALTER DATABASE ARCHIVELOG;    
    
|已支持|
||ALTER DATBASE NO  ARCHIVELOG|停止数据库的日志归档模式，此操作需要数据库实例处于MOUNT状态|ALTER DATABASE NOARCHIVELOG;|已支持|
||ALTER DATBASE SET STANDBY DATABASE TO |指定备库的保护模式，缺省值为MAXIMIZE PERFORMANCE。其中，设置为MAXIMIZE PROTECTION的前提主库的日志已经同步到备库，否则会报错。FORCE表示强制设置，忽略报错。TIMEOUT表示在设置最大保护模式时，等待备库同步的时间，超过该时间将报错，单位为秒，可省略，默认为10s。,- MAXIMIZE PERFORMANCE：主库事务提交不需要等待备库收到日志，保证了主数据库的可用性及性能，但是主库宕机后，可能丢失数据。
- MAXIMIZE PROTECTION：备库的数据保护优先于主库的可用性，主库的日志在同步备库上落盘之后，事务才能提交，在同步备库故障的情况下，主库会在一段时间后变为只读模式。注：如果COMMIT_WAIT参数设为NOWAIT，主库事务提交不会等待备库收到日志
- MAXIMIZE AVAILABILITY：同步备库正常时，主库的日志在同步备库上落盘之后，事务才能提交，同步备库故障时，事务提交也不会阻塞，保证数据库可用。注：如果COMMIT_WAIT参数设为NOWAIT，主库事务提交不会等待备库收到日志
|ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PERFORMANCE;    
    
  ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION;    
    
  ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;    
    
  ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION FORCE;,ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION TIMEOUT 100;|已支持|
||ALTER DATBASE ADD LOGFILE|为数据库增加新的redo日志，同时增加多个文件以','隔开。此操作需要数据库处于OPEN状态。|ALTER DATABASE ADD LOGFILE ('/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840,'/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840);    
  ALTER DATABASE ADD LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840 BLOCKSIZE 512;    
  ALTER DATABASE ADD LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840 PARALLEL 4;|**本需求支持**|
||ALTER DATBASE DROP LOGFILE|删除一个已存在的redo日志，对于正在使用中的redo日志则不被允许删除。此操作需要数据库处于OPEN状态。|ALTER DATABASE DROP LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5';|**本需求支持**|
|ALTER DATABASE standby database    
    
    
    
|ALTER DATABASE CONVERT TO PHYSICAL STANDBY|从主数据库切换为备数据库。,- 数据库的角色必须是PRIMARY。
- 执行实例必须处于MOUNT状态。
|ALTER DATABASE CONVERT TO PHYSICAL STANDBY;|已支持|
||ALTER DATABASE SWITCHOVER|从备库切换回主数据库。|ALTER DATABASE SWITCHOVER;|已支持|
||ALTER DATABASE FAILOVER|当主库出现故障不能恢复时，将备库强制切换为主数据库。,- 数据库的角色必须是STANDBY。
- 执行实例必须处于OPEN状态。
- 数据库与主数据库的连接必须是断开的，可以查看视图V$REPLICATION_STATUS查看主备的连接情况。
|ALTER DATABASE FAILOVER;|已支持|
||ALTER DATABASE RECOVER MANAGED STANDBY DATABASE|在备库并且为Open状态下执行的SQL语句，该语句的作用为启动备库回放，如需退出，需要执行取消回放SQL语句，系统中断线程退出。|--启动备库回放    
  ALTER DATABASE RECOVER MANAGED STANDBY DATABASE;,--停止当前回放操作    
  ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;,--启动备库回放，回放到指定到SCN时主动退出    
  ALTER DATABASE RECOVER MANAGED STANDBY DATABASE UNTIL SCN 123123123;,--在后台执行回放，当前会话可执行其他业务    
  ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;    
  ALTER DATABASE RECOVER MANAGED STANDBY DATABASE UNTIL SCN 123123123 DISCONNECT FROM SESSION;|**分布式不支持(CN、MN,DN已拦截)**|
||ALTER DATABASE (OR REPLACE) REGISTER ARCHIVELOG |用于手动注册归档。该SQL的功能约束有：,- RESTORE DATABASE后且数据库未open，可以用该SQL手动注册归档。
- 数据库恢复或创建完整后，此操作的对象必须是备库，并且配置参数SANDBOX_STANDBY为TRUE。
- 指定的归档的路径可以为绝对路径，也可以为文件名，使用文件名时默认路径为归档路径（配置参数ARCHIVE_LOCAL_DEST）。
|ALTER DATABASE REGISTER ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC';    
  ALTER DATABASE REGISTER ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC', '/home/yashan/archive/arch_0_2.ARC';    
  ALTER DATABASE REGISTER ARCHIVELOG 'arch_0_1.ARC';    
  ALTER DATABASE REGISTER ARCHIVELOG 'arch_0_1.ARC', 'arch_0_2.ARC';,-- 结合RESTORE DATABASE使用    
  RESTORE DATABASE FROM 'BAK1';    
  ALTER DATABASE REGISTER ARCHIVELOG 'arch_0_1.ARC', 'arch_0_2.ARC';    
  RECOVER DATABASE;    
  ALTER DATABASE OPEN;,--or replace,   发现归档已经注册，就替换原有注册的归档，该操作比较危险，需要谨慎使用,ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC';    
  ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG '/home/yashan/archive/arch_0_1.ARC', '/home/yashan/archive/arch_0_2.ARC';    
  ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG 'arch_0_1.ARC';    
  ALTER DATABASE REGISTER OR REPLACE ARCHIVELOG 'arch_0_1.ARC', 'arch_0_2.ARC';|**分布式不支持(CN、MN,DN已拦截)**|
|ALTER DATABASE upgrade|ALTER DATABASE EXIT UPGRADE|当数据库升级完成之后，可以直接退出升级模式进入正常OPEN模式，无需重启|ALTER DATABASE EXIT UPGRADE;|已支持|
|ALTER DATABSE repair|ALTER DATABASE CONVERT TO NORMAL|当数据库出现故障时，数据库被设为只读，数据库为故障状态，DBA修复之后，可以通过本语句将数据库手动切换为正常模式。|ALTER DATABASE CONVERT TO NORMAL;|已支持(DN,MN支持，CN拦截)|
|ALTER DATABSE delete archivelog|ALTER DATABSE DELETE ARCHIVELOG|该语句用于对数据库的归档文件进行手动清理，释放磁盘空间;手动清理归档日志的筛选条件由ARCH_CLEAN_IGNORE_MODE参数决定。|--清理掉满足清理条件的所有归档    
  ALTER DATABASE DELETE ARCHIVELOG ALL;,--清理指定序列号之前满足清理条件的归档    
  ALTER DATABASE DELETE ARCHIVELOG UNTIL SEQUENCE 5;,--清理指定时间之前生成的并且满足清理条件的归档。    
  ALTER DATABASE DELETE ARCHIVELOG UNTIL TIME TO_DATE('2022-06-01 18:00:00', 'yyyy-mm-dd hh24:mi:ss');,--清理指定SCN之前生成的并且满足清理条件的归档    
  ALTER DATABASE DELETE ARCHIVELOG UNTIL SCN 123123123;,--强制归档清理    
  ALTER DATABASE DELETE ARCHIVELOG ALL FORCE;    
  ALTER DATABASE DELETE ARCHIVELOG UNTIL SEQUENCE 5 FORCE;    
  ALTER DATABASE DELETE ARCHIVELOG UNTIL TIME TO_DATE('2022-06-01 18:00:00', 'yyyy-mm-dd hh24:mi:ss') FORCE;|**本需求支持**|
|ALTER DATABASE double write fie|ALTER DATABASE DOUBLE_WRITE|用于重新指定双写文件的大小|ALTER DATABASE DOUBLE_WRITE RESIZE FILE 32M;|**分布式不支持(CN/MN/DN已拦截)**|
|ALTER DATABASE supplemental log |ALTER DATABASE SUPPLEMENTAL LOG DATA|用于配置数据库级别的附加日志。,开启附加日志后，数据库将在redo里额外记录一些数据，这些数据包括DDL的原始SQL文本，update，delete时用于定位行位置的索引信息等。 结合附加日志，可以通过redo解析还原出对应的DDL，DML语句，通常用于异构数据库同步。,数据库级别的附加日志对选定类型的所有用户表生效，可以通过动态视图    [V$DATABASE](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$DATABASE)    查看数据库级别的附加日志生效状态。,SUPPLEMENTAL LOG DATA表示最小附加日志，这种模式下redo里会额外记录DDL文本和DML的rowid，性能影响最小。|--开启最小附加日志    
  ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;,--开启PRIMARY KEY模式的附加日志    
  ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (PRIMARY KEY) COLUMNS;,--开启ALL模式的附加日志    
  ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;,--关闭ALL模式和PRIMARY KEY模式的附加日志    
  ALTER DATABASE DROP SUPPLEMENTAL LOG DATA (ALL, PRIMARY KEY) COLUMNS;,--关闭最小附加日志    
  ALTER DATABASE DROP SUPPLEMENTAL LOG DATA;|**分布式不支持(CN/MN/DN已拦截)**|
||ALTER DATABASE SUPPLEMENTAL LOG TABLE TYPE|设置数据库级别的DML附加日志对哪些类型的用户表生效。默认为空，在开启附加日志后，请同时设置需要生效的表类型|--设置数据库级附加日志对HEAP和TAC类型的表生效    
  ALTER DATABASE ADD SUPPLEMENTAL LOG TABLE TYPE (HEAP, TAC);,--设置数据库级附加日志对LSC表不生效    
  ALTER DATABASE DROP SUPPLEMENTAL LOG TABLE TYPE (LSC);|**分布式不支持(CN/MN/DN已拦截)**|


### 2.1.2 分布式部署本次实现功能

### 2.1.2.1 在线修改LOGFILE

分布式数据库系统支持直连节点的方式，在线管理redo文件，sys用户直接DN/MN/CN节点，增加/删除redo文件。

此操作数据库需要处于OPEN状态，并且具备读写权限。

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396cf98970c2af4f520f7b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFDQUFBQUlBQUFBQUFBQUFDQUFBQUFBQUFBQUFBRUVBZ0FBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFDQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUwMjQsImV4cCI6MTc4MjMxNTgyNH0.dtzeeHQfE3_ZOzhhGsE3-GcXux1GqzY9Jb2j2rh4fYw)

参数说明：

**SIZE**  ：指新增redo日志文件大小。

**BLOCKSIZE**  ：指redo日志文件的块大小，默认为4096，可手动指定为512的整数。redo日志实际创建的文件大小是BLOCKSIZE的整数倍，若指定大小不是整数倍，则实际创建大小向上取整。

**PARALLEL**  ：指定创建redo日志文件的并行度，取值范围为1到8。不指定时系统根据文件大小自适应并行度，例如文件不超过1G时的并行度为1，文件超过128G时的并行度为8，文件大小在1G到128G之间时的并行度为4。

注：redo日志文件大小的最小值受DB_BLOCK_SIZE，MAX_SESSIONS和REDO_BUFFER_SIZE三个参数的影响（最小值参考公式：DB_BLOCK_SIZE * MAX_SESSIONS * 8 + REDO_BUFFER_SIZE / 2）。

- ALTER DATBASE ADD LOGFILE


```
ALTER DATABASE ADD LOGFILE ('/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840,'/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840);
ALTER DATABASE ADD LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840 BLOCKSIZE 512;
ALTER DATABASE ADD LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840 PARALLEL 4;
```

  


- ALTER DATBASE DROP LOGFILE


```
ALTER DATABASE DROP LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5';
```

  


### 2.1.2.2 手动清理归档文件

用于对数据库的归档文件进行手动清理，释放磁盘空间。

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396cf98970c2af4f520f7c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFDQUFBQUlBQUFBQUFBQUFDQUFBQUFBQUFBQUFBRUVBZ0FBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFDQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUwMjQsImV4cCI6MTc4MjMxNTgyNH0.dtzeeHQfE3_ZOzhhGsE3-GcXux1GqzY9Jb2j2rh4fYw)

参数说明：

ALL：删除所有符合清理条件的归档日志。

UNTIL SEQUENCE：删除序列号为某值的归档及序列号之前的所有符合清理条件的归档。序列号可在归档文件的序列号直接查看，或者通过V$ARCHIVED_LOG视图的SEQUENCE#查看。

THREAD：指定清理实例，默认为1。

UNTIL TIME ：删除截至date时间前所有符合清理条件的归档日志。

SCN：  清理指定SCN之前生成的并且满足清理条件的归档  。（  同V$ARCHIVED_LOG中的NEXT_CHANGE#作比较）

FORCE：不考虑清理条件，强制清理归档文件。

清理归档的原则：归档日志不被数据库回放需要，即小于数据库的回放点，这样的归档才可以被清理。可以从V$DATABASE视图的RCY_POINT获取数据库的当前回放点。

手动清理归档日志的筛选条件由ARCH_CLEAN_IGNORE_MODE参数决定：

- NONE：表示清理归档文件时不忽略备份和备库。
- BACKUP：表示清理归档时忽略备份，此设置可能导致数据库无法恢复至任意时间点 。
- STANDBY：表示清理归档时忽略备库，此设置可能导致备库跟不上主库，出现need repair状态。
- BOTH：表示清理归档时忽略备份和备库，此设置可能导致如上所述的两种问题均会出现。
- 其中：
    - 忽略备份指的是无论该归档文件是否已经备份，均会被清理。
    - 忽略备库指的是无论该归档文件是否已经被所有备库获取，均会被清理。


```
--清理所有满足条件归档日志
ALTER DATABASE DELETE ARCHIVELOG ALL;
--清理序列号之前的所有符合条件归档文件
ALTER DATABASE DELETE ARCHIVELOG UNTIL SEQUENCE 5;
--清理某时间之前满足条件归档文件
ALTER DATABASE DELETE ARCHIVELOG UNTIL TIME TO_DATE('2024-06-01 18:00:00', 'yyyy-mm-dd hh24:mi:ss');
--清理某SCN之前满足条件条件归档文件
ALTER DATABASE DELETE ARCHIVELOG UNTIL SCN 123123;

--强制归档清理
ALTER DATABASE DELETE ARCHIVELOG ALL FORCE;
ALTER DATABASE DELETE ARCHIVELOG UNTIL SEQUENCE 5 FORCE;
ALTER DATABASE DELETE ARCHIVELOG UNTIL TIME TO_DATE('2022-06-01 18:00:00', 'yyyy-mm-dd hh24:mi:ss') FORCE;
```

  


## 2.2 应用场景

ALTER DATABASE用于修改数据库的相关属性，用于数据库维护管理。

## 2.3 规格约束

- 分布式部署下只有SYS用户具有ALTER DATABASE操作权限；
- 分布式部署下只能直连节点执行ALTER DATABASE修改本地DATABASE属性；
- DN首节点组内节点新增/删除redo文件，扩容新DN组内节点redo文件按默认的redo文件配置。


# 3. 测试部署组网

  


|部署形态|部署规格|
|:---|:---|
|分布式|3CN1MN(组内1主2备)3DN组(组内1主2备)|


分布式：

![](https://pingcode.yasdb.com/atlas/files/public/67396cf98970c2af4f520f7d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFDQUFBQUlBQUFBQUFBQUFDQUFBQUFBQUFBQUFBRUVBZ0FBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFDQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUwMjQsImV4cCI6MTc4MjMxNTgyNH0.dtzeeHQfE3_ZOzhhGsE3-GcXux1GqzY9Jb2j2rh4fYw)

# 5. 详细测试设计

|测试对象|测试项|测试描述|测试结果|详细测试内容|
|---|---|---|---|---|
|**ALTER DATABASE ADD/DROP LOGFILE**    
    
    
    
    
    
|语法验证|验证参数输入有效性，覆盖边界值，通过等价类测试方法验证参数内容,REDO文件最小值=DB_BLOCK_SIZE * MAX_SESSIONS * 8 + REDO_BUFFER_SIZE / 2,1、增加redo小于系统要求最小值[6M,2T],2、增加redo大于系统要求最小值,3、增加redo文件超过磁盘空间,4、增加redo文件超过redo文件最大值,5、删除redo文件个数到最小值: 3,6、增加redo文件到最大值：256,7、BLOCKSIZE范围  [512, 32K],8、增加redo文件执行并行度范围[1,8]|redo可配置成功最小值会根据系统配置提示；,YAS-00302 file redo12000xxxx is invalid because filename with home is too long,BLOCKSIZE需要时512K的倍数：YAS-02309 invalid redo file block size, must be an integer multiple of 512,  
|  
    
    
    
    
    
    
,[分布式支持REDO在线管理.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjhhMWFkOWEzMzExZGM4ZGU5IiwicmVmX2lkIjoiNjczOTZjZjg3MjgyMDZlZmI5MmYxOTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDI0LCJleHAiOjE3ODIzOTE0MjR9.A29g5x4cP_253kGZfuIwoNDlZ91WX3SIdYqVbS0DyBM)|
||不同节点在线修改REDO验证|背景业务(包含DDL/DML/DQL)执行：,CN节点修改,DN主节点修改,DN备节点修改,MN主节点修改,MN备节点验证|1、CN执行拦截：,YAS-00004 feature "unsupported ddl cmd: alter database" has not been implemented yet,2、MN和DN备节点不支持增删redo文件：YAS-06010 the database is not in readwrite mode||
||节点启动到不同状态执行redo增删|1、启动节点MOUNT/NOMOUNT状态,2、启动节点到OPEN状态,3、ANORMAL|1、非open状态执行redo增删：YAS-02078 the database is not open,2、启动到open状态可执行；,3、非NORMAL状态主节点执行redo增删：YAS-06023 database is set to read-only because of database abnormal||
||可靠性验证|1、增删redo文件过程CN节点故障；,2、多CN场景，增删redo文件过程其它CN故障；,3、DN增删redo文件过程备节点故障；,4、DN增删redo文件过程主节点故障；,5、DN备机故障(1个，2个)，DN主节点执行redo文件增删；（DN验证开启OM仲裁场景）,6、MN增删过程redo文件过程备节点故障；,7、MN增删redo文件过程主节点故障；,8、MN备机故障(1个，2个)，MN主节点执行redo文件增删。|1.CN节点拦截redo操作,2. DN增删过程主节点过程，回滚；可能存在文件残留，需要手动处理,3、MN增删redo过程主节点故障，回滚；可能存在文件残留，需要手动处理,4、DN增删过程1个备故障，无影响,5、DN增删过程2个DN故障，卡住,6、DN仲裁模式下，redo增删过程备故障不影响；,7、MN增删过程故障1个备不影响，故障2个备卡住，备恢复后继续执行。||
||扩缩容验证|修改redo大小后：,1、扩容MN备节点；,2、扩容CN节点,3、扩容DN组内备节点；,4、扩容DN组,缩容不影响不再验证|1. 扩容过程，执行redo增删报错：YAS-02502 cannot perform file operations when database is backing up
1. 扩缩容MN/DN备节点，复制主节点redo信息
1. 扩缩容CN无影响(CN拦截logfile操作)
1. 扩容DN组，redo是yasboot生成默认
1. 扩容中第一个DN组增删redo文件，扩容失败：YAS-02503 cannot backup database when operation redofile
1. 扩容中DN组增删redo拦截报错：YAS-02502 cannot perform file operations when database is backing up
1. DN组缩容过程其它DN组执行redo操作拦截报错：YAS-02502 cannot perform file operations when database is backing up
||
||备份恢复验证|1、执行cluster备份，然后节点增删redo文件，根据备份文件恢复；,2、增删redo文件，然后备份cluster，根据备份恢复；,3、增删redo文件，然后备份cluster，再次增删redo文件，根据备份恢复。|1.备份过程操作redo拦截,2. 备份恢复包含redo||
||并发修改redo文件验证|1、同一个节点并发执行redo文件添加或删除：同一个文件和不同文件场景,2、多CN场景不同CN并发执行REDO文件增删。,3、增删redo文件过程执行switchover主备倒换；,4、增删redo文件过程执行备份恢复；,5、增删redo文件过程执行扩缩容；,6、手动删除(rm命令)redo文件与DROP LOGFILE、ADD LOGFILE并发,7、手动增加redo文件(linux命令)与ADD LOGFILE、DROP LOGFILE并发,8、强制切换redo(ALTER SYSTEM SWITCH LOGFILE;) 与DROP LOGFILE并发|1. CN拦截redo增删
1. 增删同一个redo，只有一个操作可以成功；
1. 增删REDO过程备份报错：YAS-02503 cannot backup database when operation redofile
1. 增删redo过程报错
1. 增加redo过程倒换报错，回滚成功
1. 手动删除redo，节点状态为ABNOMAL，无法再执行写操作
1. 当前使用redo无法删除
||
||用户操作权限|1、SYS用户,2、DBA用户；,3、具有ALTER DATABASE权限用户|MN/DN只有SYS用户可以操作ALTER DATBASE||
||审计|ALTER DATABASE 权限审计|审计成功||
||视图|增删redo文件后，v$logfile查看logfile显示结果是否正确|显示正确||
||资料|增加分布式支持说明|资料部分未更新||
|**ALTER DATABASE DELETE ARCHIVELOG**    
    
    
    
    
    
|语法验证|验证手动清理命令参数输入验证，采用有效/无效等价类以及边界值方法|  
|  
    
    
    
    
    
,[分布式支持手动清理归档日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjhhMWFkOWEzMzExZGM4ZGVhIiwicmVmX2lkIjoiNjczOTZjZjg3MjgyMDZlZmI5MmYxOTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDI0LCJleHAiOjE3ODIzOTE0MjR9.PnxwC0oBrpfOf-4S_f_Mn2nOEmtww5trX-9fho3Dook)|
||ARCH_CLEAN_IGNORE_MODE参数|分别配置为：NONE，BACKUP，STANDBY，BOTH验证手动清理|  
||
||分布式不同节点执行归档清理|背景业务(包含DDL/DML/DQL)执行：,CN节点已经开启归档模式，执行归档清理,CN节点关闭归档模式，执行归档清理,MN主节点执行归档清理,MN备节点执行归档清理,DN主节点执行归档清理,DN备节点执行归档清理|1、CN执行手动归档清理命令拦截；,2、DN/MN备节点执行归档清理都能成功；,3、ARCH_CLEAN_IGNORE_MODE=NONE， 非强制删除主备归档报错,4、ARCH_CLEAN_IGNORE_MODE=BACKUP,5、ARCH_CLEAN_IGNORE_MODE=STANDBY,6、ARCH_CLEAN_IGNORE_MODE=BOTH,不检查备份和备，直接删除||
||节点启动到不同状态执行归档清理|1、启动节点MOUNT/NOMOUNT状态,2、启动节点到OPEN状态,3、ANORMAL,4、NEED REPAIR|1、节点非open状态提示：YAS-02078 the database is not open,2、 节点ABNORMAL状态删除归档报错，强制删除可以成功,3、节点NEED REPAIR状态删除归档报错，强制删除可以成功,  
||
||并发执行|1、并发手动执行归档清理；,2、手动清理归档和自动清理归档文件同时触发；,3、备份集群和手动清理归档同时执行；,4、扩缩容(CN/MN/DN/DN组)与手动归档清理同时执行,5、手动rm归档日志和手动清理命令同时执行,6、手动rm归档日志，再手动清理命令,7、主备节点同时手动清理归档日志,8、归档(ALTER SYSTEM ARCHIVE LOG CURRENT;)与手动清理同时执行；|手动删除归档(rm或强制)可能造成主备数据不一致,备份过程，删除归档失败：YAS-02501 the backup is already in progress||
||可靠性|1、CN节点执行手动清理归档过程故障；,2、DN主节点执行手动清理归档过程故障；,3、DN主节点执行手动过程，备机故障(1个，2个),4、DN备节点故障(1个，2个)，DN主节点执行手动清理归档(验证OM仲裁场景)；,5、DN备节点执行手动清理归档过程故障；,6、DN备节点执行手动清理归档过程主节点故障；,7、MN主节点执行手动清理归档过程故障；,8、MN主节点执行手动清理归档过程，备机故障(1个，2个)；,9、MN备节点故障(1个，2个)，MN执行  归档清理；,10、MN备节点执行手动清理归档过程故障；,11、MN备节点执行手动清理归档过程主节点故障；|备节点故障，主可以执行删除归档,  
||
||审计|ALTER DATABASE 权限审计|审计正常||
||权限|1、SYS用户,2、DBA用户；,3、具有ALTER DATABASE权限用户|MN/DN上SYS用户才能执行，其它用户拦截||
||视图|v$archived_Log，执行归档清理前后查询视图|查询正常||
||资料|补充分布式说明|资料未说明||


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|是|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# 6. 测试用例

子表格

# 7. 测试环境

|服务器类型|操作系统|服务器个数|
|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|2|


# 8. 工作量评估

工作量： 1人/周

计划完成时间：2024.5.17

## Attachments:

[image2023-12-13_19-0-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjg4OTcwYzJhZjRmNTIwZjc5IiwicmVmX2lkIjoiNjczOTZjZjg3MjgyMDZlZmI5MmYxOTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDI0LCJleHAiOjE3ODIzOTE0MjR9.Tk-3huxRJIUJ66Sy6x0zhkqBYoxnZJu61GVys94ERpU)

 (image/png)    


[image2023-12-13_19-5-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjhhMWFkOWEzMzExZGM4ZGViIiwicmVmX2lkIjoiNjczOTZjZjg3MjgyMDZlZmI5MmYxOTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDI0LCJleHAiOjE3ODIzOTE0MjR9.5peVIRhRIhaPCkGAIakkpVYXX4xuW-iPLInEvJPOiOY)

 (image/png)    


[分布式支持REDO在线管理.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjhhMWFkOWEzMzExZGM4ZGU5IiwicmVmX2lkIjoiNjczOTZjZjg3MjgyMDZlZmI5MmYxOTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDI0LCJleHAiOjE3ODIzOTE0MjR9.A29g5x4cP_253kGZfuIwoNDlZ91WX3SIdYqVbS0DyBM)

 (application/x-xmind)    


[分布式支持手动清理归档日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjhhMWFkOWEzMzExZGM4ZGVhIiwicmVmX2lkIjoiNjczOTZjZjg3MjgyMDZlZmI5MmYxOTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDI0LCJleHAiOjE3ODIzOTE0MjR9.PnxwC0oBrpfOf-4S_f_Mn2nOEmtww5trX-9fho3Dook)

 (application/x-xmind)    


## Comments:

|  [](null)  ,会议纪要：    
  会议时间：2024.05.13 09:30-10:00    
  参与人员：何金阳，廖增康，施新华，黄家华    
  结论：    
  1. alter database 已经放开功能理论上保持现状，不增加拦截；    
  2. CN/DN第一个DN组增删redo，扩容CN或DN组后redo配置与第一个节点保持一致,Posted by shixinhua at 五月 13, 2024 10:40|
|---|
