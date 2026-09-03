Created by 朱国旭 on 十月 14, 2024

# YDBRD-21393    [: 集群支持PITR（方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)  

SR链接：       [YDBRD-21393](https://jira.yasdb.com/browse/YDBRD-21393?src=confmacro)    -  【23.1补丁】集群内核支持PITR  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

1. 集群功能同单机对齐，集群支持PITR恢复。
1. 功能拓展：yasrman支持PITR恢复。（当前需求仅支持单机）
1. 友商功能补齐，参考特性调研文档（    [集群PITR特性调研](133585009.html)    ）。


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 集群支持PITR的功能，语法及操作流程同单机一致。
1. yasrman支持PITR的语法功能。功能实现同SQL一致，需要支持yasrman的语法。


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

#### **1.SQL语法。**

**语法图：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c3b8970c2af4f520a4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUlBQUFBQUFBQUFBQUFBRUNFQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk5MjYsImV4cCI6MTc4MjMxMDcyNn0.PD7sWEWh6EGcj7TJSGmet_PP-1YYpNvEQq4lm8rQrZU)

![](https://pingcode.yasdb.com/atlas/files/public/67396c3b8970c2af4f520a50/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUlBQUFBQUFBQUFBQUFBRUNFQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk5MjYsImV4cCI6MTc4MjMxMDcyNn0.PD7sWEWh6EGcj7TJSGmet_PP-1YYpNvEQq4lm8rQrZU)

**功能使用示例：**

```
-- 指定SCN
RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL SCN 123344;
ALTER DATABASE OPEN RESETLOGS;
 
-- 指定时间点
RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL TIME TO_DATE('2023-11-02 12:00:00', 'YYYY-MM-DD HH24:MI:SS');
ALTER DATABASE OPEN RESETLOGS;

RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL TIME TO_TIMESTAMP('2023-11-03 09:42:32.123456', 'yyyy-mm-dd hh24:mi:ss.ff');
ALTER DATABASE OPEN RESETLOGS;

RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL TIME '2023-11-02 12:00:00';
ALTER DATABASE OPEN RESETLOGS;

RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE UNTIL TIME '2023-11-02 12:00:00.123456';
ALTER DATABASE OPEN RESETLOGS;

-- 完全恢复（集群已经支持）
RESTORE DATABASE FROM 'BAK1';
RECOVER DATABASE;
ALTER DATABASE OPEN;
```

#### **2.YASRMAN语法**

**新增语法：**

```
RESTORE DATABASE FROM TAG 'BAK1' UNILT SCN 12344;
RESTORE DATABASE FROM TAG 'BAK1' UNTIL TIME '2023-11-02 12:00:00';
RESTORE DATABASE FROM TAG 'BAK1' UNTIL TIME '2023-11-02 12:00:00.123456';
RESTORE DATABASE FROM TAG 'BAK1' UNTIL TIME '2023-11-02;
```

**语法图：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c3ba1ad9a3311dc88c0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFRQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUlBQUFBQUFBQUFBQUFBRUNFQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk5MjYsImV4cCI6MTc4MjMxMDcyNn0.PD7sWEWh6EGcj7TJSGmet_PP-1YYpNvEQq4lm8rQrZU)

#### **3.测试需要的视图及SQL函数：**

```
--日志切换
ALTER SYSTEM SWITCH LOGFILE;
ALTER SYSTEM ARCHIVE LOG CURRENT;

--归档日志视图
SELECT * FROM V$ACRHIVED_LOG;

-- 查询当前数据库SCN
SELECT CURRENT_SCN FROM V$DATABASE;

-- SCN和时间转换函数
SELECT SCN_TO_TIMESTAMP(496185150055821312) FROM DUAL;
SELECT TIMESTAMP_TO_SCN('2023-11-03 09:42:32.650347') FROM DUAL;

-- UNTIL TIME可使用的时间函数
TO_DATE('2023-11-03 09:42:32', 'yyyy-mm-dd hh24:mi:ss'); 精度只能到秒，指定时间恢复存在精度丢失，所以要偏大一秒。
TO_TIMESTAMP('2023-11-03 09:42:32.00', 'yyyy-mm-dd hh24:mi:ss.ff');  精度可以到微秒，指定的时间可以精确到某SCN
```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. 指定的时间点过大，数据库无法恢复到指定的时间点时，recover database 会报错（同单机和Oracle保持一致）
1. 不完全恢复后，必须要reset logs。（同单机和Oracle保持一致）
1. 集群目前不支持yasrman，yasrman语法仅支持单机。
1. HA环境，主机执行完PITR恢复，所有备机需要重新构建。（备机会need repair）
1. yasrman执行失败后要重新清理环境，重新执行该操作。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 5.1 集群PITR设计

