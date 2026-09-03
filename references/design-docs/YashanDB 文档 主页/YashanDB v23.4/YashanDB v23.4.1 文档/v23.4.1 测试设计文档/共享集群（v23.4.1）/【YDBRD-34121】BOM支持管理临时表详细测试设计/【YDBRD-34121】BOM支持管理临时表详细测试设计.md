**IR链接：**  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2aff9?](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2aff9?)  

#YASHAN-169  集群支持基于对象的资源管理

**SR链接：**  [https://pingcode.yasdb.com/pjm/items/670cff69e489dd0868f7558e?](https://pingcode.yasdb.com/pjm/items/670cff69e489dd0868f7558e?)  

#YDBRD-34121 BOM支持管理临时表

**开发设计文档链接：**  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6777553aea9f2a2870936997](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6777553aea9f2a2870936997)  



# 1. 概述

本特性重在针对临时表空间下的对象支持基于对象缓冲区的管理。

  

# 2. 需求分析

## 2.1 功能点分析

1、功能点：

- 支持临时表的对象缓冲区管理，在临时表扫描对象链完成失效临时buffer ctrl，而不需要扫描buffer pool内的临时链。
- 支持临时表数据亲和


2、开发设计的主要原理

- 放开对临时表的对象缓冲区的拦截，通过表空间ID来区分临时表对象与非临时表对象（临时表对象和非临时表对象的dataOid会重合，再使用表空间ID可以将它们区分开来）。
- 当开启BOM，在临时表对象drop/truncate/commit(on commit delete rows)/会话断开时，会释放segment，通过缓冲区对象记录的ctrl链失效关联的temp buffer ctrl。
- 如果未开启BOM，使用原来的流程来失效buffer ctrl。
- 临时表的数据页面在使用上本身具备亲和特点，所以当开启BOM时，在访问临时表数据页面时，不会走GCS请求，非数据页面依然会走GCS请求。




## 2.2 应用场景

1、需求本身的主要应用场景

- "临时表drop/truncate/commit(on commit delete rows)/会话断开/临时表空间drop"操作相关的使用场景
- 开启/关闭BOM（开启：验证对已有机制是否有冲击；关闭：验证新功能是否OK）
- 临时表支持数据亲和


2、需求与其他特性的关联场景

- BOM支持临时表管理后的性能提升
- BOM管理临时表的过程中有故障产生时是否可以正常处理
- BOM管理临时表的过程中涉及到并发的临时表业务时是否可以正常处理




## 2.3 规格约束

1、约束

- 不支持管理临时UNDO对象


2、规格

- 开启BOM特性后会启用相关功能（_ENABLE_BOM=TRUE）
- 涉及产品形态：单机（heap+tac）+集群




# 3. 详细测试设计

## 3.1 测试设计方法

1、该需求相对简单，场景比较单一，测试过程中涉及到不同的对象以及同一对象的不同操作，还涉及到多种部署形态

2、针对明确单一场景，使用"场景法"进行测试

3、针对不同对象以及同一对象的不同时操作使用"正交组合法"进行测试

4、针对不同的部署形态，使用"全量覆盖法"进行覆盖



## 3.2 关联特性/依赖分析

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，需要考虑并发业务过程中的表现|
|KT|涉及，需要考虑并发故障业务过程中的表现|
|长稳|不涉及，长稳环境新版本中默认开启BOM|
|一致性|不涉及，无一致性相关验证点|
|三方测试工具  
(sqltest，sqlancer)|不涉及，无新增sql语法|
|安全|不涉及，无密码/权限/审计相关操作|
|DFR|不涉及，和不同故障类型无关|
|HA|涉及，规格约束中并未限制产品形态，需要考虑主备部署模式|
|压力|不涉及，和压力无关|
|性能|涉及，临时表支持BOM管理后，性能原则上应该有提升|
|可维护性|不涉及，无新增视图/接口/参数/资料/配置参数等|
|RTO|不涉及，rto场景中无临时表相关对象，不会对rto场景有影响|
|升级|不涉及，该特性无相关配置参数/系统视图等改动，不涉及升级|


