Created by 马爽, last modified on 十一月 07, 2024

SR链接：    [https://pingcode.yasdb.com/pjm/items/67064b9ee489dd0868f2f060](https://pingcode.yasdb.com/pjm/items/67064b9ee489dd0868f2f060)    ?    
  #YDBRD-33621 LSC表冷数据编码不因内存不足随意退化

开发设计文档：  [https://pingcode.yasdb.com/wiki/pages/6739c3e4728206efb9310fb6](https://pingcode.yasdb.com/wiki/pages/6739c3e4728206efb9310fb6)  

# 1. 概述

lsc表如果存在冷数据使用了字典编码，在字典编码基数很小的情况下，由于内存不足，  有些列上的字典编码会退化，从而导致查询性能差。

本文档描述LSC表冷数据编码不因内存不足随意退化详细测试设计。

# 2. 需求分析

## 2.1 功能点分析

为了解决字典编码因内存不足随意退化的问题，主要提出了以下改进点：

1. 当前字典已经是最高优先级使用的内存，生成冷数据时，需要为字典编码预留出来足够的内存大小。
1. 创建字典成功后，  如果出现字典内存无法分配成功，根据不同的情况决定是否回退字典（导入场景、转换场景）。


##### 指定字典编码

**导入场景**

1）字典编码  预分配时会  根据定义的最大值数量（暂定128）计算出需要的内存大小，并且预占该部分内存。

2）在导入数据的场景下，字典编码在内存不足的情况下是可以回退的。

3）  字典编码预分配的内存配额包含在writer的最小配额中，  需要对单个writer的最小内存进行限制，控制需要满足：

_SCOL_DELTASLICE_COUNT* writer_min_mem <    SESSION_BULKLOAD_MAX_MEM_PERCENT*columnar_vm_buffer_size* columnar_material_percent   

#### 转换场景

1）在slice转换和compact的场景下writer的数量是可控的，因此可以计算出writer需要的内存，  并且预占该部分内存。

2）在writer数量可控的条件下，字典编码即使在内存不足的场景下，也不能回退，可以通过整体换入操作，保证字典可以继续读写。

3）单个writer的最小内存限制在256M。

##### 自适应字典编码

**导入场景**

内存充足的情况下，自适应值128，  探测4K个值之后确定是否使用字典编码。  若使用字典编码，也会预占内存，字典编码内存策略同上。

**转换场景**

内存充足的情况下，自适应2048个值，探测4K个值之后确定是否使用字典编码。若使用字典编码，也会预占内存，字典编码内存策略同上。

## 2.2 观测手段

通过yasminer解析lsc表的元数据信息进行观测，命令：    
  1）yasminer  -D   ${YASDB_DATA}   -t  表名   【-P  分区名】【-u 用户名】

**说明：**  指定数据库数据DATA路径，根据用户名、表名、分区名（分区表），在终端输出LSC表相关的元数据信息，包含热数据部分元数据以及SWD部分(即slice文件的元数据，不包含slice文件存储部分的元数据信息)。

2）yasminer  -D   ${YASDB_DATA}   -t  表名   【-P  分区名】【-u 用户名】-S  sliceId   -T   meta/data  【-C  column-name】  【【-O  extend / block】【-i   extendId / blockId】 】

**说明：**  指定数据库数据DATA路径，根据用户名、表名、分区名（分区表的情况下不可缺省)、slice文件在swd中的slotid、期望输出的slice文件的meta或者data信息（缺省为都输出），以及列名（缺省情况为所有列）在终端输出LSC表指定的slice文件信息。

参考手册：    [yasminer工具使用说明 - 陈晓晴 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=72778888)  

## 2.3 应用场景

**2.3.1 需求本身的主要应用场景**

内存不足的情况下，字典编码视不同的情况不随意回退。

**2.3.2 需求与其他特性的关联场景**

不涉及

## 2.4 规格约束

- 支持形态：单机、单机ha、分布式
- 自适应编码增加char类型限制，超过128个字符不自适应字典


# 3. 详细测试设计

## 3.1 测试设计方法

功能验证主要使用场景法测试，重点验证在内存空间不足的情况下，字典编码是否会回退。

## 3.2 详细测试设计

**3.2.1 使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式**

|  
|字典编码类型|字典编码列个数|数据列基数|业务场景|预期|备注|
|---|---|---|---|---|---|---|
|1|指定字典编码|1~3个（内存充足）|<=128个|bullkload导数|预先分配内存，编码不回退|  
|
|2|  
|  
|  
|slice转换|预先分配内存，编码不回退|  
|
|3|  
|  
|  
|slice合并|预先分配内存，编码不回退|  
|
|4|  
|  
|>128个|bullkload导数|预先分配内存，内存扩展，编码不回退|  
|
|5|  
|  
|  
|slice转换|预先分配内存，内存扩展，编码不回退|  
|
|6|  
|  
|  
|slice合并|预先分配内存，内存扩展，编码不回退|  
|
|7|  
|50个（内存不足）|<=128个|bullkload导数|预先分配内存，编码部分回退|  
|
|8|  
|  
|  
|slice转换|预先分配内存，编码不回退，存在编码换入换出|  
|
|9|  
|  
|  
|slice合并|预先分配内存，编码不回退，存在编码换入换出|  
|
|10|  
|  
|>128个|bullkload导数|预先分配内存，内存扩展，编码部分回退|  
|
|11|  
|  
|  
|slice转换|预先分配内存，内存扩展，编码不回退，存在编码换入换出|  
|
|12|  
|  
|  
|slice合并|预先分配内存，内存扩展，编码不回退，存在编码换入换出|  
|
|13|自适应编码|1~3个（内存充足）|<=128个|bullkload导数|不预占内存，编码不回退|  
|
|14|  
|  
|>128个|bullkload导数|不预占内存，编码不回退|  
|
|15|  
|  
|<=2048个|slice转换|不预占内存，编码不回退|  
|
|16|  
|  
|>2048个|slice转换|不预占内存，编码不回退|  
|
|17|  
|  
|<=2048个|slice合并|不预占内存，编码不回退|  
|
|18|  
|  
|>2048个|slice合并|不预占内存，编码不回退|  
|
|19|  
|50个（内存不足）|<=128个|bullkload导数|不预占内存，  编码部分回退|  
|
|20|  
|  
|>128个|bullkload导数|不预占内存，编码部分回退|  
|
|21|  
|  
|<=2048个|slice转换|不预占内存，  编码不回退|  
|
|22|  
|  
|>2048个|slice转换|不预占内存，编码不回退|  
|
|23|  
|  
|<=2048个|slice合并|不预占内存，  编码不回退|  
|
|24|  
|  
|>2048个|slice合并|不预占内存，  编码不回退|  
|
|25|  
|创建lsc表定义列为char类型超过128字节，查看是否自适应字典编码|||超过128字节的char类型未自适应编码|  
|


**3.2.2 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，对原有工程不造成影响，复用已有CT工程|
|KT|涉及，对原有工程不造成影响，复用已有KT工程|
|长稳|/|
|一致性|/|
|三方测试工具  
(sqltest，sqlancer)|涉及导入工具  yasldr的bulkload模式导入LSC|
|安全|/|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|涉及，需要关注slice转换和compact的速率变化，不能劣化太多|
|可维护性|/|




# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

单机/分布式用例路径：yasft/ha/ha_LSC/testcase/ha_schedule_common/dictionary_revert

个数：15+15

# 6. 测试环境说明

linux arm环境

# 7. 工作量评估

工作量：14人天

计划测试完成时间：2024/11/26

实际测试完成时间：2024/11/26

  [详细测试设计文档模板.doc](#)  

# 8. 上车工程分析

上车工程构建链接：  [Agile_master_L2_Build #5691 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5691/)  

|编号|工程链接|失败用例|备注|
|---|---|---|---|
|单机||||
|1|  [Agile_L2_sa_heap_yasft_arm #4693 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4693/)  |/ddl_03/mysql/schema---mysql系统权限需求合入引起，与本需求无关，pass,/gis/ST_ContainsProperly/test_sdv_YDBRD_22073_ST_ContainsProperly_01---YAS-00103 no free block in application pool，空间资源不足,/plsql01/test_sdv_ydbrd29064/test_sdv_ydbrd29064_166---YAS-00103 no free block in application pool，空间资源不足,/storage_dfx/db_Privilege/mysql_schema_privilege/grant_current_schema_privilege--mysql系统权限需求合入引起，与本需求无关，pass,/storage_dfx/db_Privilege/mysql_schema_privilege/grant_schema_privilege--mysql系统权限需求合入引起，与本需求无关，pass|除了与mysql权限相关的，其余失败已绿,  [Agile_L2_sa_heap_yasft_arm #4696 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_heap_yasft_arm/4696/)  |
|2|  [Agile_L2_sa_lsc_yasft_arm #4205 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4205/)  |/ddl_03/code_compress---压缩率变动，刷新预期,/storage/lsc_features/bulkload_optimize---刷新预期,/storage_object/tablespace/databucket---刷新预期,/lstorage_object/tablespace/tablespace_autoexend---刷新预期||
|3|  [Agile_L2_sa_upgrade_FT_1_docker #4739 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4739/)  |开发包tag版本号太低了导致失败，该需求不涉及兼容升级|忽略|
|4|  [Agile_L2_sa_tac_yasft_arm #3991 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3991/)  |/ddl_02/create_table_as_select/tac---用例并发导致,/ddl_03/synonym/tac/test_sdv_synonym_01---同名对象报错,/dml3/test_sdv_update/tac/multi_table_update/test_sdv_multi_table_update_sub---no free space in global temporary table cache，空间资源不足,/dml4/filter_in_exists/tac/test_sdv_filter_in_78---空间资源不足|已绿,  [Agile_L2_sa_tac_yasft_arm #3994 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3994/)  |
|5|  [Agile_L2_sa_upgrade_FT_2_docker #4729 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4729/)  |开发包tag版本号太低了导致失败，该需求不涉及兼容升级|忽略|
|6|  [Agile_L2_sa_heap_yasft_profile #1143 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/1143/)  |/storage_object/materializaed_view/fresh_materializaed_view/test_sdv_ydbrd_13582_fresh_mv_alter_005_2---用例并发导致，与该需求无关|忽略|
|7|  [Agile_L2_sa_yasft_code_sensitive_arm #138 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/138/)  |/heap/system_view/mysql/sql_view,/heap/system_view/trigger---mysql兼容用例，无关|除了mysql兼容相关的，其他已绿,  [Agile_L2_sa_yasft_code_sensitive_arm #141 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_yasft_code_sensitive_arm/141/)  |
|8|  [Agile_L2_sa_heap_driver_python_debug_docker #2168 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/2168/)  |未定位到原因|已绿,  [Agile_L2_sa_heap_driver_python_debug_docker [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/)  |
|9|  [Agile_L2_sa_heap_HA_10_arm #443 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/443/)  |yasft/ha/ha_heap/testcase/ha_schedule/open_readonly/test_sdv_ydbrd_26538_readonly_001.py---用例不稳定，lastfail|已绿,  [Agile_L2_sa_heap_HA_10_arm #446 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/446/)  |
|10|  [Agile_L2_sa_upgrade_FT_3_docker #4287 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/4287/)  |开发包tag版本号太低了导致失败，该需求不涉及兼容升级|忽略|
|分布式||||
|1|  [Agile_L2_dst_lsc_yasft_arm #3490 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3490/)  |/DDL_02/tablespace/databucket/lsc/test_ydbrd14027_databucket_storage_04---刷新预期||
|2|  [Agile_L2_dst_tac_yasft_arm #3244 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3244/)  |/DML1/bloomfilter/full_join/tac/bloom_hash_full_join_04_tac---同名对象报错|已绿,  [Agile_L2_dst_tac_yasft_arm #3247 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3247/)  |
|3|  [Agile_L2_dst_tac_driver_jdbc_arm #3007 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/3007/)  |超时|已绿,  [Agile_L2_dst_tac_driver_jdbc_arm #3010 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/3010/)  |
|4|  [Agile_L2_dst_yasft_code_sensitive_arm #120 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/120/)  |/lsc/system_view/dv_segments/lsc/test_sdv_YDBRD_23701_008--刷新预期,/lsc/system_view/sys_views/lsc/test_sdv_dml_sys_view,/tac/system_view/test_sdv_ydbrd_15210/tac/test_sdv_ydbrd_15210_SESSION_ROLES--同名对象报错||
|5|  [Agile_L2_dst_pn_yasft_arm #69 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/69/)  |/DDL_02/tablespace/databucket/lsc/test_ydbrd14027_databucket_storage_04---刷新预期,/DDL_03/using_index/lsc/test_duplicated_constraint_using_index_01---同名对象报错,/pn/pn_metadata/test_sdv_ydbrd27023_pn_cache_15---未定位到原因||
|集群||||
|1|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3852 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3852/)  |/ddl_01/constraint/check/heap/test_sdv_alter_table_check_012---同名对象报错|已绿,  [Agile_L2_cluster_heap_yasft_sa_case_arm #3855 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3855/)  |
|2|  [Agile_L2_cluster_yasft_cluster_case_arm #4111 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4111/)  |超时,/ddl_02/tbs_quota/test_sdv_tablespace_quota_ydbrd_26544_030---用例并发影响,/plsql/yaswrap_new/test_sdv_wrap_14---psql报错信息变更,/plsql_DBMS_external_01/DBMS_LOB/heap/GETLENGTH/test_sdv_getlength_QR_006---数据库重启导致,/storage/transaction/xa---xa特性，与本需求无关,/ycs_common/ycs_check_error/ycs_parameter_DISK_HB_KEEP_ALIVE/test_sdv_ycs_ydbrd_15225_parameter_DISK_HB_KEEP_ALIVE_004---ycs特性，与本需求无关||
|3|  [Agile_L2_cluster_yasft_yfs_arm #3447 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3447/)  |/yfs/yfs_mem_set_online/online_parameters---超时,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002---存在未清理对象|已绿|
|4|  [Agile_L2_cluster_FT_install_arm #1010 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/1010/)  |开发包tag版本号太低了导致失败，该需求不涉及兼容升级|忽略|
|5|  [Agile_L2_cluster_FT_ha_arm #1146 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1146/)  |common/dml/insert_into_select_para/test_sdv_YASHAN_2817_para_insert_select_ha_03.py---延迟|已绿,  [Agile_L2_cluster_FT_ha_arm #1149 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1149/)  |


