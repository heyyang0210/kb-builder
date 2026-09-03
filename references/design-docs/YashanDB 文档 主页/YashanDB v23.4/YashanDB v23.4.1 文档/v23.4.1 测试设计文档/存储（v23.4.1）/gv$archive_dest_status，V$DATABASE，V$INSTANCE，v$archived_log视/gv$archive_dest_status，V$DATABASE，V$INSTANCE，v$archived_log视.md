Created by 高亚宁, last modified on 十月 30, 2024

# 1.   **概述**

-   [1. 概述](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-1.概述)  
-   [2. 需求分析](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-2.需求分析)  
-   [3. 测试设计方法](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-3.测试设计方法)  
-   [4. 详细测试设计](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-4.详细测试设计)  
-   [5. 测试用例设计](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-5.测试用例设计)  
-   [6. 测试框架设计](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-7.测试环境说明)  
-   [8. 测试工作量评估](#gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log视图优化测试设计-8.测试工作量评估)  


本文描述gv$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log等视图新增字段的测试设计

# 2.   **需求分析**

**研发设计文档**  ：    [动态视图字段补齐 - YashanDB 文档 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=171081072)  

  [https://pingcode.yasdb.com/pjm/items/67073de0e489dd0868f3695c](https://pingcode.yasdb.com/pjm/items/67073de0e489dd0868f3695c)    ?    
  #YDBRD-33759 gv$archive_dest_status新增db_unique_name,dest_name字段

需求来源： 监控适配

 场 景：/*NDTM*/WITH primary AS ( SELECT thread#, MAX(sequence#) maxsequence FROM v$archived_log WHERE archived = 'YES' AND resetlogs_change# = (SELECT d.resetlogs_change# FROM v$database d) GROUP BY thread# ORDER BY thread#), standby AS ( SELECT thread#, MAX(sequence#) maxsequence FROM v$archived_log WHERE applied = 'YES' AND resetlogs_change# = (SELECT d.resetlogs_change# FROM v$database d) GROUP BY thread# ORDER BY thread#), no_applied_seq AS ( SELECT primary.thread#, primary.maxsequence pry_arch_logseq, NVL(standby.maxsequence, 0) stby_apply_logseq, primary.maxsequence - NVL(standby.maxsequence, 0) no_applied_log FROM primary, standby WHERE primary.thread# = standby.thread#(+) ), gap_info AS ( SELECT inst_id, db_unique_name, dest_id, dest_name, status FROM gv$archive_dest_status WHERE status = 'VALID' AND type = 'PHYSICAL') SELECT gi.inst_id, gi.db_unique_name, gi.dest_name, gi.status, '-' trans_gap, nas.pry_arch_logseq primary_seq, nas.stby_apply_logseq standby_seq, nas.no_applied_log applied_gap FROM no_applied_seq nas, gap_info gi WHERE nas.thread# = gi.inst_id ORDER BY gi.inst_id

需求描述： gv$archive_dest_status新增db_unique_name,dest_name字段，包含v$archive_dest_status和dv$archive_dest_status 

需求范围：单机、集群和分布式

需  求规格：/

  


  [https://pingcode.yasdb.com/pjm/items/670733c6e489dd0868f34531](https://pingcode.yasdb.com/pjm/items/670733c6e489dd0868f34531)    ?    
  #YDBRD-33722 V$DATABASE，V$INSTANCE视图新增字段

需求来源： 监控适配

 场 景：/*NDTM*/SELECT I.INST_ID, D.NAME, I.VERSION, D.CREATED, D.DBID ORACLEID, I.STARTUP_TIME, I.DATABASE_STATUS, D.LOG_MODE, D.DATABASE_ROLE, D.PLATFORM_NAME FROM GV$DATABASE D, GV$INSTANCE I WHERE D.INST_ID = I.INST_ID AND ROWNUM = 1 ORDER BY INST_ID 

需求描述： V$DATABASE，V$INSTANCE视图新增字段 

需求范围：单机、集群和分布式

需求规格： 

1、V$DATABASE新增INST_ID字段

2、对齐ORACLE字段字段名称不一致： 

V$INSTANCE：    
  INSTANCE_NUMBER（INST_ID） ，新增DATABASE_STATUS字段 

对齐或者新增 V$DATABASE 字段： 

崖山：DATABASE_NAME（ORACLE：NAME） 

崖山：CREATE_TIME（ORACLE：CREATED）

崖山：DATABASE_ID（ORACLE：DBID）

v$database新增resetlogs_change#字段

  


  [https://pingcode.yasdb.com/pjm/items/67073318e489dd0868f343e3](https://pingcode.yasdb.com/pjm/items/67073318e489dd0868f343e3)    ?    
  #YDBRD-33715 v$archived_log支持archived、status和deleted字段

开发文档：

需求来源：  监控适配

需求范围：  单机、分布式和集群

场景：/*NDTM*/ SELECT NAME, BLOCKS*BLOCK_SIZE AS BLOCKS, COMPLETION_TIME FROM v$archived_log WHERE (( '%%%' LIKE '"%"' AND name LIKE SUBSTR('%%%',3,LENGTH('%%%')-4)) OR ( '%%%' NOT LIKE '"%"' AND UPPER(name) LIKE UPPER('%%%'))) AND status NOT IN ('X', 'D', 'U') AND deleted='NO' ORDER BY COMPLETION_TIME

需求描述  ：  v$archived_log支持archived、status和deleted字段，同步支持gv$archived_log和dv$archived_log

# 3.   **测试设计方法**

1. 视图字段的正确性，  使用场景法和错误推测法设计
1. 覆盖单机、集群、分布式三种部署形态
1. 覆盖升级场景：23.2的归档版本到最新转测版本
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|涉及|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|涉及|


# 4.   **详细测试设计**

测试观测点：

- 字段名称正确
- 构造不同的场景，观测字段的值是否正确


|  
|视图需求|部署形态|测试场景|预期|备注|
|---|---|---|---|---|---|
|1|v$database视图 新增字段：name、created、dbid,resetlogs_change#,name：数据库的名称,created：建库时间,dbid：数据库的id标识,resetlogs_change#：执行resetlogs时，最后一次系统修改序号，即scn,1. 该字段显示数值为scn，为执行过reset log操作时，该字段显示为null
1. 该字段同reset point一致，需要持久化，更新reset point时将当前数据库的scn设置为resetlogs_change#。(可以对比reset point对应归档的firstChange#);
|单机|desc V$DATABASE，查看是否有  INST_ID、resetlogs_change#、NAME、CREATED、DBID字段，字段的类型是否和设计中一致|V$DATABASE  会新增  resetlogs_change#、NAME、CREATED、DBID  字段，GV$DATABASE还会新增INST_ID，字段类型正确|所有的gv视图都有inst_id字段|
|2|  
|  
|查询视图，检查  INST_ID、resetlogs_change#、NAME、CREATED、DBID字段的值是否正确|字段值正确|  
|
|3|  
|  
|resetlogs_change#测试：构造pitr恢复成功后，查看resetlogs_change#是否是能恢复到的最大的那个scn|pitr恢复成功，resetlogs_change#是能恢复到的最大的那个scn|  
|
|4|  
|集群|覆盖以上场景（测试g  V$DATABASE、V$DATABASE  ）|g  V$DATABASE显示所有实例的汇总信息,V$DATABASE只显示当前实例的汇总信息|  
|
|5|  
|分布式|覆盖以上场景（测试g  V$DATABASE、V$DATABASE、dv$DATABASE  ）|g  V$DATABASE显示所有实例的汇总信息,V$DATABASE只显示当前实例的汇总信息,dv$DATABASE保持现状|把DV迁移到GV，不再给dv加字段|
|6|v$instance视图新增字段：  DATABASE_STATUS，该字段表示当前数据库的状态，  总共两个状态：,- active：正常状态
- instance recovery：当前实例正在执行reform，跟in_reform保持一致。
|单机|desc V$INSTANCE，查看是否有DATABASE_STATUS  字段，字段的类型是否和设计中一致|V$INSTANCE  会新增  DATABASE_STATUS  字段，字段类型正确|  
|
|7|  
|  
|DATABASE_STATUS字段测试：kill集群中的某个实例，查询V$INSTANCE|DATABASE_STATUS的值为instance recovery|  
|
|8|  
|集群|覆盖以上场景（测试g  V$INSTANCE、V$INSTANCE  ）|g  V$INSTANCE显示所有实例的汇总信息,V$INSTANCE只显示当前实例的汇总信息|  
|
|9|  
|分布式|覆盖以上场景（测试g  V$INSTANCE、V$INSTANCE、dv$INSTANCE  ）|g  V$INSTANCE显示所有实例的汇总信息,V$INSTANCE只显示当前实例的汇总信息,dv$INSTANCE保持现状|  
|
|10|v$archived_log新增字段：archived、status、deleted    
,archived：在线redo是否已经归档,status：归档的状态,deleted：归档是否被删除|单机|desc V$archived_log，查看是否有archived、status和deleted字段  ，字段的类型是否和设计中一致|V$archived_log  会新增  archived、status和deleted  字段，字段类型正确|这三个字段的内容都为固定值,1. STATUS：A （  Available  ）
1. ARCHIVED：YES
1. DELETED：NO
|
|11|  
|  
|archived、status和deleted字段测试：检查字段的值是否正确|字段值正确，与设计一致|  
|
|12|  
|集群|覆盖以上场景（测试g  V$archived_log、V$archived_log  ）|g  V$archived_log显示所有实例的汇总信息,V$archived_log只显示当前实例的汇总信息|  
|
|13|  
|分布式|覆盖以上场景（测试g  V$archived_log、V$archived_log、dv$archived_log  ）|g  V$archived_log显示所有实例的汇总信息,V$archived_log只显示当前实例的汇总信息,dv$archived_log保持现状|  
|
|14|v$archive_dest_status新增字段：dest_name、db_unique_name    
,dest_name：链路的名称,db_unique_name：主库对备库的唯一别名|单机|desc V$archive_dest_status，查看是否有db_unique_name,dest_name字段  ，字段的类型是否和设计中一致|V$archive_dest_status  会新增  db_unique_name,dest_name  字段，字段类型正确（与x$archive_dest中的一致）|  
|
|15|  
|  
|db_unique_name,dest_name字段测试：    
  alter system set ARCHIVE_DEST_2 = '';    
  alter system set ARCHIVE_DEST_2 = 'SERVICE=127.0.0.1:2804 DB_UNIQUE_NAME=standby4qweeeeeeeeeeeeeeeeeeeeq';    
  检查字段的值是否与配置一致|字段值正确，与配置的一致|  
|
|16|  
|集群|覆盖以上场景（测试g  V$archive_dest_status、V$archive_dest_status  ）|g  V$archive_dest_status显示所有实例的汇总信息,V$archive_dest_status只显示当前实例的汇总信息|  
|
|17|  
|分布式|覆盖以上场景（测试g  V$archive_dest_status、V$archive_dest_status、dv$archive_dest_status  ）|g  V$archive_dest_status显示所有实例的汇总信息,V$archive_dest_status只显示当前实例的汇总信息,dv$archive_dest_status保持现状|  
|
|18|升级|单机|从br23.2归档包升级到最新转测版本，升级前后分别查看v$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log等视图中的字段|升级后v$archive_dest_status，V$DATABASE，V$INSTANCE，v$archived_log等视图会新增字段|  
|
|19|/|/|资料测试|  
|  
|


# 5.  ** **  **测试用例设计**

文本用例

# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 8.   **测试工作量评估**

6人天：

测试设计+评审 1

测试执行+上车 3+2

  


  


## Attachments:

[image2024-10-25_12-2-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmNhMWFkOWEzMzExZGM5YjU0IiwicmVmX2lkIjoiNjczOTZlZmM1OTNmOTljOWZmMjM4YmJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NzMyLCJleHAiOjE3ODI1NDUxMzJ9.f0rB8nDGD32lQWpVqu5MGS78mpYyw_WmrEuShkUsnw4)

 (image/png)    


[image2024-10-25_11-32-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmM4OTcwYzJhZjRmNTIxY2UyIiwicmVmX2lkIjoiNjczOTZlZmM1OTNmOTljOWZmMjM4YmJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NzMyLCJleHAiOjE3ODI1NDUxMzJ9.0CbETojN2FlVDzSsTBuUOhT_Crk7HP49mTA8l0FLjxM)

 (image/png)    


[dump and trace测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmNhMWFkOWEzMzExZGM5YjU1IiwicmVmX2lkIjoiNjczOTZlZmM1OTNmOTljOWZmMjM4YmJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NzMyLCJleHAiOjE3ODI1NDUxMzJ9.Z0T0lxsV-OUzVW5e7kt_6WGReP5OfOIfRW3YUKQ8tGo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[ADR测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmNhMWFkOWEzMzExZGM5YjU2IiwicmVmX2lkIjoiNjczOTZlZmM1OTNmOTljOWZmMjM4YmJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NzMyLCJleHAiOjE3ODI1NDUxMzJ9.FMZM-xY_aTY8kOaBtah1GzAm0mEeOa1dLiuS5ki9qsQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[自动故障事件框架.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmM4OTcwYzJhZjRmNTIxY2UzIiwicmVmX2lkIjoiNjczOTZlZmM1OTNmOTljOWZmMjM4YmJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NzMyLCJleHAiOjE3ODI1NDUxMzJ9.jcqhPgZIHNq2Xz-JX26yvI2iaZDeCg7kEKWpvWhm4zY)

 (application/vnd.xmind.workbook)    
