Created by 吴煜, last modified on 六月 16, 2023

#   [YDBRD-13689 : tablespace故障，支持自动回滚设计文档](#ydbrd-13689--tablespace故障支持自动回滚设计文档)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-13689](https://jira.yasdb.com/browse/YDBRD-13689)  

##   [1. Overview（概述）](#1-overview概述)  

- tablespace相关元数据存放在控制文件中，datafile或者databucket文件在tablespace的创建、删除阶段生成，删除，tablespace的相关DDL不支持事务，故障场景下无法通过回滚方式恢复元数据的一致性。
- 基于tablespace不支持事务相关的特性，分布式下，为了尽量保证的tablespace的一致性，对现有的tablespace的故障恢复做改进


##   [2. Features（功能特性）](#2-features功能特性)  

DN或者CN故障场景下，靠MN推送，CREATE/DROP TABLESPACE能够自动恢复

**MN故障场景下，CREATE/DROP TABLESPACE可能可以自动恢复**

##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 查询tablesapce和文件状态:](#31-查询tablesapce和文件状态)  

#####   [](#11确认系统正常在cn执行命令查询-dvtablespace-dvdatafiledvdatabucket-动态视图获取节点tablespace和datafilebucketfile文件状态后续恢复操作根据查询结果匹配对应恢复操作)  

>   查询tablespace分布式视图命令:      `select * from dv$tablespace where name = upper('tablespace名称') order by group_id;`      `select * from dV$datafile where name like '%datafile名称' order by group_id;`      `select * from dv$databucket where url like '%bucketfile名称' order by group_id;`    

#####   [1.2 datafile，bucketfile文件目录:](#12-datafilebucketfile文件目录)  

>   1. datafile 文件默认目录：     `${YASDB_DATA}/节点名/dbfiles/`  
  1. bucketfile 文件默认目录：     `${YASDB_DATA}/节点名/local_fs/`  
  1. 如果指定了目录路径，文件目录：     `${YASDB_DATA}/节点名/指定目录/`  
  

###   [3.2 故障恢复:](#32-故障恢复)  

增加 drop tablespace xxx if exists 用于故障恢复

DropSpaceDef结构体增加 ifexists

```
typedef struct StDropSpaceDef {
    LangText name;
    CodBool  dropContents;     // Including contents
    CodBool  dropDatafiles;    // Including datafiles
    CodBool  cascade;          // Cascade integrity constraints
    CodBool  ifExists;      
} DropSpaceDef;

```

推送阶段：

verifyCreateTablespaceCtx    verifyDropTablespaceCtx  判断是否完整

ankTryCleanTablespace 清理残留tablespace和datafile以及部分databucket

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. DN节点可能由于内存或者磁盘空间不足，导致Tablespace推送任务（create  alter）无法执行成功，需要手动介入
1. MN节点出现了Tablespace相关操作部分成功，但是未持久化到DDL_QUEUE$生成推送任务时，又残留了tablespace的资源时，需要手动介入


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

- DDL都会先到MN上执行，MN上执行成功后，预期DDL也能够在CN和DN节点执行成功。
- 分布式DDL的两阶段执行是为了故障场景下，通过回滚方式，可以保证节点间元数据的一致性。对于CREATE/DROP TABLESPACE不支持回滚的DDL，DDL的两阶段执行没有什么实际意义。可以将TABLESPACE的DDL改成一阶段执行，在MN执行成功，其他节点执行失败了，统一通过DDL的推送方式恢复元数据的一致性。
- 执行CREATE/DROP TABLESPACE的时候，CN节点收到MN节点组abnormal的错误时，都需要通过dv$tablespace，dv$datafile以及ddl_queue$查看确定是否需要手动恢复


#####   [5.1 Create Tablespace](#51-create-tablespace)  

MN：

spcCreateTableSpace

1. 创建tablespace --- doCreateSpace
1. 创建datafile --- spcCreateDataFiles
1. 创建databucket --- spcCreateDataBuckets
1. 写入到DDL_QUEUE$系统表，DDL提交


场景

1.步骤1~2之间，在2之前，出现断电重启，残留tablespace

