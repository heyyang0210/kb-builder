Created by 易文亮, last modified on 七月 18, 2024

# 1. 概述

支持Flashback Database把整个数据库回退到过去的某个时点的状态。

在启用闪回数据时，会将修改过的块的前映像作为闪回数据库日志保存在闪回恢复区中，如出现逻辑坏块或用户错误操作需要恢复到过去的时间点，闪回数据库将还原数据库的前映像，然后使用归档日志和redo前滚到期望恢复的时间点，因为无需还原数据库的数据文件，所有此过程速度比较传统的还原恢复通常快很多。

SR链接：

  [https://pingcode.yasdb.com/pjm/items/6618dd8bfd997db58ad8177f](https://pingcode.yasdb.com/pjm/items/6618dd8bfd997db58ad8177f)    *? #YDBRD-26148 单机支持flashback database-主库*    


  [https://pingcode.yasdb.com/pjm/items/6618de82fd997db58ad81967](https://pingcode.yasdb.com/pjm/items/6618de82fd997db58ad81967)    *? #YDBRD-26150 单机支持flashback database-备库*

开发设计：  [https://pingcode.yasdb.com/wiki/pages/6739c401728206efb93110a0](https://pingcode.yasdb.com/wiki/pages/6739c401728206efb93110a0)  

测试调研：  [https://pingcode.yasdb.com/wiki/pages/673967a8593f99c9ff2341a2](https://pingcode.yasdb.com/wiki/pages/673967a8593f99c9ff2341a2)  

# 2. 需求分析

## 2.1 功能点分析

|功能|设计表现|设计说明|测试说明|
|:---|:---|:---|---|
|数据库闪回|在执行完 flashback database 回退命令之后，  直接 alter database open resetlogs 打开数据库，指定 scn 或者  timestamp 时间点之后的数据将丢失|  
|确认闪回后数据正常，往前多次闪回，往后闪回报错  ,使用正常/保证还原点闪回,考虑闪回成功、受限或失败|
|数据库  闪回关闭|如果存在guarantee还原点，则无法关闭。,在无guarantee还原点情况下，数据库在open状态下关闭数据库闪回：,1. 删除所有flashback database log
1. 释放flashback log buffer
1. 后台线程rvwr将退出
|支持主备库|不同DB状态下尝试关闭闪回,无还原点进行闪回关闭验证,有正常还原点进行闪回关闭验证,有保证还原点进行闪回关闭验证,  
|
|数据库  闪回启用|数据库在open状态下开启数据库闪回，数据库闪回开启后将数据库将新增如下：,1. 启用flashback database log
1. 分配flashback log buffer
1. 开启后台线程rvwr（recover write）
1. 动态视图可查询到数据
|支持主备库|不同DB状态下尝试开启闪回,无还原点进行闪回开启验证,  
,  
|
|权限|flashback database需要sysdba权限|权限要清晰|dba权限用户进行flashback,非dba权限用户进行flashback报无权限|
|还原点创建和删除|支持create和drop restore point,guarantee还原点：,1. db_flashback_retention_target参数对guarantee还原点不生效
1. guarantee还原点会强制保留所有的与之相关的flashback database log
|还原点数量无限制|创建正常/保证还原点,删除正常/保证还原点,创建多个还原点,反复创建/删除还原点|


## 2.2 SQL分析

1）语法

**alter database flashaback {on|off};**  --  **开启和关闭flashback database**

**CREATE RESTORE POINT rp_name [AS OF SCN scn|TIME timestamp] [GUARANTEE FLASHBACK DATABASE]; **  **--创建正常(保证)还原点**

**DROP RESTORE POINT rp_name;**  **--删除还原点**

**FLASHBACK [STANDBY] DATABASE **  ~~**[<database_name>]**~~  **  **  **TO **  ~~**[BEFORE]**~~  ** {RESTORE POINT <restore_point_name>| （{scn|timestamp} expr）};**  **--快速回退数据库**

**select current_scn from v$database;**

**select to_char(sysdate,'yyyy-mm-dd hh24:mi:ss') tm from dual;**

**通过scn_to_timestamp/timestamp_to_scn互转**

2）参数

|参数|用途|生效|
|:---|:---|:---|
|db_flashback_retention_target|用于控制flashback database log file的保留时间，单位秒(同oracle)|修改后立即生效|
|db_flashback_file_dest_size|用于控制flashback database log file的目录的大小，单位MB|修改后立即生效|
|db_flashback_file_dest|默认flashback下|不能修改|


#### 3） 动态视图

|视图名称|内容|备注|
|:---|:---|:---|
|V$FLASHBACK_DATABASE_LOG|flashback log最小SCN和时间、保留时间、flashback log file总大小等信息|提供数据库可回退点信息|
|V$FLASHBACK_DATABASE_LOGFILE|flashback log的文件名、序号、每个文件最早scn和时间、类型等信息|  
|
|V$RESTORE_POINT|还原点信息|  
|
|V$SYSSTAT|新增Flashback log writes和Flashback log write bytes字段|版本升级时|
|v$database|新增flashback_on字段，判断数据库闪回是否开启|版本升级时|


  


## 2.3 规格约束

### 4.1 规格

1. 支持单机和主备；主备独立开启闪回。
1. 支持所有dml、dcl；支持除表空间和数据文件操作外的所有DDL。
1. 闪回操作的粒度是整个数据库，但不闪回临时表空间、slice、VM、SWAP、双写文件、参数文件、redo文件。
1. 闪回日志flashback log可按需设置保留策略，默认保留时间为2天；关闭数据库闪回将删除全部闪回日志，但如果存在  guarantee还原点，与guarantee还原点相关的flashback log file将保留  。
1. 使用Flashback Database 能回退到的最早的SCN， 取决于flashback Log file中的最小的SCN。
1. 数据库open状态开启和关闭flashback database功能；使用flashback database 回退数据库必须以mount状态。
1. 恢复后完成，主库要以open resetlogs；备库使用open。
1. 闪回日志信息记录在ctrl文件，如果从备份中恢复或者重建数据库控制文件，则所有累积的闪回日志信息都将被丢弃。


##### 表空间和数据文件的规格如下表：

|数据文件状态|全库闪回后|备注|
|:---|:---|:---|
|表空间创建|从控制文件中删除|使用逻辑日志|
|数据文件add|从控制文件中删除|使用逻辑日志|
|dropped|不支持|需要备份；保证策略|
|rename|不支持|后续版本支持|
|resized|只支持扩展，现不支持收缩|收缩不保证能恢复到指定时间点 |
|offline|不支持|  
|
|online|不支持|  
|
|表空间迁移|不支持|同drop tablespce|


### 4.2 约束

1. 不支持集群和分布式
1. 数据库处于归档模式  ；flashback database依赖归档和redo进行恢复
1. 必需配置fast recovery area，如果fast recovery area没有空间可用时将会导致数据库一切事务操作挂起。
1. 列存（lsc slice格式）存在数据丢失；崖山数据库PITR不支持。
1. 不支持nologging；如果闪回的目标时间点包括nologging操作，回放会hang住，数据库状态变成abnomal。
1. 开启flashback database后数据库整体性能会下降（oracle开启flashback database后性能下降20%），崖山数据库性格指标需要benchMark测试。


## 2.4 部署模式

单机及HA

# 3. 详细测试设计

## 3.1 测试设计方法

- 语法覆盖主要使用等价类
- 参数验证使用等价类和边界值
- 视图结合业务场景进行验证
- 限制和约束及主要功能点使用场景测试法、错误推测法进行验证


## 3.2 详细测试设计

1）语法、参数、视图及基本功能场景验证

|序号|输入条件|有效等价类|无效等价类|
|:---|:---|:---|:---|
|1|ALTER DATABASE FLASHBACK ON|数据库在OPEN/MOUNT状态开启,开启闪回成功后尝试关闭归档报错,  
|数据库在NOMOUNT状态开启,未开启archivelog时尝试开启,db_flashback_file_dest_size为默认值0时开启,重复开启|
|2|ALTER DATABASE FLASHBACK OFF|数据库在OPEN/MOUNT状态关闭,无还原点,有正常还原点,重复关闭|数据库在NOMOUNT状态关闭,存在保证还原点,  
|
|3|**CREATE RESTORE POINT**|open/mount状态创建正常/保证还原点,闪回开关关闭或者开启、  archivelog关闭场景下  ，都可创建正常/保证还原点成功,创建多个还原点，中间间隔业务/不间隔业务|存在同名的还原点,point_name超长、特殊符号等非法对象名|
|4|**DROP RESTORE POINT rp_name**|open/mount状态删除存在的正常/保证还原点|删除不存在的还原点|
|5|**FLASHBACK DATABASE**|只能在MOUNT状态执行,使用正常/保证还原点还原,使用正确且存在的scn/timestamp还原,执行各种DDL/DML/DCL业务后，闪回到执行业务前,带standby进行备机闪回,按顺序逐个从后往前闪回，最后再open resetlogs,多次重复闪回到一个还原点，最后再open resetlogs,多次还原到一个还原点，再open resetlogs，再还原再open|open状态执行报错,还原点不存在,scn已失效,expr错误或者与scn/timestamp格式不一致,闪回到nologging业务中hang住,闪回后再往更大的scn进行闪回,未开启归档，执行闪回报错|
|6|  
|  
|  
|


2）功能及DFX验证

|序号|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|闪回验证|确认闪回点，执行多种支持的create对象操作，闪回到闪回点，确认对象及元数据|闪回成功，闪回点后创建的对象不存在，元数据正确|  
|
|2|  
|创建多种支持drop的对象，确认闪回点和元数据，drop对象，执行闪回后再确认对象和元数据|闪回成功，闪回点后删除的对象恢复，元数据正确|  
|
|3|  
|创建多种支持alter的对象，确认闪回点和元数据，alter对象，执行闪回后再确认对象和元数据|闪回成功，闪回点后修改的对象恢复，元数据正确|  
|
|4|  
|确认闪回点，执行不支持的create对象操作，闪回到闪回点，确认对象及元数据|闪回报错|  
|
|5|  
|创建不支持drop的对象，确认闪回点和元数据，drop对象，执行闪回后再确认对象和元数据|闪回报错|  
|
|6|  
|创建不支持alter的对象，确认闪回点和元数据，drop对象，执行闪回后再确认对象和元数据|闪回报错|  
|
|7|  
|建表做DML操作，闪回后确认数据正确性|  
|  
|
|8|  
|主库闪回成功后alter database open resetlogs 打开数据库|启库成功，数据回到闪回点的状态，确认内存释放|  
|
|9|  
|主库闪回成功后alter database open打开数据库报错|启库失败，或者启库成功后数据不一致|  
|
|10|  
|主库闪回成功后recover database，再alter database open|启库成功，数据回到未闪回的状态|  
|
|11|  
|创建还原点p1，创建一个nologging的表t1,创建还原点p2,插入1W条数据并提交，创建还原点p3，插入1W条数据并提交，,创建还原点p4，修改t1表为logging,创建还原点p5,插入1W条数据并提交，分别尝试闪回到还原点p1/p2/p3/p4/p5|p3 存在不确定,闪回到dml长业务中间的scn会hang住|  
|
|12|  
|准备：执行业务1，创建还原点p1，执行业务2，创建还原点p2，执行业务3，创建还原点p3，再执行业务4,1、闪回到p3，再次闪回到p3，alter database open resetlogs,2、闪回到p3，再闪回到p2，再执行闪回到p1，alter database open resetlogs,3、闪回到p2，再尝试闪回到p3，alter database open resetlogs,4、执行1、2、3，每闪回一次进行alter database open resetlogs|1、2闪回成功，启库成功，确认数据是在执行业务3后的状态,2、p3、p2、p1都闪回成功，启库成功，数据库在执行业务1的状态,3、闪回到p2、p3成功，启库成功，数据库在执行业务1的状态,4、能正常依次往前闪回，业务正常回退，往后闪回成功业务不回退|  
|
|13|  
|增删redo, resize扩展swap，执行闪回|闪回失败，不会还原文件变化|  
|
|14|  
|未开启闪回日志创建还原点p1，再打开闪回日志，把库置为mount状态，使用p1进行闪回|未开启闪回日志创建还原点拦截|  
|
|15|  
|未开启archivelog创建还原点p1,打开闪回日志报错，切库到mount状态，alter database archivelog，执行闪回失败，开启闪回，执行闪回p1|未开归档日志创建还原点拦截|  
|
|16|  
|闪回到未开启闪回日志之前的scn|闪回失败报错|  
|
|17|  
|做业务，记录闪回点a，继续做业务，备份归档，闪回到a点， 使用归档备份集restore归档，然后open（类似与使用归档备份集做pitr恢复）,做业务，记录闪回点a，备份归档，继续做业务，在备份恢复，再闪回|先闪回成功后再恢复数据成功,先恢复再闪回到恢复前的scn报错,先恢复再闪回到恢复后的scn报错|  
|
|18|  
|闪回开启状态下，执行业务，手工清理归档，执行闪回操作|~~保留时间内的还原点归档不会被清理~~  归档会被清理，导致闪回失败|  
|
|19|  
|闪回开启状态下，执行业务，设置归档清理策略，执行闪回操作|~~保留时间内的还原点归档不会被清理~~  归档会被清理，导致闪回失败|  
|
|20|  
|闪回成功后执行长业务|DB不异常，业务正常|  
|
|21|  
|执行闪回成功后，执行业务，保留闪回点，再执行业务再闪回到闪回点能成功|  
|  
|
|22|备机操作|备机使用flashback database闪回报错|  
|  
|
|23|  
|备机使用flashback standby database闪回成功|  
|  
|
|24|  
|主机创建删除还原点不同步到备机|  
|  
|
|25|  
|备机创建/删除还原点成功|  
|  
|
|26|  
|备机执行switchover/failover后再执行闪回|  
|  
|
|27|  
|备机need repair后，闪回到分歧点之前，确认主备能正常同步|脑裂导致的need repair可以闪回,若文件损坏无法闪回成功|  
|
|28|  
|主库闪回到scn1,open resetlogs，备机会need repair，备机也闪回到scn1或者小于scn1之前的scn|主备能正常同步|  
|
|29|参数验证|确认参数  db_flashback_retention_target  的默认值、单位、范围，最小最大值能设置成功，越界非法值设置失败|  
|  
参数同oracle，默认1440分钟，即1天|
|30|  
|确认参数db_flashback_file_dest_size的默认值、单位、范围，最小最大值能设置成功，越界非法值设置失败|  
|对应oracle的db_recovery_file_dest_size,>0  
我们【8G，200T】|
|31|  
|db_flashback_file_dest_size为默认值0开启闪回报错|  
|对应oracle的db_recovery_file_dest，可修改  
我们不可修改|
|32|  
|开启闪回日志，执行大量业务操作，触发db_flashback_file_dest_size写满|会导致事务挂起|  
增加空间或者清理日志后恢复正常|
|33|  
|闪回目录权限不足，磁盘空间不足，执行业务|创建文件报错|  
|
|34|  
|  
|  
|  
|
|35|  
|主机开启闪回，备机未开启闪回，备机闪回失败，备机参数设置不满足，备机执行闪回报错|  
|  
|
|36|  
|主机备机都开启，对备机进行闪回操作|  
|  
|
|37|  
|主机不开启闪回，备机开启闪回，对备机进行闪回操作|  
|  
|
|38|  
|确认闪回log超过db_flashback_retention_target的清理逻辑|  
|  
|
|39|视图验证|v$database新增flashback_on字段，启动或者关闭闪回，状态正常变化|  
|  
|
|40|  
|V$FLASHBACK_DATABASE_LOG字段正确，打开闪回日志，执行业务，闪回日志会正常增加|  
|  
|
|41|  
|V$FLASHBACK_DATABASE_LOGFILE字段正确，打开闪回日志，执行业务，闪回日志会正常增加,确认超过  db_flashback_retention_target时间的flashback log file会自动删除,确认flashback log file超过db_flashback_file_dest_size  无法写入|  
|  
|
|42|  
|V$RESTORE_POINT字段  正确，创建正常/保证还原点，视图会正常新增记录，删除正常/保证还原点，视图记录被被清理|  
|  
|
|43|  
|V$SYSSTAT正常新增Flashback log writes和Flashback log write bytes字段，值正确|  
|  
|
|44|  
|关闭flashback开关，确认  V$FLASHBACK_DATABASE_LOG/V$FLASHBACK_DATABASE_LOGFILE被清空|  
|  
|
|45|  
|使用还原点还原，确认  V$RESTORE_POINT视图中  还原点之后创建的还原点信息是否丢失|  
|  
|
|46|并发|开启/关闭闪回日志与业务DDL/DML进行并发,开启/关闭闪回日志与flashback database并发,闪回与相关视图查询并发,闪回与闪回日志清理并发,创建删除还原与DDL/DML并发|  
|  
|
|47|权限验证|普通用户尝试执行flashback database报错,dba用户尝试执行flashback database成功,打开/关闭开关需要DBA,创建/删除还原点不需要DBA|  
|  
|
|48|故障|闪回过程中杀库，拉起再闪回,闪回过程中ctrl+C中断，再重新执行闪回,logfile被手工删除，尝试闪回失败,确认会新增哪些告警日志：闪回日志写不进会告警|  
|  
|
|49|性能|开启闪回日志后，进行业务操作，验证tpcc性能,开启闪回日志后，执行1H/24H tpcc，再闪回，确认闪回耗时|1、oracle性能下降20%左右,2、闪回1H和闪回24H的耗时不会相差太大|  
|
|50|升级|22.2/23.1升级到23.2版本后，视图字段正确，升级前后各执行一些业务操作，能正常进行库级闪回|  
|  
|
|51|长稳|执行准备业务，记录闪回点，再执行背景业务，闪回到闪回点，执行长稳业务,打开闪回开关，执行长稳业务|  
|  
|
|52|拦截|共享集群和分布式拦截|执行create restore/开启闪回开关，restore|  
|


[单机支持flashback database(ydbrd26148).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY3MjNhMWFkOWEzMzExZGM2ZDVmIiwicmVmX2lkIjoiNjczOTY3MjM1OTNmOTljOWZmMjMzZmRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NjAwLCJleHAiOjE3ODI1NDUwMDB9.tXwfw_BXULkEjJ8U4uZvl_A1MHpq0Fk_gtQW9EmGkyo)

# 4. 测试用例

冒烟文本用例：

1、

文本用例：

# 5. 测试框架设计

使用ha_regress功能，封装接口

# 6. 测试环境说明

部署：单机+HA

# 7. 工作量评估

工作量：8人周

计划测试完成时间：2024/7/30

## Attachments:

[单机支持flashback database(ydbrd26148).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY3MjNhMWFkOWEzMzExZGM2ZDVmIiwicmVmX2lkIjoiNjczOTY3MjM1OTNmOTljOWZmMjMzZmRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NjAwLCJleHAiOjE3ODI1NDUwMDB9.tXwfw_BXULkEjJ8U4uZvl_A1MHpq0Fk_gtQW9EmGkyo)

 (application/x-xmind)    


## Comments:

|  [](null)  ,flashback database 测试设计评审：,参与人：陆世杰、马志宏、陈瑞、郑荃、高亚宁、陈瑞、易文亮、郭臧龙、陈宜顺,评审记录：,1、未开启闪回日志/归档创建/删除还原点拦截——逻辑修改    
  2、不支持的业务操作flashback database成功，不会回到还原点时的业务状态——功能点确认    
  3、跟oracle一样参数新增db_flashback_file_dest，闪回日志目录，暂不支持修改    
  4、暂未加保证还原点归档不清理的约束，归档日志可能因手工清理或者自动归档清理机制被清而导致无法闪回    
  5、闪回业务测试以DML业务闪回为主,6、支持往前多次闪回，往后闪回拦截——功能点确认,7、验证闪回后执行业务，再闪回的逻辑——功能点补充,Posted by yiwenliang at 七月 03, 2024 16:26|
|---|


性能结果：

|执行业务|LSC冷数据|LSC热数据|heap|tac|
|---|---|---|---|---|
|打开flashback|50|169|62|75|
|关闭flashback|23|41|13|17|


|执行业务|LSC冷数据|LSC热数据|heap|tac|tpcc|
|---|---|---|---|---|---|
|打开flashback|65|113|22|21|4087.81|
|关闭flashback|61|108|21|20|4486.15|


 

data_buffer_size=2G，100仓50并发跑10分钟的tpcc再闪回，耗时4分12s；改大data_buffer_size=10G，同样的场景闪回耗时3min58s