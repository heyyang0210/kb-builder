Created by 张彩虹, last modified on 十月 11, 2024

# **1. 概述**

本文描述DBA_EXTETS和USER_EXTETS视图相关测试设计

# **2. 需求分析**

当磁盘空间不足，且表空间的数据文件上存在大量空洞，可以通过shrink space缩小数据文件的方式释放磁盘空间。 shrink space只能释放文件高水位线以上的空间，需要先压缩空洞，降低文件的高水位线，shrink space才能有效果。 压缩空洞的方法有：

- shrink table： 可以将表上的extent还给表空间，但是不能保证能降低表空间数据文件的高水位线
- 重建表/索引： 重建表可以通过create table as select + rename table实现
- move table：当前还不支持该功能


如何确定要shrink哪张表或者重建哪张表，需要先确认文件的高水位线附近的extent属于哪个对象。

通过DBA_EXTETS查看每一个extent所属的对象信息，extent的起始位置，大小。 通过该视图可以查到某个数据文件的高水位线上的extent属于哪个对象。

通过USER_EXTETS查看当前用户的每一个extent所属的对象信息，extent的起始位置，大小。

## **2.1 功能点分析**

SR链接：    [https://pingcode.yasdb.com/pjm/items/66bdc5ad8f5ee191734e20b7](https://pingcode.yasdb.com/pjm/items/66bdc5ad8f5ee191734e20b7)    ?    
  #YDBRD-31630 支持DBA_EXTENTS视图

开发方案文档：    [DBA_EXTENTS](DBA_EXTENTS_163015587.html)  

  


该需求主要是针对DBA_EXTETS和USER_EXTETS视图进行测试，重点从以下两方面进行验证：

- 包含所有数据库对象的extent信息改视图是否可正常显示
- 显示结果对比  DBA_SEGMENTS、v$tablespace、v$datafile中数据是否正确


## **2.3 规格约束**

DBA_EXTENTS不能显示以下信息：

- TEMP/SWAP/UNDO表空间的信息
- 不能显示回收站里的对象的extent信息。


# **3. 详细测试设计**

## **3.1 测试设计方法**

**主要使用等价类和场景分析法进行测试：**

1、包含所有数据库对象

2、验证各个场景下数据显示是否正确

## **3.2 详细测试设计**

1、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|涉及|
|性能|不涉及|
|可维护性|涉及|


**数据库对象**

|编号|数据库对象|子场景描述|预期|备注|责任人|  
|
|:---|---|:---|:---|:---|---|---|
|1|索引|普通索引|成功|  
|张彩虹|test_sdv_cluster_dba_extents_002|
|2||唯一索引|成功|  
|张彩虹|test_sdv_cluster_dba_extents_003|
|3||组合索引|成功|  
|张彩虹|test_sdv_cluster_dba_extents_004|
|4||函数索引|成功|  
|张彩虹|test_sdv_cluster_dba_extents_005|
|5||列式索引|成功|  
|张彩虹|test_sdv_cluster_dba_extents_006|
|6||分区索引|成功|  
|张彩虹|test_sdv_cluster_dba_extents_007|
|7||lob索引（clob&blob）|成功|  
|张彩虹|test_sdv_cluster_dba_extents_008|
|8|行表|heap表（行表 TP业务使用）|成功|  
|张彩虹|在上面索引场景中已包含|
|9|  
|heap延迟创建|  
|  
|张彩虹|test_sdv_cluster_dba_extents_009|
|10|列表|LSC表|成功|只适用单机|易文亮|  
|
|11||TAC表|成功|只适用单机|易文亮|  
|
|12|分区|range分区|成功|  
|张彩虹|test_sdv_cluster_dba_extents_010|
|13||list分区|成功|  
|张彩虹|test_sdv_cluster_dba_extents_011|
|14||hash分区|成功|  
|张彩虹|test_sdv_cluster_dba_extents_012|
|15||interval|成功|  
|张彩虹|test_sdv_cluster_dba_extents_013|
|16||带索引分区|成功|  
|张彩虹|test_sdv_cluster_dba_extents_007|
|17||带lob分区（clob&blob）|成功|  
|张彩虹|test_sdv_cluster_dba_extents_008|
|18||二级分区|成功|  
|张彩虹|test_sdv_cluster_dba_extents_014|
|19|回收站|开启|数据库对象进入回收站不显示|  
|张彩虹|test_sdv_cluster_dba_extents_021|
|20||关闭|成功|  
|张彩虹|默认都为关闭|
|21|视图|物化视图|成功|  
|张彩虹|test_sdv_sa_dba_extents_015|
|22|约束|主键约束|成功|  
|张彩虹|test_sdv_cluster_dba_extents_016|
|23||外键约束|成功|  
|张彩虹|test_sdv_cluster_dba_extents_016|
|24||唯一约束|成功|  
|张彩虹|test_sdv_cluster_dba_extents_016|
|25|表空间    
    
|共享临时表空间|视图不显示|  
|张彩虹|test_sdv_cluster_dba_extents_017|
|26||本地临时表空间|视图不显示|  
|张彩虹|test_sdv_cluster_dba_extents_018|
|27||正常表空间  （固定扩展和动态扩展）|成功|  
|张彩虹|前面006-008都包含|
|28|AC|带btree的AC|成功|  
|易文亮|  
|
|29|  
|延迟创建AC|成功|  
|易文亮|  
|


**视图字段校验**

|字段|字段类型|描述|预期|备注|
|:---|:---|:---|---|---|
|OWNER|VARCHAR(64)|extent所属对象的用户名|显示extent对象所属用户名|  
|
|SEGMENT_NAME|VARCHAR(64)|extent所属的segment名|显示extent对象所属segment名|  
|
|PARTITION_NAME|VARCHAR(64)|extent所属的分区名|显示extent对象所属分区名|  
|
|SEGMENT_TYPE|VARCHAR(18)|extent所属的segmen类型|显示extent对象所属segmen类型|  
|
|TABLESPACE_NAME|VARCHAR(64)|extent所属的表空间名|显示extent对象所属表空间名|  
|
|EXTENT_ID|BIGINT|extent在segment内的ID|显示extent对象segment内的ID|  
|
|FILE_ID|BIGINT|extent所属的文件ID|显示extent对象所属文件ID|  
|
|BLOCK_ID|BIGINT|extent所属的BLOCK ID|显示extent对象BLOCK ID|  
|
|BYTES|BIGINT|extent的字节大小|显示extent字节大小|  
|
|BLOCKS|BIGINT|extent的Block数|v$datafile中BLOCK_COUNT-USED_BLOCKS-128|  
|


**场景测试（默认关闭回收站）**

|编号|测试场景|子场景描述|预期|备注|  
|
|:---|---|:---|:---|:---|---|
|1|DDL/DML|create数据库对象  ——页面大小16K和32K|DBA_EXTETS和USER_EXTETS视图可正确显示对象信息|张彩虹、  易文亮|表空间大小|
|2||insert插入数据（冷热数据并存）  ——热数据转冷数据（视图应该会有变化）,开发确认后：热传冷以后热数据会garbage，所以segment会变少；然后compact是不变的|DBA_EXTETS和USER_EXTETS视图可正确显示对象信息|张彩虹、  易文亮|  
|
|3||LSC slice合并清理|合并前后数据有变化|易文亮|  
|
|4||tablespace datafile  offline/offline|查询视图为空|张彩虹|test_sdv_cluster_dba_extents_007|
|5||delete删除数据|DBA_EXTETS和USER_EXTETS视图可正确显示对象信息|张彩虹、  易文亮|每个用例都有覆盖|
|6||truncate数据库对象|DBA_EXTETS和USER_EXTETS视图可正确显示对象信息|张彩虹、  易文亮|每个用例都有覆盖|
|7||drop数据库对象|DBA_EXTETS和USER_EXTETS视图中清空对象信息|张彩虹、  易文亮|每个用例都有覆盖|
|8||shrink space|shrink前后视图数据有变化|张彩虹、  易文亮|  
|
|9||分区操作（add partion、split partion、drop partion ）|DBA_EXTETS和USER_EXTETS视图可正确显示对象信息|张彩虹|每个用例都有覆盖|
|10||AC失效|失效前后视图数据有变化|易文亮|  
|
|11||索引操作（重建索引、失效索引）|索引失效  DBA_EXTETS和USER_EXTETS视图中清空失效索引信息；重建后可正常显示索引信息|张彩虹|test_sdv_cluster_dba_extents_006|
|12||大数据量（多个extent map）——超过500extent(dump工具）|DBA_EXTETS和USER_EXTETS视图可正确显示对象信息|张彩虹、  易文亮|每个用例都有覆盖|
|13|CT|各个实例并发查询视图（后台对象非动态）|每个实例内容显示一致|张彩虹|  
|
|14||各个实例DML/DDL业务和查询视图并发|实例不core不卡（testkill）|张彩虹|  
|
|15|KT    
    
    
    
|kill集群master实例db进程，其他实例查询视图|成功|张彩虹|  
|
|16||kill集群master实例ycs进程，其他实例查询视图|成功|张彩虹|  
|
|17||kill集群非master实例db进程，其他实例查询视图|成功|张彩虹|  
|
|18||kill集群非master实例ycs进程，其他实例查询视图|成功|张彩虹|  
|
|19||kill执行查询视图实例db/ycs进程|报错|张彩虹|  
|
|20|权限|sys用户|可以查到所有用户下extent信息|张彩虹|  
|
|21||普通用户|只能查到自己用户下的extent信息|张彩虹|  
|
|22|升级|升级后seg$ 、DBA_EXTETS系统表显示是否正确；|  
|张彩虹|  
|


# **4. 测试用例**

冒烟用例

|序号|测试场景|预期|
|---|:---|:---|
|1|创建行表进行DDL/DML操作|视图可正确显示对象extent信息|
|2|创建列表进行DDL/DML操作|视图可正确显示对象extent信息|
|3|DBA_EXTETS和USER_EXTETS权限控制|权限正常|


自动化用例MR：

LSC、TAC：

  [https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_saTXcDNb&theme=YDBRD-31630+lsc%E5%8D%95%E6%9C%BA%E7%94%A8%E4%BE%8B](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_saTXcDNb&theme=YDBRD-31630+lsc%E5%8D%95%E6%9C%BA%E7%94%A8%E4%BE%8B)      
    [https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_igJMf8Ld&theme=YDBRD-31630+tac%E5%8D%95%E6%9C%BA%E7%94%A8%E4%BE%8B](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_igJMf8Ld&theme=YDBRD-31630+tac%E5%8D%95%E6%9C%BA%E7%94%A8%E4%BE%8B)      
    [https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_y43xB6wA&theme=YDBRD-31630+lsc%E5%88%86%E5%B8%83%E5%BC%8F%E7%94%A8%E4%BE%8B%E4%B8%8A%E5%BA%93](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_y43xB6wA&theme=YDBRD-31630+lsc%E5%88%86%E5%B8%83%E5%BC%8F%E7%94%A8%E4%BE%8B%E4%B8%8A%E5%BA%93)      
    [https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_MK06nm2Z&theme=YDBRD-31630+tac%E5%88%86%E5%B8%83%E5%BC%8F%E7%94%A8%E4%BE%8B%E4%B8%8A%E5%BA%93](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_MK06nm2Z&theme=YDBRD-31630+tac%E5%88%86%E5%B8%83%E5%BC%8F%E7%94%A8%E4%BE%8B%E4%B8%8A%E5%BA%93)  

HEAP：

  [https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_25HOly5s&theme=YDBRD-31630+%E6%94%AF%E6%8C%81DBA_EXTENTS%E8%A7%86%E5%9B%BE%E7%94%A8%E4%BE%8B%E4%B8%8A%E8%BD%A6](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_25HOly5s&theme=YDBRD-31630+%E6%94%AF%E6%8C%81DBA_EXTENTS%E8%A7%86%E5%9B%BE%E7%94%A8%E4%BE%8B%E4%B8%8A%E8%BD%A6)  

HA主备：

  [https://git.yasdb.com/cod-test/yasft/-/merge_requests/10322](https://git.yasdb.com/cod-test/yasft/-/merge_requests/10322)  

testkill用例：

  [https://git.yasdb.com/cod-x/yastest_dfx/-/merge_requests/4307](https://git.yasdb.com/cod-x/yastest_dfx/-/merge_requests/4307)  

  


【上车分析记录】

上车链接：    [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5438/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5438/)  

  


|序号|工程名称|失败原因|修改方法|  
|last_fail执行结果|
|:---|---|:---|:---|:---|:---|
|  
|  [Agile_L2_sa_lsc_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/5345/)  |用例不稳定|  
|lastfail-5351|已绿|
|  
|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4449/)  |tag过低导致，需打到23.2.6.0及以上|  
|  
|pass|
|  
|  [Agile_L2_sa_tac_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/5272/)  |alter database   **switchover --faild**|  
|  
|已绿|
|  
|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4297/)  |  [https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_PJTvE9nI&runId=ci_record_zZ0JWB60&lastRunId=ci_record_0LnD5rGC](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_PJTvE9nI&runId=ci_record_zZ0JWB60&lastRunId=ci_record_0LnD5rGC)  |  
|lastfail-4309|  
|
|  
|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3652/)  |YAS  -  06511   failed   to     allocate     516112   bytes, ColumnarVmBuffer   is     not   enough|  
|lastfail-3664|已绿|
|  
|  [Agile_L2_sa_heap_HA_5_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/4940/)  |**select count(*) from sandbox_standby_scene_01**|  
|lastfail-4947|已绿|
|  
|  [Agile_L2_sa_FT_yasldr_3](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_3/3969/)  |范瑜确认中--lastfail|  
|lastfail-3976|已绿|
|  
|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/3862/)  |  [https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_kwczgXIj&runId=ci_record_BBvtlZQW&lastRunId=ci_record_QuorCD8j](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_kwczgXIj&runId=ci_record_BBvtlZQW&lastRunId=ci_record_QuorCD8j)  |  
|lastfail-3875,tablespace   'TBS_YDBRD_22234_AC_PARTITON_001'   does   not   exist--需确认|  
|
|  
|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3157/)  |  [https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_ZYgtIG7f&runId=ci_record_K5dsTghw&lastRunId=ci_record_9DkUyF1s](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_ZYgtIG7f&runId=ci_record_K5dsTghw&lastRunId=ci_record_9DkUyF1s)  |  
|lastfail-3170    
    [https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_ZYgtIG7f&runId=ci_record_sn5T7Eiv&lastRunId=ci_record_ZuXV9OBs&activity=FT](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_ZYgtIG7f&runId=ci_record_sn5T7Eiv&lastRunId=ci_record_ZuXV9OBs&activity=FT)     --刷预期|  
|
|  
|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3756/)  |超时|  
|重跑normal    [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3773/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3773/)      
  lastfail：    [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_cluster_case_arm/3775/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_cluster_case_arm/3775/)  |  
|
|  
|  [Agile_L2_cluster_yasft_yfs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3151/)  |起ycs超时|  
|#3159|已绿|
|  
|  [Agile_L2_cluster_FT_install_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/728/)  |tag过低导致，需打到23.2.6.0及以上|  
|  
|pass|
|  
|  [Agile_L2_cluster_backup_arm_3](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1680/)  |并发用例不稳定|  
|#1687|已绿|


# **5. 测试框架设计**

本次测试使用guider框架  实现

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群、分布式|


# **7、工作量评估**

总计 11人天

测试设计+评审  2人天

测试 6人天

自动化+调试稳定 2人天

上车分析 1人天

## Attachments:

[集群支持手动failover文本测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjhhMWFkOWEzMzExZGM5NDllIiwicmVmX2lkIjoiNjczOTZkZjg1OTNmOTljOWZmMjM4MTI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMjE4LCJleHAiOjE3ODIzOTk2MTh9.H8GQld0T3b9nv-TJuF0zXZLqxjqpIQ8_7BdsN0yEwWE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