#### **5.1.1 日志回放**

1. 对于集群， SCN是全局的唯一的，所以多实例日志回放，只有一个实例回放到指定SCN，并不能满足目标条件（全局SCN的更新是所有实例回放SCN的最小值）。
1. 如果某实例的日志回放完了，可以认为该实例的回放SCN是无穷大，全局SCN的更新不再考虑该实例。
1. 记录nextReplayScn，用以区分是否无法回放到指定SCN，还是指定的scn刚好在两个PACK中间。（第一种情况是报错，第二种情况属于正常场景）


#### **5.1.2 RESET LOGS**

重置时间线即从当前的日志回放点结束点的开始，截断多余的日志，切换redo文件，并且结束点开始记录新的日志。并更新reset id。

**问题：执行不完全恢复，数据库一定要重置时间线。只能是由master实例执行restore操作，其他实例都无法加入集群，没有写日志的能力，其他实例的时间线如何重置？**

**方案一：**  master实例帮其他实例切换日志文件，并记录一条新的redo日志。
**方案二：**  master实例打标记，标记其他实例没有执行resetlogs，待其他实例加入集群并且open时，完成未完成的reset logs操作。
**方案分析：**
- 方案一是最直接的，master实例帮其他实例做完所有的事情。这样就不会出现任何遗留问题和其他操作的冲突。但是也存在一些比较难实现的问题：一是帮其他实例切换日志这个操作不一定能够完成，如果当前实例的所有redo还未归档，那么将无法切换日志文件，master实例需要为其他实例的redo归档，这个操作会很复杂。二是master实例帮其他实例写redo文件，当前写redo文件的这一套逻辑并不适合，所以需要单独适配组装redo日志的逻辑，所以方案一的实现比较复杂。
- 方案二操作简单，只需要修改其他实例的instance ctrl，标识该实例没有完成reset logs。待其他实例open时，自己完成reset logs操作。但是该方案会存在隐患，就是后续的各种操作需要适配，根据场景定制适配方案。需要适配的有：在线恢复、主备倒换、故障转移以及手动降备等。

总结对比，个人觉得方案二更合适。

#### **5.1.3 归档日志截断**

哪些场景需要截断日志：

1. 某实例丢失部分日志，其他实例的redo日志依赖这部分日志，所以回放时该实例的redo不能全部回放，需要丢弃这部分redo。
1. 执行pitr恢复，恢复到指定时间点，redo日志的回放就暂停了，未回放的日志需要丢弃。


**日志截断后，需要 “丢弃” 的日志不做特殊处理，后续回放了这部分日志，会导致数据库出现各种不可预料的故障。**

如何处理需要 “丢弃“ 的日志：

1. 直接reset掉：这种方式不可取，也许只是本次回放该日志需要丢弃，如果直接reset掉，则无法挽回。并且归档日志文件不能直接reset掉。该方案不可取。
1. 记录截断点：持久化截断点，回放到该日志时需要跳过。该方案是可采取的。


所有的截断点都是大于等于数据库的flush point点（持久化到ctrl中的flush point），所以每个实例只需要记录一个truncPoint字段。

当数据库的rcyBegin点大于trunc Point时，该值就可以初始化为0-0-0-0了。

###   [5.2 Y](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)    ASRMAN语法支持

yasrman的语法包含了sql的三个语法功能，执行完成后，数据库直接open，如果中途失败整个流程失败。

主要实现就是语法解析和DB实现的接口调用。

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

该需求需要在instance ctrl上新增字段，需要考虑22.2以及23.1使用的字段，该需求需要预留字段对齐，避免出现升级后，持久化的信息不兼容。

###   [5.4 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