2.步骤2中间，出现断电重启，残留tablespace和datafile，会出现部分datafile创建成功，部分不成功

3.步骤2~3之间，出现断电重启，残留tablespace和datafile以及部分databucket

**4.步骤1~4之间失败，在MN节点出现残留，其他节点都未执行，在CN节点需要做反向操作 --- 手动操作**

5.若发现有残留，CN 发送 drop tablespace if exists xxx   **including**  **contents**  **and**  **datafiles**   （增加语法）

6.再查询    `dv$tablespace`    ，    `dv$datafile`    和     `dv$databucket`    ，确认没有对应的tablespace和文件残留

#####   [5.2 Drop Tablespace](#52-drop-tablespace)  

MN：

spcDropTableSpace

1. 根据dropContents字段决定是否spcDropObjects
1. 根据dropDatafiles字段，决定是否删除datafile文件
1. 删除tablespace
1. 持久化ddl_queue$系统表，DDL提交


场景：

1. 在步骤3出现abort，在MN节点会出现contents或者datafile残留
1. **步骤3~4出现abort，会出现MN节点上tablespace清理干净，但是DN，CN有tablespace的残留，需要手动恢复 --- 执行drop tablespace if exists**
1. 若发现有残留，cn 发送  drop tablespace if exists xxx    **including**  **contents**  **and**  **datafiles**
1. 再查询    `dv$tablespace`    ，    `dv$datafile`    和     `dv$databucket`    ，确认没有对应的tablespace和文件残留


#####   [5.3 Alter Tablespace](#53-alter-tablespace)  

MN：

add datafile

add databucket

会在mn上残留，需要直连mn  alter tablespace drop xxx 进行清理

shrink  encrypted无影响

#####   [5.4 推送容错处理  （MN执行成功，DDL_QUEUE$里面有推送任务）](#54-推送容错处理--mn执行成功ddl-queue里面有推送任务)  

CN/DN：

1. CREATE TABLESPACE执行过程中出现了断电重启，接收到CREATE TABLESPACE的推送消息，先判断下本地的TABLESPACE是否完整
1.     - 如果完整，直接返回成功给MN节点，
    - 如果不完整，则执行先清理tablespace，然后再创建完整tablespace，然后返回成功给MN节点

1. 接收DROP TABLESPACE推送消息，判断下是否残留有tablespace的资源，
1.     - 如果没有直接返回成功给MN
    - 如果有，则清理tablespace的残留资源

1. ALTER TABLESPACE
1.     - add datafile，先判断本地的datafile是否已被add，如果没有则创建
    - add databucket，先判断本地的databucket是否已被add，如果没有则创建
    - shrink、encrypted无影响



#####   [5.5 DFX](#55-dfx)  

######   [查看是否有异常推送DDL](#查看是否有异常推送ddl)  

dv$pub_stat

ddl_queue$

######   [查看是否有残留的tablespace，来确定是否需要手动恢复](#查看是否有残留的tablespace来确定是否需要手动恢复)  

dv$datafile

dv$tablespace

dv$databucket

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
create tablespace tbs_space_01 datafile 'file1' size 32M;
create tablespace tbs_space_02 DATABUCKET 'lscfile1';

--- 使得datafile不为空
create duplicated table t1 (r1 int) organization tac tablespace tbs_space_01;
insert into t1 values(1);
commit;

set serveroutput on
declare i number:=1;
begin
    for i in 1 .. 100 LOOP
        insert into t1 values(i);
    end loop;
    commit;
end;
/

--- 预期报错
drop tablespace tbs_space_01;
drop tablespace tbs_space_01 including contents and datafiles;


故障处理
create tablespace tbs_space_01 datafile 'file1' size 32M;
create tablespace tbs_space_02 DATABUCKET 'lscfile1';
1.MN执行未成功，MN挂掉，没有推送，mn有残留
由CN 执行
select * from dV$datafile where name like '%file1' order by group_id;
select * from dv$databucket where url like '%lscfile1' order by group_id;
drop tablespace if exists tbs_space_01 including contents and datafiles；
2.MN执行成功,CN/DN挂掉，有推送机制自动处理

