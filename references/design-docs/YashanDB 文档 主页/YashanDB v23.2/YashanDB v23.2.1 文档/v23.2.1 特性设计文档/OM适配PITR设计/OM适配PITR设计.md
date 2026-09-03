Created by 瞿蓝孟, last modified on 十二月 12, 2023

概要设计：    [集群PITR概要设计](133564388.html)  

db的设计文档：    [集群PITR方案设计](130140584.html)  

##   [1. Overview（概述）](#1-overview概述)  

之前版本om只支持了集群和单机的完全恢复，现在需要适配集群和单机PITR恢复功能

##   [2. Features（功能特性）](#2-features功能特性)  

- 单机支持PITR恢复
- 集群支持PITR恢复
- 集群支持只清理数据文档，不清理归档的功能


##   [3.Interfaces（接口）](#3interfaces接口)  

- yasboot cluster clean
- 已有命令，之前不支持集群，现在支持集群；


|关键参数|选项|说明|
|---|---|---|
|-c,--cluster|必填|共享集群的名称|
|--restore|选填，与--purge互斥|该命令用于只清理数据文件，不清理归档，并让db以nomount的方式启动（单机，分布式已支持，这次主要是适配集群）|


​       --restore与--purge互斥，--purge为彻底清理db数据（包括归档）

- yasboot backup restore
- 已有命令，之前不支持PITR恢复，现在支持PITR；


|关键参数|选项|说明|
|---|---|---|
|--until-time|选填|指定恢复时间，字符串，格式要求为“'2006-01-02', '2006-01-02 15:04:05', '2006-01-02 15:04:05.000000'”|
|--until-scn|选填|指定恢复SCN，整数|


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 单机PITR底层是通过yasrman来实现的，但是集群因为暂不支持yasrman，所以是通过sql来完成的；
- 其他限制同db，om侧无其他限制


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

--until-time和until-scn参数互斥：

- 都不填写时为完全恢复；
- 都填写会报错；


db生成备份时，会在dba_backup_set视图记录该备份集的一致性scn和一致性时间，om在生成备份时也会记录该时间；

再执行PITR恢复时，om侧会对--until-time和--until-scn参数做检验：

- 指定的SCN小于当前备份集的一致性SCN，报错；
- 指定的时间小于当前备份集的一致性时间，报错；


###   [5.1 单机PITR设计](#51-单机pitr设计)  

主要参考yasrman的语法，将until-time和until-scn参数透传到yarsman中，交给yasrman执行恢复命令

####   [**YASRMAN语法**](#yasrman语法)  

```
RESTORE DATABASE FROM TAG 'BAK1' UNILT SCN 123;
RESTORE DATABASE FROM TAG 'BAK1' UNTIL TIME '2023-11-17 16:46:36'";

```

###   [5.2 集群PITR设计](#52-集群pitr设计)  

由于集群因为暂不支持yasrman，所以底层是通过执行sql来完成恢复的；

在原有逻辑中，恢复时会清理所有数据和归档，只能执行完全恢复；

先修改内部的恢复逻辑，恢复时只清理数据文档，不删除归档；（这个可以通过“yasboot cluster clean --restore”命令单独执行；）

主要参考sql的restore和recover语法，将until-time和until-scn参数透传到具体sql中

sql语法：

```
-- 指定时间点
RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL TIME '2023-11-02 12:00:00'
ALTER DATABASE OPEN RESETLOGS;

-- 指定SCN
RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL SCN 123344;
ALTER DATABASE OPEN RESETLOGS;

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. OM搭建集群（参考官网文档部署）
1. 执行一点业务，做个全量备份
1. 继续执行业务，中途记录时间点（或scn）(select current_scn from v$database;)
1. 查询当前数据量。
1. 所有实例依次执行alter system archive log current，保证归档生成
1. 查询om的备份集列表，记录你想要恢复的备份集对应的uuid
1. 以6中备份集的uuid进行恢复


```
./bin/yasboot package se/ce gen -L -c xx
./bin/yasboot package install -t hosts.toml
./bin/yasboot cluster deploy -t xx.toml

```

```
./bin/yasboot backup create -c xx --node-id 1-1

```

```
./bin/yasboot backup list -c xx

```

```
./bin/yasboot backup restore -c xx --uuid 123 -d --restore-time "2023-11-17 16:46:36"
./bin/yasboot backup restore -c xx --uuid 123 -d --scn 112233

```

1. PITR恢复完成，检查数据量是否达到预期。


##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*