1. 在线恢复需要适配，如果某实例没有完成resetlogs，加入集群不做在线redo重演，避免回放截断的日志。
1. 后续主备需求特性需要适配该特性。


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|测试场景|预期|
|---|---|
|指定的SCN小于当前备份集的一致性SCN（可以通过DBA_BACKUP_SET获取）。|报错，指定的SCN不能小于一致性SCN|
|指定的SCN大于当前归档的最大SCN（可以查看v$ARCHIVED_LOG获取）。|报错，不能回放到指定的scn。|
|指定的时间小于当前备份集的一致性时间（可以通过DBA_BACKUP_SET获取）。|报错，指定的时间不能太早。|
|指定的时间大于当前归档的最大时间（可以查看v$ARCHIVED_LOG获取）。|报错，不能回放到指定的scn。|
|不完全恢复后，不指定RESETLOGS|报错，必须指定RESETLOGS|
|不完全恢复后，不指定RESETLOGS报错后，再执行alter database open resetlogs。|成功|
|yasminer -c执行restore database语法，丢失关键字等语法测试。|报错|
|yasminer -c执行失败后，清理数据库，指定正确的时间点。|回复成功。|


测试场景示例：

1. OM搭建集群（开归档）
1. 执行一点业务，做个全量备份(backup database format 'bak1')
1. 继续执行业务，中途记录时间点（或scn）(select current_scn from v$database;)
1.  查询当前数据量。
1.  所有实例依次执行alter system archive log current，保证归档生成
1.  通过OM提供的命令，关集群，删除ctrl，data文件,redo文件，保留归档，然后nomount所有实例（这些是OM的命令搞定），保留归档，然后nomount所有实例（这些是OM的命令搞定）
1.  连接master实例（正常是1号），执行restore，recover until 时间点，alter database open resetlogs
1.  此时只是master实例open，接着把其他实例依次open
1.  PITR恢复完成，检查数据量是否达到预期。


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. 修改yasrman的语法。
1. 新增错误码
1. 修改recover database中的描述


##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1. *如果某实例有日志丢失（与其他实例无关的事务，且事务早于指定SCN），PITR的恢复可能会丢失该实例的部分数据。（用户尽可能保证日志不丢失）。*


## Attachments:

[image2023-11-3_10-39-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2JhMWFkOWEzMzExZGM4OGJhIiwicmVmX2lkIjoiNjczOTZjM2I3MjgyMDZlZmI5MmYwZjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5OTI1LCJleHAiOjE3ODIzODYzMjV9.3dlsFUxGBysi0DkiTBOmx6hk8oodYqdtzyq_Q2dpk3U)

 (image/png)    


[最大保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2JhMWFkOWEzMzExZGM4OGJjIiwicmVmX2lkIjoiNjczOTZjM2I3MjgyMDZlZmI5MmYwZjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5OTI1LCJleHAiOjE3ODIzODYzMjV9.xd682NXxOZSiYUSqLEAGQbRxyjIVoSGw8CMyv8n37dA)

 (image/png)    


[Switchover.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2JhMWFkOWEzMzExZGM4OGJkIiwicmVmX2lkIjoiNjczOTZjM2I3MjgyMDZlZmI5MmYwZjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5OTI1LCJleHAiOjE3ODIzODYzMjV9.whE5zFFtrnzN7RIHVBnshu98EiRHnbpeUWlH4o3lIrg)

 (image/png)    


[image2023-4-25_9-56-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2JhMWFkOWEzMzExZGM4OGJlIiwicmVmX2lkIjoiNjczOTZjM2I3MjgyMDZlZmI5MmYwZjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5OTI1LCJleHAiOjE3ODIzODYzMjV9.tATDeEKu2qyvw32mp4Bbd2BgZv2wt5HdCuO4WC3OyIQ)

 (image/png)    


[send_point.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2I4OTcwYzJhZjRmNTIwYTRlIiwicmVmX2lkIjoiNjczOTZjM2I3MjgyMDZlZmI5MmYwZjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5OTI1LCJleHAiOjE3ODIzODYzMjV9.7T712Kkl2mn5DnIhS_Ugl3Mejw0HJfjkx9kNx6Lm5MQ)

 (image/png)    


[quorum.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2JhMWFkOWEzMzExZGM4OGJmIiwicmVmX2lkIjoiNjczOTZjM2I3MjgyMDZlZmI5MmYwZjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5OTI1LCJleHAiOjE3ODIzODYzMjV9.ucDD6_tJrUPtmryfRMEDES0rrkrd15-C3zFs1FFsNpQ)

 (image/png)    