drop
1.MN执行未成功，MN挂掉，没有推送，mn有残留
由CN 执行
select * from dV$datafile where name like '%file1' order by group_id;
drop tablespace if exists tbs_space_01 including contents and datafiles；
2.MN执行成功,CN/DN挂掉，有推送机制自动处理



```

##   [7.资料设计章节](#7资料设计章节)  

故障恢复说明

注：未挂载上的datafile只在很小的时间窗存在

1. select** *   **from**   dv$  **databucket**  **where**  **url**  **like**   '%bucketfile名称'   **order**  **by**  **group_id**  ;
1. **select**   *   **from**   dv$  **datafile**  **where**  **name**  **like**   '%datafile名称'   **order**  **by**  **group_id**  ;
1. **select**   *   **from**   dv$  **tablespace**  **where**  **name**   =   **upper**  ('tablespace名称')   **order**  **by**  **group_id**  ;
1. **select * from ddl_queue$**  ;
1. **select * from**   dv$  **pub_stat**  ；
1. **select group_id,group_node_id,type,role,state,running_state from dv$node order by group_id**  ;


####   [情况1：create tablespace过程中出现异常](#情况1create-tablespace过程中出现异常)  

- ######   [只在MN节点(group_id为1)有tablespace和datafile(或databucket)记录, ddl_queue$没有异常tablespace相关DDL记录:](#只在mn节点group-id为1有tablespace和datafile或databucket记录-ddl-queue没有异常tablespace相关ddl记录)  
- 发现只有MN节点挂掉，重新拉起后，需要  **手动**  在CN执行
- **drop tablespace if exists tablespace_name including contents and datafiles**  ;
- 查询    `dv$tablespace`    ，    `dv$datafile`    和     `dv$databucket`    ，确认没有对应的tablespace残留。
- 查询 mn节点下 的dbfiles文件夹，确认没有对应的tablespace(未挂载上，文件存在，dv视图搜不到)文件残留，若有则需手动rm 清除该文件夹。
- 再次执行     `create tablespace`     命令
- ######   [MN节点, 部分CN/DN节点有tablespace和datafile(或databucket)记录, ddl_queue$有异常tablespace相关DDL推送记录:](#mn节点-部分cndn节点有tablespace和datafile或databucket记录-ddl-queue有异常tablespace相关ddl推送记录)  
- 发现有部分CN/DN节点挂掉, 此时靠推送能够恢复
- 重新拉起后,等待片刻后发现ddl_queue$没有异常tablespace相关DDL记录,表示推送成功
- 若推送一直不成功则查询dv$pub_stat查看失败原因：
- 若显示  **DN资源不足**  ，则需要手动处理，重新合理分配资源。
- ######   [所有节点都没有tablespace和datafile(或databucket)记录, ddl_queue$没有异常tablespace相关DDL记录:](#所有节点都没有tablespace和datafile或databucket记录-ddl-queue没有异常tablespace相关ddl记录)  
- 发现只有MN节点挂掉, 重新拉起后, 无需清理再次执行     `create tablespace`     命令即可


####   [情况2：drop tablespace过程中出现异常](#情况2drop-tablespace过程中出现异常)  

- ######   [MN节点有tablespace和datafile(或databucket)记录：](#mn节点有tablespace和datafile或databucket记录)  
- 发现只有MN节点挂掉，重新拉起后，需要  **手动**  在CN执行
- **drop tablespace if exists tablespace_name including contents and datafiles**  ;
- ######   [MN节点不存在tablespace，CN/DN节点有tablespace和datafile(或databucket)记录：](#mn节点不存在tablespacecndn节点有tablespace和datafile或databucket记录)  
- 发现有部分CN/DN节点挂掉, 此时靠推送能够恢复


####   [情况3：alter tablespace add datafile过程中出现异常](#情况3alter-tablespace-add-datafile过程中出现异常)  

同情况1

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Comments:

|  [](null)  ,有视图里没有残留 但是文件里有残留的情况 需要去检查文件    
  单机 tablespace残留有没有文档说明    
  DN内存不足的情况详细说明,Posted by wuyu at 五月 25, 2023 16:45|
|---|
