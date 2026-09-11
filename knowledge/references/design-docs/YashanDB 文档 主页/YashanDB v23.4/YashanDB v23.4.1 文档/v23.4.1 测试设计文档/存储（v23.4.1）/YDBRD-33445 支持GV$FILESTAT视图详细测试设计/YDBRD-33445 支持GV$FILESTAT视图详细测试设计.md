IR链接：  [https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c0a2?](https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c0a2?)  

#YASHAN-1430  支持GV$FILESTAT视图

SR链接：  [https://pingcode.yasdb.com/pjm/items/6704aa04e489dd0868f1988c?](https://pingcode.yasdb.com/pjm/items/6704aa04e489dd0868f1988c?)  

#YDBRD-33445 支持GV$FILESTAT视图  
开发设计文档：  [(21) 新增v$FILESTAT 和dba_data_files、dba_tablesapces字段名兼容Oracle | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/677b89abea9f2a287093e532)  

# 1. 概述

支持V$FILESTAT和GV$FILESTAT视图，记录各文件的物理I/O信息，可用于分析发生的I/O事件，包含物理读写数、块读写数、I/O读写总耗时。

# 2. 需求分析

## 2.1 需求场景

/*NDTM*/ SELECT D.INST_ID, D.NAME, 

  				F.PHYRDS, F.PHYBLKRD, F.PHYWRTS, F.PHYBLKWRT, F.READTIM * 10 as READTIM, F.WRITETIM * 10 as WRITETIM 

                FROM GV$FILESTAT F, GV$DATAFILE D 

                WHERE F.FILE# = D.FILE# AND F.INST_ID = D.INST_ID ORDER BY F.PHYRDS DESC, F.PHYWRTS DESC；

## 2.2 视图字段说明

|编号|列名|类型|说明|备注|
|---|---|---|---|---|
|1|FILE#|INTEGER|文件编号|同V$DATAFILE的ID字段|
|2|PHYRDS|BIGINT|完成的物理读取次数||
|3|PHYWRTS|BIGINT|DBWR 需要写入的次数||
|4|PHYBLKRD|BIGINT|读取的物理块数||
|5|PHYBLKWRT|BIGINT|PHYWRTS写入磁盘的块数||
|6|SINGLEBLKRDS|BIGINT|单块读取次数||
|7|READTIM|BIGINT|执行读取所花费的时间（以百分之一秒为单位）||
|8|WRITETIM|BIGINT|执行写入所花费的时间（以百分之一秒为单位）||
|9|SINGLEBLKRDTIM|BIGINT|累计单块读取时间（以百分之一秒为单位）||
|10|AVGIOTIM |BIGINT| I/O 所花费的平均时间（以百分之一秒为单位）||
|11|LSTIOTIM |BIGINT|执行最后一次 I/O 所花费的时间（以百分之一秒为单位）||
|12|MINIOTIM|BIGINT|单个 I/O 所花费的最短时间（以百分之一秒为单位）||
|13|MAXIORTM|BIGINT|执行单次读取所花费的最长时间（以百分之一秒为单位）||
|14|MAXIOWTM|BIGINT|执行单次写入所花费的最长时间（以百分之一秒为单位）||


## 2.3 应用场景

统计各文件的物理I/O信息，可用于分析发生的I/O事件，包含物理读写数、块读写数、I/O读写总耗时。

## 2.4 规格约束

- 交付形态：单机、分布式、集群
- 规格约束：


        1）filestat仅统计业务的IO使用情况，对于数据文件创建或者删除，文件扩展时的IO不做统计；

        2） yasrman备份以及backup备份产生的IO也不做统计;

        3）mount状态下可以查询。

# 3. 详细测试设计

## 3.1 测试设计方法

主要使用等价类和场景分析法进行测试：

1、针对不同的数据文件构造业务，验证不同文件统计的IO信息是否准确；

2、无效等价类场景下，视图中IO信息与原来保持一致。

## 3.2 详细测试设计

#### 3.2.1  使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式

|编号|测试项|测试场景|测试步骤|备注|
|---|---|---|---|---|
|1|不同数据文件+业务|普通表空间+dml业务+ddl业务|1、创建普通表空间，查看视图,2、创建表，并且插入数据，执行dml业务，查看视图变化，继续插入数据扩展文件，查看数据文件,3、对表空间执行ddl业务，查看视图,1）alter tablespace add/drop datafile/databucket,2）alter database resize datafile,3）alter tablespace shrink space,4）alter tablespace online/offline,5）alter tablespace rename to,4、删除表空间，查看视图||
|2||临时表空间+dml业务+ddl业务|1、创建临时表空间，查看视图,2、创建临时表，并且插入数据，执行dml业务，查看视图变化，继续插入数据扩展文件，查看数据文件,3、对表空间执行ddl业务，查看视图,1）alter tablespace add/drop tempfile,2）alter database resize tempfile,3）alter tablespace shrink space,4）alter tablespace online/offline,5）alter tablespace rename to,4、删除表空间，查看视图||
|3||加密表空间+dml业务+ddl业务|1、创建加密表空间，查看视图,2、创建表，并且插入数据，执行dml业务，查看视图变化，继续插入数据扩展文件，查看数据文件,3、对表空间执行ddl业务，查看视图,1）alter tablespace add/drop datafile/databucket,2）alter database resize datafile,3）alter tablespace shrink space,4）alter tablespace online/offline,5）alter tablespace rename to,4、删除表空间，查看视图||
|4||压缩表空间+dml业务+ddl业务|1、创建压缩表空间，查看视图,2、创建表，并且插入数据，执行dml业务，查看视图变化，继续插入数据扩展文件，查看数据文件,3、对表空间执行ddl业务，查看视图,1）alter tablespace add/drop datafile/databucket,2）alter database resize datafile,3）alter tablespace shrink space,4）alter tablespace online/offline,5）alter tablespace rename to,4、删除表空间，查看视图||
|5||swap表空间+dml业务+ddl业务|1、创建swap表空间，查看视图,2、创建表，并且插入数据，执行大量的dml业务，查看视图变化，继续执行大量的dmly业务，查看数据文件,3、对表空间执行ddl业务，查看视图,1）alter tablespace add/drop tempfile,2）alter database resize tempfile,3）alter tablespace shrink space,4）alter tablespace online/offline,5）alter tablespace rename to,4、删除表空间，查看视图||
|6||mms表空间+dml业务+ddl业务|1、创建mms表空间，查看视图,2、创建表，并且插入数据，执行dml业务，查看视图变化，继续插入数据扩展文件，查看数据文件,3、对表空间执行ddl业务，查看视图,1）alter tablespace add/drop datafile/databucket,2）alter database resize datafile,3）alter tablespace shrink space,4）alter tablespace online/offline,5）alter tablespace rename to,4、删除表空间，查看视图||
|~~7~~||~~databucket+dml业务+ddl业务~~|~~1、创建表空间，查看视图~~,~~2、创建表，并且插入数据，执行dml业务，查看视图变化，继续插入数据扩展文件，查看数据文件~~,~~3、对表空间执行ddl业务，查看视图~~,~~1）alter tablespace add/drop datafile/databucket~~,~~2）alter database resize datafile~~,~~3）alter tablespace shrink space~~,~~4）alter tablespace online/offline~~,~~5）alter tablespace rename to~~,~~4、删除表空间，查看视图~~|~~databucket内容不会显示在视图中~~|
|8||系统表空间+dml业务+ddl业务|1、在system表空间上create table，执行ddl和dml业务，查看视图,2、执行触发器和快照业务，查看sysaux的IO信息变化,3、在temp表空间上create temp table，执行ddl和dml业务，查看视图,4、在users表空间上create temp table，执行ddl和dml业务，查看视图,5、创建表执行大量dml业务，查看swap的IO信息变化,6、创建表插入大量数据并删除，查看undo的IO信息变化|系统表空间有system、sysaux、undo、temp、swap、users|
|9|其他|表空间+backup备份|1、创建各种表空间，并且创建表，插入数据,2、执行全量备份，查看视图,3、执行增量备份，查看视图|备份方式包含全量备份、增量备份|
|10||表空间+yarman备份|1、创建各种表空间，并且创建表，插入数据,2、执行全量备份，查看视图,3、执行增量备份，查看视图|备份方式包含全量备份、增量备份|
|11||mount状态下可以查询|1、nomount状态下查询报错,2、mount/open状态下查询成功||
|12||创建用户未赋权查询视图失败，赋权后查询成功|赋权后查询成功||
|13||视图写操作拦截（create、create as select、drop、alter、dml）|写操作被拦截||
|14||视图select查询验证（select 不带filter、带filter、group by、join、子查询、having、distinct、order by、limit)|查询结果匹配准确||
|15|ha|主备环境下，检查视图是否同步|1、主备环境下，主机下发业务，查询视图，备机查询视图是否同步,2、备升主后，新主继续下发业务，查询视图，救主查询视图是否同步||
|16|CT|多session、多实例并发查询视图与ddl、dml业务并发|实例不core不卡||
|17|KT|多session、多实例并发查询视图与ddl、dml业务并发+kill|实例不core不卡||
|18|版本升级|单机/分布式/集群从其他版本升级到23.4版本，查看视图|V$FILESTAT视图,23.2.3.102——>23.4升级成功,![WXWorkLocalPro_17369461841843.png](https://pingcode.yasdb.com/atlas/files/public/6787b21ca1ad9a3311de6b98/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk1MTIsImV4cCI6MTc4MjQ3MDMxMn0.DhOyggdafXxz5v14hYZ5iyme8Dpy1JNpWTypdqzZeWM),23.3.2——>23.4升级报错，主干上的问题||
|19|资料验证|查看资料文档|资料文档中视图说明正确||


#### 3.2.2  梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|涉及  
|  
|
|KT|涉及  
|  
|
|长稳|/|  
|
|一致性|/  
|  
|
|三方测试工具  
(sqltest，sqlancer)|/  
|  
|
|安全|/  
|  
|
|DFR|/  
|  
|
|HA|涉及  
|  
|
|压力|/  
|  
|
|性能|/|  
|
|可维护性|涉及  
|  
|




# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

|框架|用例路径|用例个数|备注|
|---|---|---|---|
|YTP|/system_view/filestat|10||
|ha框架|ha/ha_heap/testcase/new/Dynamic_view/test_sdv_ydbrd_33445_filestat_003.py|3||
|CT/KT|standalone/storage_testcase/view/v_view/test_sdv_view_event_name_select_view.sql|1|复用库上已有用例|


# 6. 测试环境说明

linux arm环境

# 7. 工作量评估

工作量：7人天

计划测试完成时间：2025/1/13

# 8. 上车工程分析

上车构建分析：  [Agile_master_L2_Build #6003 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/6003/)  

|编号|工程链接|失败用例及分析||
|---|---|---|---|
|单机||||
|1|  [Agile_L2_sa_heap_HA_1_docker #6053 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/6053/)  |ha_heap/testcase/ha_schedule_common/logic_copy/database_Level/test_sdv_YDBRD_21627_012.py---刷新预期||
|2|  [Agile_L2_sa_tac_HA_1_docker #5842 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_1_docker/5842/)  |yasft/ha/ha_TAC/testcase/ha_schedule_common/segment/test_sdv_primary_key.py---master主干预期不对||
|3|  [Agile_L2_sa_heap_yasft_arm #5221 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5221/)  |/DCL/lbac/heap---no free block in application pool,/ddl_02/outline---公共库上预期不对,/dml2/pseudo_column---公共库上预期不对,/function2/dbms_stats/schema_stats/test_sdv_ydbrd_33465_dbms_stats_gather_schema_stats_09---用例并发影响,/function6/mysql/YDBRD34021frombase64/test_sdv_YDBRD34021_033---公共库上预期不对,/function6/mysql/convert---公共库上预期不对,/function6/mysql/math---公共库上预期不对,/plsql_UDT/test_sdv_YDBRD_25618/test_sdv_YDBRD26518_under_015---no free block in application pool,/storage/system_table/system_table_seg/test_sdv_cluster_systable_seg_001---YASQL-00011 Nothing in SQL buffer to run框架问题,/storage_dfx/dba_view/dba_synonyms/test_sdv_dba_synonyms---同名对象报错,/system_view/v_view/heap/test_ydbrd35261_memory_view_para---用例并发影响||
|4|  [Agile_L2_sa_tac_yasft_arm #4387 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4387/)  |/dml3/test_sdv_update/tac/multi_table_update/test_sdv_multi_table_update_sub---no free space in global temporary table cache,/function3/OLAP_func/tac/test_sdv_OLAP_first_value_tac---用例并发影响,与需求无关||
|5|  [Agile_L2_sa_lsc_yasft_arm #4639 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4639/)  |/ddl_01/default/lsc/test_sdv_ydbrd7619_default_02_1---ColumnarVmBuffer不足,/dml3/insert/lsc/test_sdv_iall_qr1---no free cursors in cursor pool,/function3/OLAP_func/lsc/test_sdv_OLAP_first_value_lsc/test_sdv_OLAP_first_value_lsc_9---排序问题,/function5/test_log_ln/ln/lsc---用例并发影响,/function5/test_log_ln/log/lsc---用例并发影响,lastfail已绿  [Agile_L2_sa_lsc_yasft_arm #4659 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4659/)  ||
|6|  [Agile_L2_sa_heap_driver_oci_arm #2584 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_oci_arm/2584/)  |共性问题，忽略||
|7|  [Agile_L2_sa_heap_driver_oci #2626 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_oci/2626/)  |共性问题，忽略||
|8|  [Error 404 Not Found (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_ha_profile/685/)  |构建被清理，重跑已绿  [Agile_L2_sa_heap_ha_profile #700 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_ha_profile/700/)  ||
|9|  [Agile_L2_sa_yasft_code_sensitive_arm #507 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/507/)  |/heap/system_view/all_view/all_synonyms/test_sdv_all_synonyms_004---同名对象报错,/heap/system_view/dba_extents/heap/test_sdv_sa_dba_extents_001---框架问题,/heap/system_view/dynamic_view/dynamic_view_all/test_sdv_ydbrd_15209_03---用例不稳定,/heap/system_view/mysql/mysql_function/test_sdv_sysview_mysql_function_01---公共库上预期不对,/heap/system_view/test_sdv_ydbrd_15210/test_sdv_ydbrd_15210_sa---刷新预期,/heap/system_view/trigger/test_sdv_trigger_related---用例并发影响,/heap/system_view/v_view/heap/test_sdv_ydbrd_33502_session_wait_class_03---用例不稳定,/heap/system_view/ydbrd_18826_sql_bind_capture/heap---公共库上预期不对,/lsc/system_view/ydbrd_18826_sql_bind_capture/column---公共库上预期不对,/tac/system_view/ydbrd_18826_sql_bind_capture/column---公共库上预期不对||
|10|  [Agile_L2_sa_lsc_yastx_arm #492 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yastx_arm/492/)  |超时，重跑已绿  [Agile_L2_sa_lsc_yastx_arm #507 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yastx_arm/507/)  ||
|11|  [Agile_L2_sa_heap_HA_9_docker #966 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/966/)  |ha/ha_heap/testcase/ha_schedule/convert_path_optimize/test_sdv_convertpathoptimize_08.py---redo free space is not enough,ha/ha_heap/testcase/ha_schedule/convert_path_optimize/test_sdv_convertpathoptimize_13.py---redo free space is not enough,lastfail已绿  [Agile_L2_sa_heap_HA_9_docker #982 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/982/)  ||
|12|  [Agile_L2_sa_heap_HA_10_arm #805 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/805/)  |logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_01.py---未rebase相关代码,/logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_08.py---主备同步延迟,logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_31.py---用例不稳定,logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_32a.py---用例不稳定,logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_32b.py---用例不稳定,logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_32.py---用例不稳定||
|集群||||
|1|  [Agile_L2_cluster_yasft_cluster_case_arm #4566 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4566/)  |/function/other_func_reinforce/userenv/test_sdv_userenv_clus_02---用例不稳定,/plsql_DBMS_external_01/WHO_CALL_ME/WHO_CALL_ME_yac/test_sdv_who_called_me_clu_046---不稳定,/storage/external_table/test_sdv_YDBRD-21783_external_yfs_028---用例并发影响,/storage/segment/segment_statistic_cluster/test_sdv_segment_019_statistic_pp2---不稳定,/storage/system_table/system_table_seg/test_sdv_cluster_systbl_seg_001---框架问题,/storage/temporary_table/basic/test_sdv_cluster_global_temporary_table_22---用例并发影响,/storage/transaction/xa---用例并发影响,/storage/transaction_01/for_update/cluster/test_sdv_forupdate_ma_01---用例并发影响,lastfial   [Agile_L2_cluster_yasft_cluster_case_arm #4588 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4588/)  ,/heap/storage/temporary_table/basic/test_sdv_cluster_global_temporary_table_22---attempt to execute unsupported DDL statement on global temporary table in use，与需求无关，忽略||
|2|  [Agile_L2_cluster_yasft_yfs_arm #3796 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3796/)  |/yfs/yfs_mem_set_online/online_parameters---ycs启动超时，与需求无关,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002---共性问题||
|3|  [Agile_L2_cluster_backup_arm_3 #2298 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/2298/)  |yasft/ha/ha_cluster/testcase/backup/backup_yasrman/test_cluster_yasrman_04.py,yasft/ha/ha_cluster/testcase/backup/backup_yasrman/test_cluster_yasrman_06.py,ha/ha_cluster/testcase/backup/backup_yasrman_xmlfile/test_clu_ydbrd26670_yasrman01.py,ha_cluster/testcase/backup/backup_pitr_recent_backupset/test_sdv_yasrman_pitr_recent_02.py,ha_cluster/testcase/backup/backup_pitr_recent_backupset/test_sdv_yasrman_pitr_recent_04.py,ha_cluster/testcase/backup/backup_pitr_recent_backupset/test_sdv_yasrman_pitr_recent_06.py,ha_cluster/testcase/backup/backup_pitr_recent_backupset/test_sdv_yasrman_pitr_recent_07.py,ha_cluster/testcase/backup/backup_pitr_recent_backupset/test_sdv_yasrman_pitr_recent_09.py---master主预期不对||
|4|  [Agile_L2_cluster_jdbc_arm #1926 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1926/)  |未定位出原因，lastfail已绿  [Agile_L2_cluster_jdbc_arm #1942 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1942/)  ||
|5|  [Agile_L2_cluster_FT_ha_arm #1511 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1511/)  |fault_test/ycs_fault/network_fault/Para_Startstop_15230/test_sdv_cluster_18732_ha_01.py---master主干预期不对||
|6|  [Agile_L2_cluster_yasft_code_sensitive_arm #484 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/484/)  |/system_view/dba_extents/heap/test_sdv_cluster_dba_extents_001---框架问题,/system_view/dynamic_view/v_view/YDBRD_15209---刷新预期,/system_view/gv_subquery---已知core问题YDBRD-37483,/system_view/tempseg_usage/cluster---master主干预期不对,/system_view/test_sdv_ydbrd_15210/Cluster_dynamic_view---刷新预期,/system_view/ydbrd_18826_sql_bind_capture/clu_heap---master主干预期不对||
|7|  [Agile_L2_cluster_yasct_arm #495 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasct_arm/495/)  |已知core问题YDBRD-37483||
|8|  [Agile_L2_cluster_yaskt_arm #497 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yaskt_arm/497/)  |没跑起来已知core问题YDBRD-37483||
|分布式||||
|1|  [Agile_L2_dst_lsc_yasft_arm #3947 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3947/)  |数据库重启导致||
|2|  [Agile_L2_dst_HA_Switch_docker #4722 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4722/)  |未定位出原因，共性问题忽略||
|3|  [Agile_L2_dst_yasft_code_sensitive_arm #483 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/483/)  |/lsc/system_view/ydbrd_18826_sql_bind_capture/dst_column---master主干预期不对,/tac/system_view/dynamic_view/dynamic_view_all---刷新预期,/tac/system_view/sys_views/tac/test_sdv_dml_sysviews1---刷新预期,/tac/system_view/test_sdv_ydbrd_15210/tac---刷新预期,/tac/system_view/ydbrd_18826_sql_bind_capture/dst_column---master主干上的预期不对,lastfail   [Agile_L2_dst_yasft_code_sensitive_arm #503 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/503/)  ||
|4|  [Agile_L2_dst_lsc_yaskt_arm #504 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/504/)  |oom||
|5|  [Agile_L2_dst_pn_yasft_arm #424 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/424/)  |数据库重启导致||
|6|  [Agile_L2_dst_heap_yasft_arm #176 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_heap_yasft_arm/176/)  |||


