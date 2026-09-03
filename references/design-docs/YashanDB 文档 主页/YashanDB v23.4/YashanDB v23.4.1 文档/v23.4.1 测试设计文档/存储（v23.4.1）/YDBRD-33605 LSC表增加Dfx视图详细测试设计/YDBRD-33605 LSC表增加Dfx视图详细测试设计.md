IR链接：  [https://pingcode.yasdb.com/ship/ideas/66d57e644283cf23d4f43a5a?](https://pingcode.yasdb.com/ship/ideas/66d57e644283cf23d4f43a5a?)  

#YASHAN-3265  LSC表增加Dfx视图

SR链接：  [https://pingcode.yasdb.com/pjm/items/6706441ce489dd0868f2e826?](https://pingcode.yasdb.com/pjm/items/6706441ce489dd0868f2e826?)  

#YDBRD-33605 LSC表增加Dfx视图

开发设计文档：  [(24) YDBRD-33605: LSC表增加Dfx视图 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/HUANGZIXUN/pages/67760f641e1551235bee29fb)  

# 1. 概述

引入新的视图V$XFMR_STAT与V$XFMR_HISTORY_STAT；

展示XFMR任务的资源占用，包括内存，配额，换入换出，执行时间等信息；

能分析正在执行中与已执行完毕的历史XFMR任务的行为是否符合预期以及是否影响性能。

# 2. 需求分析

## 2.1 功能点分析

#### 2.1.1 视图说明

**（1）V$XFMR_STAT**

该视图记录目前正在执行的xfmr任务（包括转换、compact、clean）资源占用情况。

|列名|类型|描述|备注|
|---|---|---|---|
|ID|BIGINT|xfmr任务编号||
|OWNER|VARCHAR(64)|xfmr任务所属用户名||
|TABLESPACE_NAME|VARCHAR(64)|xfmr任务所属的表空间名||
|TABLE_NAME|VARCHAR(64)|xfmr任务所属的表名||
|PARTITION_NAME|VARCHAR(64)|xfmr任务所属的分区名||
|TYPE|VARCHAR(16)|xfmr任务的类型（ac、create、transform、compact等）||
|FORCE|VARCHAR(16)|xfmr任务是否为强制执行||
|STATUS|VARCHAR(16)|xfmr任务的状态（ready：已创建等待执行、running：正在执行）||
|SLICE_INFO|VARCHAR(1024)|xfmr任务对应的slice信息（转换任务对应需转换生成的slice id和行数，合并任务对应需合并的所有slice的id和行数）||
|CREATE_TIME|TIMESTAMP|xfmr任务的创建时间||
|START_TIME|TIMESTAMP|xfmr任务的开始执行时间||
|EXECUTE_COUNT|INTEGER|xfmr任务的执行次数||
|ERROR_CODE|INTEGER|xfmr任务当前的失败错误码||
|ERROR_MESSAGE|VARCHAR(512)|xfmr任务当前的失败错误信息||
|MEM_USE|BIGINT|xfmr任务当前已使用的内存大小||
|MEM_QUOTA|BIGINT|xfmr任务当前的内存配额大小||
|SWAP_OUT_SIZE|BIGINT|xfmr任务当前执行中换出的字节大小||
|SWAP_IN_SIZE|BIGINT|xfmr任务当前执行中换入的字节大小||
|SWAP_OUT_COUNT|INTEGER|xfmr任务当前执行中换出的次数||
|SWAP_IN_COUNT|INTEGER|xfmr任务当前执行中换入的次数||
|SWAP_OUT_TIME|BIGINT|xfmr任务当前执行中换出的时间||
|SWAP_IN_TIME|BIGINT|xfmr任务当前执行中换入的时间||


字段意义：

1. **ID**   表示 xfmr 任务记录进系统表的编号，由于 ac 任务不记录系统表，故给8个 ac 任务预留9223372036854775800 ~ 9223372036854775807（最大的 INT 64位）的   **ID **  编号以能  唯一标识每个 xfmr 任务  。
1. **OWNER**  、  **TABLESPACE_NAME**  、  **TABLE_NAME**  、  **PARTITION_NAME **  记录 xmfr 任务所属的表信息，显示名字而非 id   能更直观从而便于查询  ：
    1. TRANSFORM 与 COMPACT 任务的单位为分区，会记录到分区名；
    1. CREATE 任务的单位为基表，不记录分区信息，将由 CREATE 任务 生成每个分区对应的 TRANSFORM 与 COMPACT 任务；
    1. AC 任务不记录表信息。
1. **TYPE**  、  **FORCE**  、  **STATUS **  记录 xfmr 任务自身的属性信息（视图只显示已创建的任务），能通过任务类型、是否后台自动生成或强制转换、是否正在执行的信息  判断当前任务是否是合理执行的  。
1. **SLICE_INFO**   针对 TRANSFORM 与 COMPACT 任务记录对应的 slice 信息：
    1. 能通过每个待合并 slice 的行数判断 slice 大小以  分析合并策略的机制与收益  ；
    1. 能通过生成 slice 的行数  分析写磁盘的性能  ；
    1. 能通过生成 slice 的 id 信息  追溯每个 slice 被转换合并的历程  。
1. **CREATE_TIME**  、  **START_TIME**  、  **EXECUTE_COUNT**  、  **ERROR_CODE**  、  **ERROR_MESSAGE**  ：
    1. **CREATE_TIME**   记录任务被首次创建的时间，以能  追溯该任务的执行调度是否合理  ；
    1. **START_TIME **  记录任务当前执行的开始时间，每次重新执行后刷新；
    1. **EXECUTE_COUNT **  记录任务被执行的次数，其中 CREATE 与 AC 任务在整个生命周期内会重复执行，每次执行则增加一次执行次数；而 TRANSFORM 与 COMPACT 任务若成功则只会执行一次，若失败则会重新执行直至成功，每次失败执行才会增加一次执行次数；
    1. **ERROR_CODE**  、  **ERROR_MESSAGE**  失败执行最后一次失败执行的错误错误信息超过412512字节会被截断；若 xfmr 任务调度中被中断取消，该错误也会被记录。记录任务被首次创建的时间，最后一次失败执行的
1. **MEM_USE**  、  **MEM_QUOTA **  记录任务当前执行中的内存信息，其中内存使用大小与配额大小均代表任务当前的实际情况，会随着任务执行中的不同流程而更新，以能通过如卡住xfmr任务的  即时内存信息分析现象是否合理  。
1. **SWAP_OUT_SIZE**  、  **SWAP_IN_SIZE**  、  **SWAP_OUT_COUNT**  、  **SWAP_IN_COUNT**  、  **SWAP_OUT_TIME**  、  **SWAP_IN_TIME **  记录 xfmr 任务当前执行中的换入换出信息，以  能分析I/O性能  。


**（2）V$XFMR_HISTORY_STAT**

该视图记录已经执行成功的xfmr任务（包括转换、compact、clean）资源占用情况。

|列名|类型|描述|备注|
|---|---|---|---|
|ID|BIGINT|xfmr任务编号||
|OWNER|VARCHAR(64)|xfmr任务所属用户名||
|TABLESPACE_NAME|VARCHAR(64)|xfmr任务所属的表空间名||
|TABLE_NAME|VARCHAR(64)|xfmr任务所属的表名||
|PARTITION_NAME|VARCHAR(64)|xfmr任务所属的分区名||
|TYPE|VARCHAR(16)|xfmr任务的类型（ac、create、transform、compact等）||
|FORCE|VARCHAR(16)|xfmr任务是否为强制执行||
|STATUS|VARCHAR(16)|xfmr任务的状态（ready：已创建等待执行、running：正在执行）||
|SLICE_INFO|VARCHAR(1024)|xfmr任务对应的slice信息（转换任务对应需转换生成的slice id和行数，合并任务对应需合并的所有slice的id和行数）||
|CREATE_TIME|TIMESTAMP|xfmr任务的创建时间||
|START_TIME|TIMESTAMP|xfmr任务的开始执行时间||
|FINISH_TIME|TIMESTAMP|xfmr任务的结束执行时间||
|EXECUTE_COUNT|INTEGER|xfmr任务的执行次数||
|ERROR_CODE|INTEGER|xfmr任务当前的失败错误码||
|ERROR_MESSAGE|VARCHAR(512)|xfmr任务当前的失败错误信息||
|MAX_MEM_USE|BIGINT|xfmr任务执行中的最大内存大小||
|MAX_MEM_QUOTA|BIGINT|xfmr任务执行中的最大内存配额大小||
|SWAP_OUT_SIZE|BIGINT|xfmr任务执行中换出的字节大小||
|SWAP_IN_SIZE|BIGINT|xfmr任务执行中换入的字节大小||
|SWAP_OUT_COUNT|INTEGER|xfmr任务执行中换出的次数||
|SWAP_IN_COUNT|INTEGER|xfmr任务执行中换入的次数||
|SWAP_OUT_TIME|BIGINT|xfmr任务执行中换出的时间||
|SWAP_IN_TIME|BIGINT|xfmr任务执行中换入的时间||


#### 2.1.2 xfmr任务

1）目前的xfmr任务包含转换、compact、clean三种，其中每种任务还分为后台调度执行（非强制）以及前台命令执行（强制）；

2）xfmr任务可能是单次任务组成，也可以是多次任务由一个循环执行，CREATE_TIME指的是整个xfmr任务创建的时间点，START_TIME指的是单次任务开始的时间点，上一次任务结束之后会重置，FINISH_TIME指的是最后一次任务结束的时间点。

3）不管是前台的还是后台的xfmr任务，会因为各种原因（buffer不足、配额不足、ddl业务）等被打断，这都会增加EXECUTE_COUNT的值。

4）V$XFMR_HISTORY_STAT不能无限记录，需要提供清理手段（暂定，需要同时满足1百万行条记录和1个星期的保存时间两个条件才可以清理）

## 2.2 应用场景

提供可视视图记录历史的xfmr任务和正在执行的xfmr任务资源占用情况，包括开始时间、结束时间、内存使用、吞吐量等。

## 2.3 规格约束

- 交付形态：单机、分布式
- 规格约束：只能在open状态下查询


# 3. 详细测试设计

## 3.1 测试设计方法

主要使用场景分析法和错误推测法进行测试：构造业务生成xfmr任务，验证视图中的资源占用情况是否准确。

## 3.2 详细测试设计

**3.2.1 使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式**

|编号|测试项|部署形态|测试场景|预期|备注|
|---|---|---|---|---|---|
||字段名称正确校验|单机、集群|desc V$XFMR_STAT;,desc V$XFMR_HISTORY_STAT;,desc GV$XFMR_STAT;,desc GV$XFMR_HISTORY_STAT;|字段的类型与设计保持一致||
|||分布式|desc V$XFMR_STAT;,desc V$XFMR_HISTORY_STAT;,desc GV$XFMR_STAT;,desc GV$XFMR_HISTORY_STAT;,desc DV$XFMR_STAT;,desc DV$XFMR_HISTORY_STAT;|字段的类型与设计保持一致||
||字段值准确校验|单机/分布式---V$XFMR_STAT|XFMR_ID校验|V$XFMR_STAT中与TABXFMR$一致，select * from TABXFMR$||
||||OWNER、TABLESPACE_NAME、TABLE_NAME、PARTITION_NAME|1、创建lsc表，插入数据，执行xfmr任务,2、执行alter tablesapce rename to、alter table rename to、alter table add/drop/split/modify/merge操作,3、查看视图中字段是否正确变更||
||||TYPE、FORCE、SLICE_INFO、CREATE_TIME、START_TIME|1、创建lsc表，插入数据,2、强制执行xfmr任务（alter table alter all slice stable/compact)，查看视图字段是否正确,TYPE分为：AC、转换、合并、后台常驻||
|||||1、创建lsc表，插入数据,2、继续插入数据，调整参数（ttl），触发后台xfmr（转冷、compact）任务，查看视图字段是否正确||
|||||1、执行AC业务,2、查看视图字段是否正确||
||||EXEUCUTE_COUNT、ERRORCODE、ERRMSG|1、创建lsc表，插入数据,2、构造xfmr任务失败的情况,a.调整参数，构造columnVMbuffer不足,b.调整参数，构造columnSWAPbuffer不去,c.xfmr任务与ddl业务、bulkload导入并发,d.删除bucket,e.bucket空间用满,3、查看视图中字段是否正确变更||
||||MEM_USED、MEM_QUOTA、SWAP_BYTES、,SWAP_TIMES、SWAP_DURATION|1、创建lsc表，插入数据,2、通过构造不同的业务量，查看视图中的字段是否有变化||
||||STATUS|1、创建lsc表，插入数据,2、xfmr任务正在执行时，查看视图字段为running,3、xfmr任务报错时，查看视图字段为非running||
||||其他|执行结束的xfmr任务不在V$XFMR_STAT中显示，其中成功的会进入V$XFMR_HISTORY_STAT中显示||
|||单机/分布式---V$XFMR_HISTORY_STAT|XFMR_ID|V$XFMR_HISTORY_STAT中与XFMRHIS$一致，select * from XFMRHIS$;,||
||||OWNER、TABLESPACE_NAME、TABLE_NAME、PARTITION_NAME|之前的xfrm任务结束之后，再次创建同名tablespace和同名table，执行xfmr任务，结束后查看视图是否新增记录||
||||TYPE、FORCE、SLICE_INFO、CREATE_TIME、START_TIME、FINISH_TIME|1、同V$XFMR_STAT测试场景,2、xfrm任务结束查看视图是否新增记录，字段是否正确||
||||EXEUCUTE_COUNT|1、同V$XFMR_STAT测试场景,2、xfrm任务结束查看视图是否新增记录，字段是否正确||
||||WRITR_BYTES、WRITR_TIME、,SWAP_BYTES、SWAP_TIMES、SWAP_DURATION|1、同V$XFMR_STAT测试场景,2、xfrm任务结束查看视图是否新增记录，字段是否正确||
||||STATUS|默认都是执行结束并且成功||
||||其他|同时满足1百万行条记录和1个星期的保存时间两个条件会清理视图记录||
||ha|单机ha/分布式主备|主备环境下，检查视图是否同步|1、主备环境下，主机下发业务，查询视图，备机查询视图是否同步,2、备升主后，新主继续下发业务，查询视图，救主查询视图是否同步|内存信息，备机不会同步|
||CT|单机|多session、多实例并发查询视图与ddl、dml业务并发|实例不core不卡||
||KT|单机|多session、多实例并发查询视图与ddl、dml业务并发+kill|实例不core不卡||
||版本升级|单机/分布式/集群|从其他版本升级到23.4版本，查看视图|V$XFMR_STAT和V$XFMR_HISTORY_STAT视图查询成功,23.2.3.102——>23.4升级成功,![WXWorkLocalPro_17369435033036.png](https://pingcode.yasdb.com/atlas/files/public/6787a79fa1ad9a3311de6b8e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQkFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk1NTMsImV4cCI6MTc4MjQ3MDM1M30.wznVj4EOt8NTFwX1woqrXnIxV5rTa-yS7CDqb9fy0TI),23.3.2——>23.4升级报错，主干上的问题||
||资料验证|/|查看资料文档|资料文档中视图说明正确||


**3.2.2 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

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
||




# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

|框架|用例路径|用例个数|备注|
|---|---|---|---|
|YTP|system_view/dynamic_view/dynamic_view_all|1||
|ha框架|ha/ha_LSC/testcase/new/xfmr_stat|7||
|CT/KT|standalone/storage_testcase/dml/filter/pushdown/lsc/lsc_xfmr_slices.sql |1|复用库上已有用例|


# 6. 测试环境说明

linux arm环境

# 7. 工作量评估

工作量：14人天

计划测试完成时间：2025/1/15

实际测试完成时间：2025/1/15

# 8. 上车工程分析

上车工程构建链接：  [Agile_master_L2_Build #6047 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/6047/)  

|编号|工程链接|失败用例及原因|备注|
|---|---|---|---|
|单机||||
|1|  [Agile_L2_sa_heap_HA_1_docker #6080 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/6080/)  |ha_heap/testcase/ha_schedule_common/logic_copy/database_Level/test_sdv_YDBRD_21627_012.py---刷新预期||
|2|  [Agile_L2_sa_lsc_yasft_arm #4674 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4674/)  |/dml3/insert/lsc/test_sdv_iall_qr1---no free cursors in cursor pool,/dml4/filter_in_exists/lsc---invalid identifier "STUDENT_01"."CLASS_ID",/storage/table_encrypt/standone/lsc/test_sdv_ydbrd_31577_table_encry_006---预期不对,lastfail已绿  [Agile_L2_sa_lsc_yasft_arm #4697 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4697/)  ||
|3|  [Agile_L2_sa_tac_yasft_arm #4419 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4419/)  |/ddl_03/synonym/tac/test_sdv_synonym_01---同名对象报错,/function3/OLAP_func/tac/test_sdv_OLAP_first_value_tac---用例预期不对,lastfail已绿   [Agile_L2_sa_tac_yasft_arm #4441 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4441/)  ||
|4|  [Agile_L2_sa_upgrade_FT_1_docker #5133 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/5133/)  |版本标签不对，忽略||
|5|  [Agile_L2_sa_heap_yasft_arm #5254 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5254/)  |/DCL/lbac_audit---用例并发影响,/dml2/pseudo_column---用例并发影响,/dml5/batch_hashjoin/test_ydbrd_26180_incline_02---用例预期不对,/dml5/batch_hashjoin/test_ydbrd_26180_incline_02---用例并发影响,lastfail已绿   [Agile_L2_sa_heap_yasft_arm #5278 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5278/)  ||
|6|  [Agile_L2_sa_heap_HA_10_arm #835 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/835/)  |logical_standby/logical_standby/test_sdv_YDBRD_26332_logic_standby_replay_32.py---未定位出原因,lastfail已绿   [Agile_L2_sa_heap_HA_10_arm #858 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/858/)  ||
|7|  [Agile_L2_sa_yasft_code_sensitive_arm #538 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/538/)  |/heap/system_view/dynamic_view/dynamic_view_all/test_sdv_ydbrd_15209_03---刷新预期,/heap/system_view/tempseg_usage/sa---master主干上的预期不对,除了需要刷新预期的，其他已绿  [Agile_L2_sa_yasft_code_sensitive_arm #557 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/557/)  ||
|分布式||||
|1|  [Agile_L2_dst_pn_deploy #424 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_deploy/424/)  |超时，重跑已绿,  [Agile_L2_dst_pn_deploy #440 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_deploy/440/)  ||
|2|  [Agile_L2_dst_lsc_yasft_arm #3964 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3964/)  |超时，重跑  [Agile_L2_dst_lsc_yasft_arm #3985 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3985/)  ,/DDL_01/alter_slice/lsc--- ColumnarVmBuffer不足||
|3|  [Agile_L2_dst_HA_Switch_docker #4755 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4755/)  |未定位出原因，共性问题，忽略||
|4|  [Agile_L2_dst_tac_driver_jdbc_arm #3383 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/3383/)  |未定位出原因，lastfail已绿,  [Agile_L2_dst_tac_driver_jdbc_arm #3399 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/3399/)  ||
|5|  [Agile_L2_dst_lsc_yaskt_arm #533 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/533/)  |when run group 17 procedure ,yasdb is unavailable，and recover failed.,last fail已绿，  [Agile_L2_dst_lsc_yaskt_arm #550 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/550/)  ||
|6|  [Agile_L2_dst_yasft_code_sensitive_arm #515 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/515/)  |/tac/system_view/dynamic_view/dynamic_view_all---刷新预期,/tac/system_view/test_sdv_ydbrd_15210/tac/test_sdv_ydbrd_15210_SESSION_ROLES---同名对象报错,除了需要刷新预期的，其他已绿  [Agile_L2_dst_yasft_code_sensitive_arm #534 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/534/)  ||
|集群||||
|1|  [Agile_L2_cluster_yasft_cluster_case_arm #4603 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4603/)  |超时，重跑  [Agile_L2_cluster_yasft_cluster_case_arm #4625 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4625/)  ,/CBO/count_push_down/heap/test_ydbrd_29480_count_021---并发影响,/ddl/tablespace/local_temp_tablespace/test_sdv_YDBRD_21721_cluster_create_tmpTS_012---并发影响,/function/dbms_stats/copy_table_stats/test_ydbrd_26588_copy_table_cluster_003---重启影响,/function2/test_sdv_ydbrd29579_rowidtochar/test_sdv_ydbrd29579_rowidtochar_all/test_sdv_ydbrd29579_rowidtochar_016---重启影响,/plsql/Static_SQL/variasub---并发影响,/plsql/pkg_head_default---并发影响,/plsql/pkg_plsql_recursion---并发影响,/plsql_DBMS_external_01/DBMS_LOB/heap---并发影响,/storage/external_table/test_sdv_YDBRD-21783_external_yfs_028---并发影响,/storage---并发影响||
|2|  [Agile_L2_cluster_yasft_ycs_arm #3920 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3920/)  |环境搭建失败，重跑  [Agile_L2_cluster_yasft_ycs_arm #3937 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3937/)  ,/ycs_common/ycs_monitor_db/ycs_parameter_STOP_STEP/test_sdv_ycs_ydbrd_14045_parameter_STOP_STEP_004---stop ycs超时,/ycs_common/ycsctl---用例并发影响，共性问题忽略,lastfail已绿，   [Agile_L2_cluster_yasft_ycs_arm #3941 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_ycs_arm/3941/)  ||
|3|  [Agile_L2_cluster_backup_arm_3 #2328 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/2328/)  |master主干的预期不对，忽略,![WXWorkLocalPro_17369248077530.png](https://pingcode.yasdb.com/atlas/files/public/67875e8fa1ad9a3311de6b02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQkFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk1NTMsImV4cCI6MTc4MjQ3MDM1M30.wznVj4EOt8NTFwX1woqrXnIxV5rTa-yS7CDqb9fy0TI)||
|4|  [Agile_L2_cluster_yasft_code_sensitive_arm #515 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/515/)  |环境搭建失败，重跑,  [Agile_L2_cluster_yasft_code_sensitive_arm #545 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/545/)  ,/system_view/dynamic_view/v_view/YDBRD_15209---刷新预期,/system_view/gv_subquery/test_sdv_cluster_18732_select_with_001---,master已知core  [https://pingcode.yasdb.com/pjm/items/6780e533f48760829d7038c0?](https://pingcode.yasdb.com/pjm/items/6780e533f48760829d7038c0?)  ,#YDBRD-37483 【二层CI】 master_L2_cluster_yasft_code_sensitive_arm工程查询动态视图CORE 在execPxReceiver,/system_view/tempseg_usage/cluster---master主干上预期不对||
|5|  [Agile_L2_cluster_yaskt_arm #528 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yaskt_arm/528/)  |master已知core  [https://pingcode.yasdb.com/pjm/items/6780e533f48760829d7038c0?](https://pingcode.yasdb.com/pjm/items/6780e533f48760829d7038c0?)  ,#YDBRD-37483 【二层CI】 master_L2_cluster_yasft_code_sensitive_arm工程查询动态视图CORE 在execPxReceiver||
|6|  [Agile_L2_cluster_FT_ha_arm #1545 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1545/)  |master主干上的问题,![WXWorkLocalPro_1736925363779.png](https://pingcode.yasdb.com/atlas/files/public/678760bca1ad9a3311de6b06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQkFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk1NTMsImV4cCI6MTc4MjQ3MDM1M30.wznVj4EOt8NTFwX1woqrXnIxV5rTa-yS7CDqb9fy0TI)||
|7|  [Agile_L2_cluster_yasct_arm #523 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasct_arm/523/)  |master已知core  [https://pingcode.yasdb.com/pjm/items/6780e533f48760829d7038c0?](https://pingcode.yasdb.com/pjm/items/6780e533f48760829d7038c0?)  ,#YDBRD-37483 【二层CI】 master_L2_cluster_yasft_code_sensitive_arm工程查询动态视图CORE 在execPxReceiver||
|8|  [Agile_L2_cluster_yasft_yfs_arm #3824 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3824/)  |/yfs/yfs_mem_set_online/online_parameters---ycs启动超时,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002---未定位出原因，共性问题，忽略||