## 3.3 详细测试设计

1、针对"关闭BOM时对已经机制是否有冲击"这一点的验证，直接复用已有用例即可，不需要做用例新增，涉及到的详细用例如下（挑选已有临时表相关用例，包括单机heap临时表/单机tac临时表/集群临时表相关用例）：

  [https://pingcode.yasdb.com/wiki/spaces/ZHANGLIHONG/pages/67b29b4c700aa28012635c1f](https://pingcode.yasdb.com/wiki/spaces/ZHANGLIHONG/pages/67b29b4c700aa28012635c1f)  

2、针对"临时表支持数据亲和"这一点的验证，属于单点场景，覆盖集群下不同类型的临时表下的基础场景即可，单机heap不涉及，验证方式主要如下：

- 开启BOM时，访问临时表数据页面，临时表的buffer ctrl不会存在gcs信息


3、针对"支持临时表对象缓冲区管理"这一点的测试，主要覆盖"临时表drop/truncate/commit(on commit delete rows)/会话断开/临时表空间drop"操作相关的使用场景，验证方式主要如下：

- 针对临时表对象：在执行完"drop/truncate/commit(on commit delete rows)/会话断开"相关操作后，buffer pool内不存在关联对象current页面的buffer ctrl
- 针对临时表空间对象：在执行完drop操作后，buffer pool内不存在此表空间下的buffer ctrl


验证过程中涉及到的各个测试因子如下：

|测试因子|可取值1级|可取值2级|
|---|---|---|
|对象类型|临时表|全局会话级临时表|
|||全局事务级临时表|
|||私有会话级临时表|
|||私有事务级临时表|
||临时表空间||
|操作类型|表-drop||
||表-truncate||
||表-commit(on commit delete rows)||
||表-会话断开||
||表空间-drop||
|产品部署形态|单机heap||
||集群heap||
||主备集群heap||
|集群节点个数|2节点||
||4节点||


将上述各个测试因子做正交组合后，生成如下测试场景进行验证（针对不同的部署形态，单机和集群要做全覆盖，集群和主备集群做交叉覆盖）：

|场景编号|对象类型|操作类型|产品部署形态|集群节点个数|备注|
|---|---|---|---|---|---|
|1|全局事务级临时表|truncate|集群|2节点||
|2|全局事务级临时表|会话断开|主备集群|4节点||
|3|全局事务级临时表|drop|主备集群|2节点||
|4|私有会话级临时表|drop|集群|4节点||
|5|全局会话级临时表|会话断开|集群|2节点|会话级全局临时表commit时是有buffer存在的|
|6|私有事务级临时表|会话断开|集群|2节点||
|7|私有事务级临时表|drop|主备集群|4节点||
|8|私有事务级临时表|commit|主备集群|4节点||
|9|私有事务级临时表|truncate|主备集群|4节点||
|10|全局会话级临时表|drop|主备集群|4节点|会话级全局临时表commit时是有buffer存在的|
|11|全局会话级临时表|commit|集群|2节点|会话级全局临时表commit时是有buffer存在的|
|12|私有会话级临时表|commit|主备集群|2节点|会话级临时表不遵循这个原则|
|13|私有会话级临时表|truncate|主备集群|2节点||
|14|全局会话级临时表|truncate|主备集群|4节点|会话级全局临时表commit时是有buffer存在的|
|15|全局事务级临时表|commit|集群|2节点||
|16|私有会话级临时表|会话断开|主备集群|4节点||
|17|表空间|drop|集群|4节点|内置表空间不可删除，该用例无效|
|18|表空间|drop|集群|2节点|场景重复累赘，删除|
|19|表空间|drop|主备集群|2节点|内置表空间不可删除，该用例无效|
|20|表空间|drop|主备集群|4节点|场景重复累赘，删除|




4、针对该需求带来的性能提升需要进行验证，验证场景如下（在开启和关闭BOM时进行对比）：

|场景编号|场景说明|预期结果|备注|
|---|---|---|---|
|1|配置较大的buffer，创建临时表后，在不同会话上插入大量数据，然后commit(on commit delete rows)其中一个会话，确认耗时|开启BOM时性能有提升||
|2|创建两张表，（可以一个会话）也是插入大量数据，但drop其中一张表，确认耗时|开启BOM时性能有下降||
|3|涉及到临时表的"commit(on commit delete rows)"业务与 普通表业务 的并发，确认耗时|开启BOM时commit性能有提升||
|4|涉及到临时表的drop业务与 普通表业务 的并发，确认耗时|开启BOM时drop性能有提升||
|5|临时表的commit(on commit delete rows)/drop业务的并发，确认耗时|开启BOM时commit/drop性能有提升||


5、针对故障和并发场景需要做针对性验证，这部分不做用例新增，直接复用已有并发及故障用例如下，详细测试用例如下（这里筛选部分单机heap和集群下的临时表相关的并发和故障工程来跑）：

  [https://pingcode.yasdb.com/wiki/spaces/ZHANGLIHONG/pages/67b2a4c9700aa28012636135](https://pingcode.yasdb.com/wiki/spaces/ZHANGLIHONG/pages/67b2a4c9700aa28012636135)  

6、其它场景

备注：测试设计过程中有一些单点的其它场景需要考虑，具体场景如下：

|场景编号|场景说明|预期结果|备注|
|---|---|---|---|
|1|带临时表相关业务的前提下，多次重启集群，每次重启时设置的BOM参数值都和前一次不同|无core/hung现象的产生||




# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  [【YDBRD-34121】BOM支持管理临时表 测试用例_v1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdiZTg1OWMzOTgyM2YyYWMxZjI2MGE0IiwicmVmX2lkIjoiNjdiMjhkODZkMDZhYzc0ZWNjNDE1NGQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4NTEwLCJleHAiOjE3ODI1NDQ5MTB9.WolTVI_DBRptZzcw8nJX6dWw6Px57G7N7ri2ZqnRexM)  

  


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


|用例类型|使用框架|
|---|---|
|功能用例|guider框架|
|  
|ha框架|


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|测试类型|环境|备注|
|---|---|---|
|功能测试|本地X86+ARM虚拟机环境|CentOS 16U 32G|
|性能测试|110/111环境|  
|


# 7. 工作量评估

工作量：总计7人/天（1.5人/周），当前已投0.5人/天，剩余9人/天工作量

转测时间：2025/2/12

实际投入时间：2025/2/17

计划测试完成时间：2025/2/25

涉及用例总数：47个（其中不可自动化用例数为14个）

实际测试完成时间：2025/2/28（中间投入23.2 SIT RTO CI调试 2人/天+请假1人/天）

实际投入工作量：1.5人/周

|工作项|时间成本|备注|
|---|---|---|
|需求调研+开发串讲|0.5人/天|pass|
|测试设计输出及细节沟通对齐|1人/天|pass|
|测试设计评审|0.3人/天|pass|
|测试用例输出|0.2人/天|pass|
|测试用例自动化|0人/天|pass（执行的过程中一起自动化）|
|测试执行|3人/天|  
pass|
|问题单跟踪回归|0人/天|pass  
|
|CI工程新增和沟通对齐|0.5人/天|  
pass|
|需求上车|1人/天|pass  
|


# 8. 测试用例维护

- *规划不同类型的用例自动化看护的是哪个库，哪个文件夹，哪个调度，是否需要新增工程*
- *确认用例耗时情况，若有耗时久的，进行备注*


|测试项|框架|目录|调度|备注|
|---|---|---|---|---|
|  
单机heap|  
guider|  
standalone/testcase/storage/buffer_object/temp_bom|  
|  
用例默认放到2层，除非有特殊情况|
||ha|ha_heap/testcase/ha_schedule_common/storage/buffer_object/temp_bom|schedule_common4||
|集群heap  
|guider  
|cluster/testcase/global_memory/grc/object_manager/object_buffer/temp_bom  
|  
|  
用例默认放到2层，除非有特殊情况|
||ha|ha_cluster/testcase/common/global_memory/grc/object_manager/object_buffer/temp_bom|schedule_DB_3|需要新增工程，当前已有工程执行时间太长|


# 9. 上车分析

工程总链接：  [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/6268](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/6268)  /

|工程链接|失败用例|失败原因|解决方案|当前状态|
|---|---|---|---|---|
|单机|||||
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4682](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4682)  /||出包时没出驱动包|重新出包跑,4689,2个，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_oci/2889](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_oci/2889)  /||同上|重新出包跑，last fail 2982 pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_oci_arm/2845](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_oci_arm/2845)  /||同上|重新出包跑，last fail 2848 pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/5817](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/5817)  /|test_sdv_backup_archive_03|备份恢复时恢复出来的数据不对|其它构建有相同问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5643](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5643)  /|/heap/DCL/mysql,/heap/DCL/mysql_set,/heap/DCL/mysql_show,/heap/datatype/hex_literal,/heap/datatype/mysql_binary,/heap/datatype/mysql_compat,/heap/ddl_01/My_SQL/information_schema,/heap/function6/mysql/YDBRD34021frombase64,/heap/function6/mysql/datetime_func/date_format,/heap/function6/mysql/datetime_func/date,/heap/function6/mysql/datetime_func/dayofweek,/heap/function6/mysql/datetime_func/extract,/heap/function6/mysql/datetime_func/last_day,/heap/function6/mysql/hex,/heap/function6/mysql/last_insert_id,/heap/function6/mysql/lcase_ucase_locate,/heap/function6/mysql/math,/heap/function6/mysql/test_sdv_YDBRD34239_datetime,/heap/function6/mysql/test_sdv_yabrd_26305_Strcmp|上车分支代码未rebase到最新|和主干未rebase之前一致，忽略|pass|
||/heap/datatype/mysql_variables/sqlmode_ansi_quotes,/heap/ddl_03/mysql/view,/heap/dml2/merge_into/heap/merge_into_transaction/merge_into_disable_row_movement,/heap/function6/mysql/reverse_space_unhex,/heap/function6/mysql/row_count,/heap/function6/test_sdv_YDBRD34219|预期不符|主库用例预期刷新，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/5214](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/5214)  /|Yasldr37008Gis22,Yasldr37008Gis32,Yasldr37008Gis33,Yasldr37008Gis34|错误码变更|附近上车工程中有相同问题，属于共性问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_odbc_arm/3489](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_odbc_arm/3489)  /||出包时没出驱动包|重新出包跑，3493，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/4932](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/4932)  /||升级失败|附近上车工程中有相同问题，属于共性问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/553](https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/553)  /|/heap/dml1/mysql/empty_string/empty_string_mysql,/heap/dml1/mysql/empty_string/function/test_sdv_yabrd_26305_Strcmp, /heap/DCL/mysql_set,/heap/DCL/test_sdv_YDBRD_34144,/heap/datatype/mysql_binary,/heap/dml1/mysql/empty_string/empty_string_mysql,/heap/dml1/mysql/empty_string/empty_string_yashan,/heap/dml1/mysql/empty_string/function/hex,/heap/function6/mysql/hex|,上车分支未rebase最新修改|忽略，pass|pass|
||/heap/function6/mysql/decode|预期不符|库上预期刷新，忽略|pass|
||/heap/function6/mysql/encode|同上|同上|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4971](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4971)  /|||,4979 last fail，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_jdbc_mysql_arm/716](https://jenkins.yasdb.com/job/Agile_L2_sa_jdbc_mysql_arm/716)  /| com.mysqltest.CheckTimeStampTypeBindParameter, com.mysqltest.CheckDateTimeTypeBindParameter|位置信息变更|附近上车工程中有相同问题，属于共性问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_ylink_arm/141](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_ylink_arm/141)  /|test_sr13328_dblink_select_011|结果和预期不符|主干上无该问题，附近其它上车构建中有相同问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_jdbc_mysql_debug_asan/639](https://jenkins.yasdb.com/job/Agile_L2_sa_jdbc_mysql_debug_asan/639)  /| com.mysqltest.CheckTimeStampTypeBindParameter, com.mysqltest.CheckDateTimeTypeBindParameter|位置信息变更|附近上车工程中有相同问题，属于共性问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/1220](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/1220)  /|test_ydbrd21381_mv_crtl_01,test_ydbrd21381_mv_crtl_02,test_ydbrd21381_mv_crtl_03,test_ydbrd21381_mv_crtl_04,test_ydbrd21381_mv_crtl_05|构建执行超时,预期不符|重新执行,正在重新执行，1224结果：,附近上车工程中有相同问题，属于共性问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/803](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/803)  /|storage_view_sys_05,test_ydbrd32974_slow_log_001,test_sdv_sysview_mysql_function_01|预期不符|主库预期已刷新，忽略|pass|
||||||
||||||
||||||
|集群|||||
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/4519](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/4519)  /||构建执行超时|重新执行，4530,1个，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4906](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4906)  /|test_ydbrd22599_std_09,test_sdv_segment_024_statistic_g|预期不符|主库预期已刷新|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/4172](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/4172)  /|test_sdv_ycs_ydbrd_14045_parameter_RESTART_TIMES_004,test_sdv_ycs_ydbrd_14045_parameter_STOP_STEP_004|进程启动超时|跑last fail，4176，pass|pass，  需要优化用例|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/4065](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/4065)  /|test_yfs_online_parameters_YDBRD_21455_01_post,test_yfs_online_parameters_YDBRD_21455_01_pre,test_sdv_cluster_yfscmd_dirmanager_002|进程启动超时|跑last fail，4069，pass|pass，  需要优化用例|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/2184](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/2184)  /|test_sdv_YDBRD_22288_004|未找到原因|跑last fail,2187,pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_odbc_arm/3374](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_odbc_arm/3374)  /||出包时没出驱动包|重新出包跑,3377，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/2566](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/2566)  /||CI机器有问题，工程没跑起来|重跑,2569,pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/1684](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/1684)  /|test_sdv_ydbrd_16227_FP_015|故障点结果随机|last fail,1687，pass|pass，  用例需要优化|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/792](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/792)  /||构建执行超时|重新执行,812，pass|pass|
||||||
|分布式|||||
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3925](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3925)  /|||last fail,3929，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_odbc_arm/4725](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_odbc_arm/4725)  /||出包时没出驱动包|重新出包跑,4728，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/782](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/782)  /||oom|last fail,785，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_om_scale/3190](https://jenkins.yasdb.com/job/Agile_L2_dst_om_scale/3190)  /|test_dst_scale_cn_add_host|预期不符|附近上车工程中有相同问题，属于共性问题，忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_python_docker/4867](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_python_docker/4867)  /||无失败用例，框架结果显示有问题|忽略|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/4283](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/4283)  /|||,4292 last fail,1个 pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_heap_yasft_arm/416](https://jenkins.yasdb.com/job/Agile_L2_dst_heap_yasft_arm/416)  /|||,420 last fail，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/684](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/684)  /||构建执行超时|重新执行,694，5个，pass|pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/785](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/785)  /|test_sdv_ydbrd_15210_SESSION_ROLES|结果和预期不符|附近其它上车工程中有相同问题，属于共性问题，忽略|pass|


  


# 10. TBD

后续需要加固测试或者补充测试的场景

