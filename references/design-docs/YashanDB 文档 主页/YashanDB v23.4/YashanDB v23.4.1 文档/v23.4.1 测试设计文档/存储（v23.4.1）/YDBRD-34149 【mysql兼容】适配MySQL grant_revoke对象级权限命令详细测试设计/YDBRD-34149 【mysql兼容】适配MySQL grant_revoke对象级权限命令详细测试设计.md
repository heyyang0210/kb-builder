Created by 马爽 on 十一月 15, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66d6758f4283cf23d4f44509](https://pingcode.yasdb.com/ship/ideas/66d6758f4283cf23d4f44509)    ?    
  #YASHAN-3274 【mysql兼容】MySQL支持常用权限（名称及行为对齐）

SR链接：    [https://pingcode.yasdb.com/pjm/items/670dc7a6e489dd0868f76f0a](https://pingcode.yasdb.com/pjm/items/670dc7a6e489dd0868f76f0a)    ?    
  #YDBRD-34149 【mysql兼容】适配MySQL grant/revoke对象级权限命令

开发设计文档：  [适配MySQL grant/revoke对象级权限命令设计文档 · 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/pages/uurERD1QXJZ)  

测试概要设计文档：  [【YDBRD-34149】 【mysql兼容】适配MySQL grant/revoke对象级权限命令 测试调研 - 郑荃 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=177841098)  



# 1. 概述

1、支持mysql grant授权对象级权限；    
  2、支持mysql revoke撤销对象级权限；    
  3、常用权限的名称为行为与MySQL对齐。



# 2. 需求分析

## 2.1 需求来源

yashan对象级权限，指某个用户（或角色）拥有在某个对象上的某个特定权限后，可以在该对象上执行相应的操作，但该权限仅在该对象上生效。

mysql对象级权限，作用于指定的数据库对象上（包括表、视图、存储过程、列等），该权限仅在该数据库上的对象生效。

需要将yashan已有的对象权限与mysql的对象权限建立起来映射关系，各自独有的权限也能够实现容错。



## 2.2 功能点分析

#### 2.2.1 sql语法实现

1、  支持mysql兼容模式下grant授权对象级权限

      grant 语法：  GRANT privilege_type ON [object_type]   db_name.tbl_name |tbl_name |db_name.routine_name   TO user_or_role [with grant option]

              a. object_type包括：  TABLE | FUNCTION | PROCEDURE | COLUMN，目前仅支持table

              b. objetct_type的写法可以为：db_name.tbl_name或者tal_name(  在某些情况下，如果用户已经在上下文中选择了数据库，可以仅指定表名。该表名需要在已选数据库的上下文中使用  )

              c. 在兼容模式下，授权时授权对象和user必须存在，目前不支持对role的授权

              d. 可以对user进行重复授权，不报错

2、支持mysql revoke撤销对象级权限

      revoke语法：REVOKE privilege_type ON [object_type]   db_name.tbl_name |tbl_name |db_name.routine_name     FROM user_or_role

              a. 对对象上没有的权限进行revoke操作，不报错

3、常用权限的名称为行为与MySQL对齐，存在以下影射关系

|object_type|privilege_type|对象级权限|备注（需求支持）  
|
|:---|:---|:---|---|
|FUNCTION | PROCEDURE|Execute|无对象级权限对应 (feature "privileges on specified object type" has not been implemented yet)|  
|
||Alter Routine|无对象级权限对应,||
||Grant|grant option + with grant option（无法正常使用）||
|TABLE   |Select|READ|√,|
||Insert|INSERT|√|
||Update|UPDATE|√  
|
||Delete|DELETE|√  
|
||Create|新增对象级权限 PRIV_CREATE  授权后只能创建  db_name.tbl_name表，db_name 和tbl_name可以不存在----（暂不支持）|  
|
||Drop|新增对象级权限 PRIV_DROP  ----（暂不支持）|  
|
||Grant|grant option + with grant option|√  
|
||References|REFERENCES（  权限项已增加，认证未实现  ）|√  
|
||Index|INDEX|√  
|
||Alter|ALTER （  alter table rename to 现在还没做。drop原表+create和insert新表的权限  ）|√  
|
||Create View|Create View （系统级权限和对象级权限同名）---  （暂不支持）|  
|
||Show view|无对象级权限对应(invalid privilege or role specified)|  
|
||Trigger|新增对象级权限 PRIV_Trigger  ----（暂不支持）|  
|


#### 2.2.2 视图观测

对象权限在mysql.tables_priv 、information_schema.table_privileges视图中显示正常，  名称与mysql对齐，  显示已经设置的权限。

优先显示mysql下的对象权限名称，若无对应权限，则显示yashan下的对象权限名称。

information_schema.table_privileges各字段含义

- GRANTEE：  授予权限的用户
- TABLE_CATALOG：  表所属目录的名称。该值始终为 def
- TABLE_SCHEMA：表所属的SCHEME（ 数据库）的名称
- TABLE_NAME：表的名称
- PRIVILEGE_TYPE：  授予的特权。该值可以是可以在表级别授予的任何权限，每行列出一个权限，因此被授予者持有的每个表权限一行。
- IS_GRANTABLE：  如果用户有 grant option权限，字段值为YES，否则为NO




## 2.3 应用场景

- mysql的对象权限兼容适配




## 2.4 规格约束

1、不支持列级权限

2、  object_type 仅支持 TABLE （FUNCTION 和 PROCEDURE 目前不支持）

3、不支持grant 权限 to role



# 3. 详细测试设计

## 3.1 测试设计方法

1、该需求主要针对mysql和yashan之间的对象权限映射关系进行测试，需要在某一个database下验证不同对象的权限功能，采用等价类划分方法。

2、yashan已经支持的对象权限，mysql兼容下也支持；mysql下独有的对象权限，mysql兼容下做报错处理。

2、除此之外，还需要与系统权限授权交互。验证在授予了系统权限的前提下，对象权限是否可以生效以及重复授权；回收部分权限后，对象权限是否移除。

3、show grants for user_name权限可靠性验证，保证显示信息与用户权限情况一致。

4、mysql的其他差异点确认  ---与系统权限保持一致

- 相同重复授权/撤销不报错  --对齐
- 支持一次给多个user授权 --暂不支持
- 一次授权多个权限    已有sr，待支持后后续sr做加固测试  --暂不支持
- 可选项 WITH {GRANT OPTION] 是否支持 --- 暂不支持
-  *.    *  中间有空格也可，是否是mysql bug？  --保持差异
- 直接user插入user的一行？是否支持 --不支持
- show privileges，show grants 权限是否支持 --不支持


  

## 3.2 详细测试设计

**1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式**

|编号|object_type|privilege_type|yashan映射|测试场景|预期|备注|
|---|---|---|---|---|---|---|
|1|table|Select|READ|创建user赋予db1.t1的select权限，执行select，revoke select后，再次select|grant后select成功，select for update报错；revoke后失败||
|2||Insert|INSERT|创建user赋予db1.t1的insert权限，执行insert，revoke insert后，再次insert|grant后insert成功；revoke后失败||
|3||Update|UPDATE|创建user赋予db1.t1的update权限，执行update，revoke insert后，再次update|grant后update成功；revoke后失败||
|4||Delete|DELETE|创建user赋予db1.t1的delete权限，执行delete，revoke delete后，再次delete|grant后detele成功；revoke后失败||
|5||Grant|grant option + with grant option|创建user1赋予db1.t1的grant option权限，grant 已有权限to user2；revoke grant option后，再次grant|grant后grant 已有权限成功；revoke后失败||
|6||References|REFERENCES|创建user1赋予db1.t1的references权限，查看视图；revoke references后，查看视图|grant、revoke不报错|认证未实现，创建外键默认支持|
|7||Index|INDEX|创建user赋予db.t1的index权限，执行create/drop index，revoke index后，再次create/drop index|grant后create/drop index成功；revoke后失败|alter index需要alter权限|
|8||Alter|ALTER|创建user赋予db.t1的alter权限，执行alter table，revoke alter后，再次alter table,- alter table add/drop/change/modify column
- alter table add/drop index/primary key/unique/foreign key
- alter table rename to---不支持
|grant后alter table成功；revoke后失败|alter table drop index --需要alter 权限不需要drop index权限,rename 表需要有rename表名，则要求有alter和drop原表，create和insert新表的权限。做rename需求的时候对齐|
|9||Create|/|创建user grant/revoke db1.t1的create权限|预期报错||
|10||Drop|/|创建user grant/revoke db1.t1的drop权限|预期报错||
|11||Create View|/|创建user grant/revoke db1.t1的create view权限|预期报错||
|12||Show view|/|创建user grant/revoke db1.t1的show view权限|预期报错||
|13||Trigger|/|创建user grant/revoke db1.t1的trigger权限|预期报错||
|14||/|ALL PRIVILEGES|创建user grant/revoke db1.t1的all privileges权限，recovke单独的对象权限|查看视图显示权限集合；revoke单独权限后对应功能不支持||
|15||/|FLASHBACK|创建user grant/revoke db1.t1的flashback权限|预期成功||
|16||/|READ|创建user grant/revoke db1.t1的read权限|预期成功，查看视图显示为select||
|17|FUNCTION | PROCEDURE|Execute|/|创建user grant/revoke db1.f1的execute权限|预期报错||
|18||Alter Routine|/|创建user grant/revoke db1.f1的alter routine权限|预期报错||
|19||Grant|/|创建user grant/revoke db1.f1的grant option权限|预期报错||
|20|公共项测试|*|*|重复授权/重复撤销不报错,- 对象权限重复grant/revoke不报错
- 已有对应系统权限，对单独对象grant，不报错
- 已有对应系统权限，对单独对象revoke，不报错
|不报错||
|21||||语法正确性校验,- grant/revoke多个对象权限/grant 对象权限to多个user
- 未指定database，object_type必须要带上db_name（db_name.tbl_name），否则报错
- 指定了database，可以仅指定表名（tbl_name）
- 指定db_name.tbl_name.column_name
- grant/revoke to/from role
- with grant option 选项功能校验
|1、报错,2、成功,3、成功,4、报错,5、报错,6、校验是否可以授权给其他用户权限||
|22||||大小写敏感校验,- user_name、privilege_type分别使用大小写、大小写混合校验，查看是否可以识别成功
|||
|23||||yashan不支持的权限，不对齐。即不做权限控制。,赋权时报错，执行对应sql行为时，不报权限错误。---与系统权限保持一致,- Create---系统权限控制
- Drop---系统权限控制
- Create View---系统权限控制
- Show view---报错
- Trigger---系统权限控制
|预期正常||
|24||||user与role交互,1、  create role 成功，但是授权给role报错，把role授权 给user不报错。,|预期正常||
|25||||在sys用户上grant、revoke对象权限，是否受到影响|不受影响||
|26|CT|||grant/revoke对象权限操作+dml+ddl|不core不卡||
|27|KT|||grant/revoke对象权限操作+dml+ddl+kill -9|不core不卡||
|28|HA主备|||主机grant/revoke对象权限，在备机查看视图是否同步|主备同步||
|29||||主机grant/revoke对象权限，主备切换，新主验证再次执行grant/revoke操作|主备同步||
|30|show grants for|||grant/revoke系统权限后，show grants查看系统权限是否新增/删除|新增/删除成功||
|31||||grant/revoke scheme权限后，show grants查看scheme权限是否新增/删除|新增/删除成功||
|32||||grant/revoke 对象权限后，show grants查看对象权限是否新增/删除|新增/删除成功||
|33|资料验证|||系统权限+scheme权限+对象权限资料验证|||




**2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及，验证多用户下grant/revoke并发场景  
|
|KT|涉及，验证多用户下grant/revoke+kill -9并发场景  
|
|长稳|/  
|
|一致性|/  
|
|三方测试工具    
  (sqltest，sqlancer)|/  
|
|安全|涉及，最小权限原则  
|
|DFR|/  
|
|HA|涉及，主备场景下以及主备切换后的权限验证  
|
|压力|/  
|
|性能|/  
|
|可维护性|/  
|




# 4. 测试用例

1.测试设计评审时提供冒烟文本用例；

  [test1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczYzMxOTE4OTcwYzJhZjRmNTNiNTc1IiwicmVmX2lkIjoiNjczOTZmMDM3MjgyMDZlZmI5MmYyZjhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4OTAyLCJleHAiOjE3ODI1NDUzMDJ9.pAPaiAPC3kebbz1PzlF7z_QvFI58JDGdwqFtWbYcZZE)  

2.启动测试之前提供文本用例，并完成大部分自动化用例；

# 5. 测试框架设计

|框架|用例路径|用例个数|备注|
|---|---|---|---|
|YTP|/storage_dfx/db_Privilege/mysql_object_privilege|32||
|ha_regress|yasft/ha/ha_heap/testcase/ha_schedule_common/mysql_object_privilege|2||
|KT、CT|yastest_dfx/standalone/storage_testcase/privilege/mysql_object_privilege/|2||


# 6. 测试环境说明

linxu arm机器

# 7. 工作量评估

工作量：14人天

计划测试完成时间：2024/12/06

计划测试完成时间：2024/12/08

# 7. 上车工程分析

第一次构建：  [Agile_master_L2_Build #5758 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5758/)  

|编号|工程链接|失败用例|备注|
|---|---|---|---|
|单机||||
|1|  [Agile_L2_sa_heap_HA_1_docker #5770 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5770/)  |ha_heap/testcase/ha_schedule_common/logic_copy/database_Level/test_sdv_YDBRD_21627_012.py--刷新预期||
|2|  [Agile_L2_sa_heap_HA_2_docker #5754 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/5754/)  |ha/ha_heap/testcase/ha_schedule/Split_Brain/test_sdv_ha_splitBrain_13.py--备机同步超时||
|3|  [Agile_L2_sa_heap_yasft_arm #4820 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4820/)  |/DCL/mysql_show--刷新预期,/datatype/mysql_variables/sqlmode_ansi_quotes/test_YDBRD_26239_ANSI_QUOTES_004---用例并发导致,/dml1/mysql/backticks/test_sdv_26183_backticks_06--同名对象报错,/dml5/batch_hashjoin/test_ydbrd_26180_incline_02---与需求无关,/function6/percentile_cont_median---YAS-00103 no free block in application pool,/plsql_DBMS_external_01/DBMS_LOB/jiagu/test_sdv_dbms_lob_jiagu_006_2---YAS-00103 no free block in application pool,/storage_dfx/db_Privilege/mysql_schema_privilege/grant_current_schema_privilege---刷新预期,/storage_dfx/db_Privilege/mysql_schema_privilege/grant_schema_privilege---刷新预期,/storage_object/materializaed_view_privileges---刷新预期||
|4|  [Agile_L2_sa_lsc_yasft_arm #4302 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4302/)  |/dml4/filter_in_exists/lsc---用例并发导致||
|5|  [Agile_L2_sa_tac_yasft_arm #4085 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4085/)  |/dml4/filter_in_exists/tac/test_sdv_filter_in_78---YAS-06412 no group aggregate info||
|6|  [Agile_L2_sa_upgrade_FT_2_docker #4807 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4807/)  |![clipbord_1733474276664.png](https://pingcode.yasdb.com/atlas/files/public/6752de57a1ad9a3311de439e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFDQUFBQUFDQUFDQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJUUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5MDIsImV4cCI6MTc4MjQ2OTcwMn0.9pZjBhA4Uua1HzGMAGzFvhBqQqb0mZSOLHmzBBc7pc0),--刷新预期，合入之后同步李世铭刷新预期||
|7|  [Agile_L2_sa_upgrade_FT_1_docker #4819 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4819/)  |版本标签不对，升级报错||
|8|  [Agile_L2_sa_heap_HA_10_arm #527 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/527/)  |ha_heap/testcase/ha_schedule/mount_clear/test_sdv_mount_manual_archive_clean_all_primary.py--主备同步延迟,ha_heap/testcase/ha_schedule/mount_clear/test_sdv_manual_archive_clean_all_standy_001.py---主备同步延迟,ha/ha_heap/testcase/ha_schedule/mount_clear/test_sdv_mount_clear_06.py---YAS-02302 redo free space is not enough||
|9|  [Agile_L2_sa_yasft_code_sensitive_arm #218 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/218/)  |/heap/system_view/mysql/information_schema_check---刷新预期,/heap/system_view/mysql/information_schema_priv---修改用例、刷新预期,/heap/system_view/mysql/sql_view---刷新预期||
|10|  [Agile_L2_sa_heap_HA_9_docker #688 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/688/)  |ha_heap/testcase/ha_schedule/convert_path_optimize/test_sdv_convertpathoptimize_13.py---同步延迟||
|集群||||
|1|  [Agile_L2_cluster_yasft_cluster_case_arm #4214 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4214/)  |/plsql/yaswrap_new/test_sdv_wrap_22---脚本执行失败,/plsql_DBMS_external_01/WHO_CALL_ME/WHO_CALL_ME_yac/test_sdv_who_called_me_clu_046---无关，忽略,/storage/materializaed_view/materializaed_view_privileges---刷新预期,/storage/segment/segment_statistic_cluster/test_sdv_segment_024_statistic_g---无关，忽略,/storage/transaction/xa---无关，忽略||
|2|  [Agile_L2_cluster_yasft_ycs_arm #3630 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3630/)  |/ycs_common/ycs_monitor_db/ycs_parameter_STOP_STEP/test_sdv_ycs_ydbrd_14045_parameter_STOP_STEP_004---取最新预期即可||
|3|  [Agile_L2_cluster_yasft_yfs_arm #3525 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3525/)  |/yfs/yfs_mem_set_online/online_parameters--启动ycs报错,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002--未定位出来，lastfail||
|4|  [Agile_L2_cluster_FT_ha_arm #1237 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1237/)  |搭建集群ha环境失败||
|分布式||||
|1|  [Agile_L2_dst_tac_yasft_arm #3322 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3322/)  |/DML4/bloomfilter/runtime_filter/runtime_filter_01/tac---未定位出原因，lastfail||
|2|  [Agile_L2_dst_HA_yasft_arm #2737 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/2737/)  |/multicn/ddl/constraint/test_sdv_constraint_check/tac/test_sdv_constraint_ck_05---用例并发导致||
|3|  [Agile_L2_dst_yasft_code_sensitive_arm #204 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/204/)  |/tac/system_view/test_sdv_ydbrd_15210/tac/test_sdv_ydbrd_15210_SESSION_ROLES---同名对象报错||
|4|  [Agile_L2_dst_lsc_yasft_arm #3585 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3585/)  |/DDL_01/constraint/unique/lsc/test_sdv_du_create_unique255---超时,/DML3/filter/SEC_DU_LSC_filter/lsc/test_sdv_dml_SEC_SH_LSC_error---用例并发导致,/DML3/filter/SEC_DU_LSC_filter/lsc/test_sdv_dml_SEC_SH_LSC_error---未定位出原因，lastfail,/DML6/join_multi_key/lsc/test_sr12201_join_mulcols_2---同名对象报错,/datatype_01/blob/lsc/test_sdv_blob_partition_storage_034---数据库重启导致,/plsql/dbms_metadata/getddl_table_lsc/sharded_table/test_sdv_ydbrd21730_getddl_sharded_table_lsc_014---分布式节点未同步||
||  [Agile_L2_dst_HA_Switch_docker #4452 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4452/)  |未定位出原因||




第二次构建：  [Agile_master_L2_Build #5768 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5768/)  

|编号|工程链接|失败用例|备注|
|---|---|---|---|
|单机||||
|1|  [Agile_L2_sa_heap_HA_1_docker #5784 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5784/)  |/ha_heap/testcase/ha_schedule_common/logic_copy/database_Level/test_sdv_YDBRD_21627_012.py---刷新预期|lastfail已绿,  [Agile_L2_sa_heap_HA_1_docker #5791 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5791/)  |
|2|  [Agile_L2_sa_lsc_yasft_arm #4319 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4319/)  |/dml4/filter_in_exists/lsc---用例并发引起,/storage/lsc_features/bulkload_optimize---YAS-02767 can not allocate 33554432 bytes from columnar vm swap|lastfail已绿,  [Agile_L2_sa_lsc_yasft_arm #4324 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4324/)  |
|3|  [Agile_L2_sa_heap_HA_2_docker #5769 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/5769/)  |ha_heap/testcase/ha_schedule_common/plsql/dbms_scheduler/test_sdv_dbms_scheduler_03.py--=dbms未执行结束,/ha/ha_heap/testcase/ha_schedule_backup/backup_yasrman/test_yasrman_pitr_001.py,ha/ha_heap/testcase/ha_schedule_backup/backup_yasrman/test_yasrman_pitr_005.py---[YASRMAN] the corresponding scn to timestamp '2024-12-07 20:31:00' is 637902274560000000 ,restore successfully，未定位出原因，lastfail|lastfail已绿,  [Agile_L2_sa_heap_HA_2_docker [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/)  |
|4|  [Agile_L2_sa_heap_yasft_arm #4841 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4841/)  |/CBO/128/test_sdv_cboGoo_128_007---YAS-00110 worker thread stack overflow, size allowed cannot exceed 1048576 bytes,/DCL/mysql_show/test_YDBRD_26280_show_tables---刷新预期,/dml3/test_sdv_select/heap---[1:135]YAS-04310 invalid order column,/storage_dfx/db_Privilege/mysql_schema_privilege/grant_current_schema_privilege---刷新预期,/storage_dfx/db_Privilege/mysql_schema_privilege/grant_schema_privilege---刷新预期||
|5|  [Agile_L2_sa_tac_yasft_arm #4100 [Jenkins] (yasdb.com) ](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4100/)  |/ddl_03/synonym/tac/test_sdv_synonym_01---同名对象报错,/dml1/forupdate/tac/for_update_basic---用例并发导致,/dml3/test_sdv_select/tac---用例并发导致,/dml4/filter_in_exists/tac---YAS-06412 no group aggregate info|lastfail已绿,  [Agile_L2_sa_tac_yasft_arm #4105 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4105/)  |
|6|  [Agile_L2_sa_heap_ha_profile #440 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_ha_profile/440/)  |实际执行成功,![WXWorkLocalPro_17337284422624.png](https://pingcode.yasdb.com/atlas/files/public/675698c2a1ad9a3311de4471/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFDQUFBQUFDQUFDQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJUUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5MDIsImV4cCI6MTc4MjQ2OTcwMn0.9pZjBhA4Uua1HzGMAGzFvhBqQqb0mZSOLHmzBBc7pc0)||
|7|  [Agile_L2_sa_upgrade_FT_1_docker #4833 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4833/)  |版本标签不对，升级报错||
|8|  [Agile_L2_sa_upgrade_FT_2_docker #4821 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4821/)  |![clipbord_1733474276664.png](https://pingcode.yasdb.com/atlas/files/public/6752de57a1ad9a3311de439e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFDQUFBQUFDQUFDQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJUUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg5MDIsImV4cCI6MTc4MjQ2OTcwMn0.9pZjBhA4Uua1HzGMAGzFvhBqQqb0mZSOLHmzBBc7pc0),--刷新预期，合入之后同步李世铭刷新预期||
|分布式||||
|1|  [Agile_L2_dst_lsc_yasft_arm #3600 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3600/)  |/datatype_01/blob/lsc---用例并发导致|lastfail已绿,  [Agile_L2_dst_lsc_yasft_arm #3606 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3606/)  |
|2|  [Agile_L2_dst_HA_Switch_docker #4466 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4466/)  |未定位出原因|已绿,  [Agile_L2_dst_HA_Switch_docker #4471 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4471/)  |
|3|  [Agile_L2_dst_yasft_code_sensitive_arm #218 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/218/)  |/tac/system_view/test_sdv_ydbrd_15210/tac/test_sdv_ydbrd_15210_SESSION_ROLES---同名对象报错|lastfail已绿,  [Agile_L2_dst_yasft_code_sensitive_arm #223 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/223/)  |
|4|  [Agile_L2_dst_pn_yasft_arm #149 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/149/)  |/DDL_02/test_ydbrd_13997_13656/not_in_dis/lsc/test_ydbrd13997_not_in_dis_061---YAS-05016 allocate material memory quota fail,/DML4/sort_parallel/serial_lsc/test_sort_parallel_ydbrd_22315_lsc_04---请求超时,/plsql/dbms_metadata/getddl_table_lsc/duplicated_table/test_sdv_ydbrd21730_getddl_duplicated_table_lsc_015---同名对象报错|lastfail已绿,  [Agile_L2_dst_pn_yasft_arm #150 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/150/)  |
|集群||||
|1|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3951 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3951/)  |/dml3/test_sdv_select/heap---[1:135]YAS-04310 invalid order column|lastfail已绿,  [Agile_L2_cluster_heap_yasft_sa_case_arm #3956 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3956/)  |
|2|  [Agile_L2_cluster_yasft_cluster_case_arm #4231 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4231/)  |/ddl/tablespace/local_swap_tablespace/test_sdv_YDBRD_21721_cluster_create_swapTS_002---并发影响,/plsql_DBMS_external/utl_encode---YAS-05220 resource is busy, try later,/plsql_DBMS_external_01/DBMS_SQL/SIT/19149---数据库重启,/plsql_DBMS_external_01/WHO_CALL_ME/WHO_CALL_ME_yac/test_sdv_who_called_me_clu_046---无关，忽略,/storage/external_table/test_sdv_YDBRD-21783_external_yfs_028---无关，忽略,/storage/materializaed_view/materializaed_view_privileges---刷新预期,/storage/table_encrypt/cluster---无关忽略,/storage/transaction/xa---无关，忽略|出来刷新预期的，其他已绿|
|3|  [Agile_L2_cluster_yasft_ycs_arm #3645 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3645/)  |集群搭建失败|重跑已绿,  [Agile_L2_cluster_yasft_ycs_arm #3651 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3651/)  |
|4|  [Agile_L2_cluster_yasft_yfs_arm #3539 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3539/)  |/yfs/yfs_mem_set_online/online_parameters---启动ycs超时,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002---用例并发影响|lastfail已绿,  [Agile_L2_cluster_yasft_yfs_arm [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/)  |
|5|  [Agile_L2_cluster_FT_ha_arm #1251 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1251/)  |fault_test/ycs_fault/network_fault/Para_Startstop_15230/test_sdv_cluster_18732_ha_01.py---环境校验失败--lastfail|  [Agile_L2_cluster_FT_ha_arm #1258 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1258/)  ,lastfail已绿|








  
