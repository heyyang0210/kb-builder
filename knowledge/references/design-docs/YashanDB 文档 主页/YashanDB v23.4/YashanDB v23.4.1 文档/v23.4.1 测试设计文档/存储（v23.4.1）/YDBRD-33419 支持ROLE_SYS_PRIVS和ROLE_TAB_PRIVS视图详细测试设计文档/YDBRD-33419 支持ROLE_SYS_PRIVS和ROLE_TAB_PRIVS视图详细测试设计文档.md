# 1. 概述

支持ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图，查看授予角色的系统权限和对象权限。

IR链接：  [https://pingcode.yasdb.com/ship/ideas/66c7341189f961f3300fb9e1?](https://pingcode.yasdb.com/ship/ideas/66c7341189f961f3300fb9e1?)  

#YASHAN-3142  支持ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图

SR链接：  [https://pingcode.yasdb.com/pjm/items/67049fafe489dd0868f186f7?](https://pingcode.yasdb.com/pjm/items/67049fafe489dd0868f186f7?)  

#YDBRD-33419 支持ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图

# 2. 需求分析

## 2.1 功能点分析

#### 2.1.1 ROLE_SYS_PRIVS视图

描述了授予给角色的系统权限，它可以查看某个角色所包含的系统权限，具体字段如下：

|字段|数据类型|含义|
|---|:---|:---|
|ROLE|VARCHAR2(64)|角色名称|
|PRIVILEGE|VARCHAR2(64)|授予角色的系统权限|
|ADMIN_OPTION|CHAR(1)|表明授予是否带有选项  `ADMIN`  (   `YES`  ) 或不带有选项 (   `NO`  )|


#### 2.1.2 ROLE_TAB_PRIVS视图

描述了授予给角色的对象权限，它可以查看某个角色所包含的表权限

|字段|数据类型|含义|
|---|:---|:---|
|ROLE|VARCHAR2(64)|角色名称|
|OWNER|VARCHAR2(64)|对象的拥有者|
|TABLE_NAME|VARCHAR2(64)|对象名称|
|PRIVILEGE|VARCHAR2(64)|授予角色的对象权限|
|GRANTABLE|CHAR(1)|表明授予是否带有选项  `GRANT`  (   `YES`  ) 或不带有选项 (   `NO`  )|


该需求主要是针对ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图进行测试，重点从以下两方面进行验证：

- 角色的权限信息在视图中是否可以正常显示，字段正确、无乱码
- 角色的权限信息与实际拥有的权限保持一致


## 2.2 规格约束

- 需求范围：单机、集群，分布式暂不支持（待分布式下heap的connect by语法支持后自然支持）
- 规格约束：yashan不支持grant 系统权限给角色带with admin option，也不支持grant 对象权限给角色带with grant option
- 与友商的差异：


1. oracle的ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图显示的role信息分为两种：1）当前用户上创建的role，可以在ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图上查询到权限信息；2）当前用户上被grant的role，可以在ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图上查询到权限信息，比如说：userA创建了role1，可以在视图中查到role1的信息，但是userB无法在视图中查到role1的信息；将grant role1 to userB后，就可以在视图中查到role1的信息。
1. yashan上并没有role的owner概念，因此ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图中仅显示当前用户上被grant的role信息，与oracle存在差异
1. yashan上的sys用户并不是由很多role赋权组成的，因此ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图为空，oracle的sys用户是由很多role赋权组成的，ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图可以查询到内容。




# 3. 详细测试设计

## 3.1 测试设计方法

主要使用等价类和场景分析法进行测试：

1、需要包含不同的系统权限和对象权限类型校验

2、验证各个场景下视图中角色权限信息显示是否正确

## 3.2 详细测试设计

**1、使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式**

|编号|测试项|测试场景|测试步骤|备注|
|---|---|---|---|---|
|1|视图字段校验|desc   ROLE_SYS_PRIVS  ;,desc   ROLE_TAB_PRIVS  ;|视图结构与设计文档一致||
|2||ROLE_SYS_PRIVS视图正确性校验|1、create role，将role grant 给user，并grant系统权限,2、登录到user上，查看  ROLE_SYS_PRIVS视图是否显示系统权限信息,3、切换用户，revoke系统权限,4、  登录到user上，查看  ROLE_SYS_PRIVS视图是否移除系统权限信息|yashan已有的系统权限：  [系统特权管理 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E4%BA%A7%E5%93%81%E5%AE%89%E5%85%A8/%E6%8E%88%E6%9D%83/%E7%B3%BB%E7%BB%9F%E7%89%B9%E6%9D%83%E7%AE%A1%E7%90%86/00%E7%B3%BB%E7%BB%9F%E7%89%B9%E6%9D%83%E7%AE%A1%E7%90%86.html)  |
|3||ROLE_TAB_PRIVS视图正确性校验|1、create role，create table，将role grant 给user，并grant对象权限,2、登录到user上，查看  ROLE_TAB_PRIVS视图是否显示对象权限信息,3、切换用户，revoke对象权限,4、  登录到user上，查看  ROLE_TAB_PRIVS视图是否移除对象权限信息|yashan已有的对象权限：  [对象特权管理 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E4%BA%A7%E5%93%81%E5%AE%89%E5%85%A8/%E6%8E%88%E6%9D%83/%E5%AF%B9%E8%B1%A1%E7%89%B9%E6%9D%83%E7%AE%A1%E7%90%86/00%E5%AF%B9%E8%B1%A1%E7%89%B9%E6%9D%83%E7%AE%A1%E7%90%86.html)  |
|4||主备环境下，检查视图是否同步|1、主备环境下，主机授权给role，备机查询视图是否同步,2、备升主后，旧主取消role上的授权，备机查询视图是否同步||
|5|对象权限和系统权限交互|给角色授权系统权限，查看  ROLE_TAB_PRIVS是否显示权限信息|ROLE_TAB_PRIVS不会显示系统权限||
|6||给角色授权对象权限，查看  ROLE_SYS_PRIVS是否显示权限信息|ROLE_SYS_PRIVS不会显示对象权限||
|7||userA创建role并给role授权，并将角色grant to userB，登录到userB上查询视图|userA上无法查询到视图信息，userB上无法查询到视图信息|oracle在owner上（userA）是可以查询到权限信息，与oracle保持差异|
|8||授权给role1，将role1授权给role2，查看视图|可以查询到role1的权限信息，但是role2的信息为空||
|9||授权给内置角色，查看视图|查询视图，内置角色的权限信息显示正确|yashan已有的内置角色：  [内置角色 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E4%BA%A7%E5%93%81%E5%AE%89%E5%85%A8/%E6%8E%88%E6%9D%83/%E8%A7%92%E8%89%B2%E7%AE%A1%E7%90%86/%E5%86%85%E7%BD%AE%E8%A7%92%E8%89%B2.html)  |
|10||给角色授权的with admin option/with grant option校验|yashan不支持给role授权带with admin option/with grant option||
|11||一次性grant多个role，查看视图|1、create多个role，并授予权限,2、查看视图||
|12|其他|创建用户未赋权查询视图失败，赋权后查询成功|赋权后查询成功||
|13||视图写操作拦截（create、create as select、drop、alter、dml）|写操作被拦截||
|14||视图select查询验证（select 不带filter、带filter、group by、join、子查询、having、distinct、order by、limit)|查询结果匹配准确||
|15|CT|多session、多实例并发查询视图与ddl、dml业务并发|实例不core不卡||
|16|KT|多session、多实例并发查询视图与ddl、dml业务并发+kill|实例不core不卡||
|17|版本升级|单机/分布式/集群从其他版本升级到23.4版本，查看视图|ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图|23.2.3.101升级到23.4,![WXWorkLocalPro_17361483386501.png](https://pingcode.yasdb.com/atlas/files/public/677b858fa1ad9a3311de60c1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE),23.3.2.100升级到23.4（master主干有问题，暂不测试）|
|18|资料验证|查看资料文档|资料文档中视图说明正确||


**2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

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

### 4.1 测试设计评审时提供冒烟文本用例；

  [test_role_privs.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3NzllZWZhMWFkOWEzMzExZGU1ZWRjIiwicmVmX2lkIjoiNjc2YThlMDBhMDNiODIzNDg2MGM2NjFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NDE5LCJleHAiOjE3ODI1NDU4MTl9.KjWIDx7OV1AAUuGYfnY5XKPkiVeiY770aHxImAtkiww)  

### 4.2 启动测试之前提供文本用例，并完成大部分自动化用例；

  [支持ROLE_SYS_PRIVS和ROLE_TAB_PRIVS视图文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3YmNlZTBhMWFkOWEzMzExZGU2MTU5IiwicmVmX2lkIjoiNjc2YThlMDBhMDNiODIzNDg2MGM2NjFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NDE5LCJleHAiOjE3ODI1NDU4MTl9.zCLrztaIgslysfyrTnMyMOt2AJE94oujZlW3J35atac)  

# 5. 测试框架设计

|测试框架|用例路径|用例个数|备注|
|---|---|---|---|
|YTP|/system_view/role_view|11|分布式暂不支持|
|ha|ha/ha_heap/testcase/new/Dynamic_view/test_sdv_ydbrd_33419_role_privis.py|1||
|CT/KT|standalone/storage_testcase/ddl/role/heap|1||


# 6. 测试环境说明

linux arm环境

# 7. 工作量评估

工作量：7人天

计划测试完成时间：2025/1/3

# 8. 上车工程分析

上车工程构建链接：  [Agile_master_L2_Build #5934 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5934/)  

|编号|工程链接|失败用例|备注|
|---|---|---|---|
|单机||||
|1|  [Agile_L2_sa_heap_HA_1_docker #5985 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5985/)  |ha_heap/testcase/ha_schedule_common/logic_copy/database_Level/test_sdv_YDBRD_21627_012.py--刷新预期,  [Agile_L2_sa_heap_HA_1_docker #5988 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5988/)  lastfail已绿||
|2|  [Agile_L2_sa_heap_yasft_arm #5127 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5127/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_heap_yasft_arm #5130 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5130/)  ,/heap/ddl_03/userView/refresh_force_view/test_sa_ydbrd22904_force_view_08---YDBRD-34651问题单合入，预期还没刷新,/heap/function3/OLAP_func/heap/test_sdv_OLAP_listagg/test_ydbrd7228_listagg_001---udt相关，与需求无关,/heap/storage/system_oid/test_sdv_single_oid_01---WRI$_OPTSTAT_OPR和WRI$_OPTSTAT_OPR_TASKS字段变更，与需求无关||
|3|  [Agile_L2_sa_tac_yasft_arm #4319 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4319/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_tac_yasft_arm #4322 [Jenkins] (yasdb.com) ](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4322/)   lastfail已绿||
|4|  [Agile_L2_sa_lsc_yasft_arm #4563 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4563/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_lsc_yasft_arm #4563 [Jenkins] (yasdb.com) ](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4563/)  /lsc/dml1/crab/lsc/test_func_YDBRD7674_ethnum_lsc---未使用科学计数，与需求无关,![WXWorkLocalPro_17359011151943.png](https://pingcode.yasdb.com/atlas/files/public/6777bfc2a1ad9a3311de5f40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE)||
|5|  [Agile_L2_sa_FT_yasldr_1 #4890 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/4890/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_FT_yasldr_1 #4893 [Jenkins] (yasdb.com) ](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/4893/)  lastfail已绿||
|6|  [Agile_L2_sa_heap_yasft_profile #1448 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/1448/)  |/storage_object/profile/test_sdv_profile_idle_time_06---用例并发影响，lastfail,  [Agile_L2_sa_heap_yasft_profile #1451 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/1451/)    lastfail已绿||
|7|  [Agile_sa_L2_empty_string_yasft_arm #249 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/249/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_sa_L2_empty_string_yasft_arm #252 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/252/)    lastfail已绿||
|8|  [Agile_L2_sa_FT_expimp_1 #2155 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_1/2155/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_FT_expimp_1 #2158 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_1/2158/)   lastfail已绿||
|9|  [Agile_L2_sa_yasft_code_sensitive_arm #435 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/435/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_yasft_code_sensitive_arm #438 [Jenkins] (yasdb.com) ](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/438/)  lastfail已绿||
|10|  [Agile_L2_sa_FT_expimp_2 #2151 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_2/2151/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_FT_expimp_2 #2154 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_2/2154/)  lastfail已绿||
|11|  [Agile_L2_sa_heap_driver_python_debug_docker #2450 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/2450/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_sa_heap_driver_python_debug_docker #2453 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/2453/)  lastfail已绿||
|12|  [Agile_L2_sa_heap_ha_profile #623 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_ha_profile/623/)  |用例执行成功，退出断言失败,![WXWorkLocalPro_17358962609962.png](https://pingcode.yasdb.com/atlas/files/public/6777accca1ad9a3311de5f0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE)||
|13|  [Agile_L2_sa_heap_driver_jdbc_debug_docker #2452 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/2452/)  |gis问题，rebase最新版本后跑lastfail---共同问题，忽略||
|集群||||
|1|  [Agile_L2_cluster_yasft_cluster_case_arm #4481 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4481/)  |gis问题，rebase最新版本后跑lastfail,  [Agile_L2_cluster_yasft_cluster_case_arm #4485 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4485/)  ,/ddl/tablespace/local_swap_tablespace/test_sdv_YDBRD_21721_cluster_create_swapTS_002---用例并发影响,/ddl_02/outline/test_sdv_outline_ydbrd_34666_other_03---用例并发影响,/partition_table/merge_partition/cluster/ydbrd_26226_merge_partition_003_1--排序问题,/plsql/yaswrap/test_yaswrap_sm3_sr31455_22---未rebase相关代码,/plsql_DBMS_external_01/WHO_CALL_ME/WHO_CALL_ME_yac/test_sdv_who_called_me_clu_046---未定位出原因，无关,![WXWorkLocalPro_17361308205437.png](https://pingcode.yasdb.com/atlas/files/public/677b410ba1ad9a3311de602f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE),/storage/external_table/test_sdv_YDBRD-21783_external_yfs_028---用例并发影响,/storage/materializaed_view/mv_rewrite/part_text/mv_part_text_rwrt_008---用例并发影响,/storage/partition_table/sub_partition/sub_partition_other/test_sdv_ydbrd_21549_foreign_key_003---YDBRD-36498已知问题,/storage/temporary_table/basic/test_sdv_cluster_global_temporary_table_01---框架问题,![WXWorkLocalPro_17361327604605.png](https://pingcode.yasdb.com/atlas/files/public/677b489fa1ad9a3311de6042/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE),/storage/transaction/multi_node_transaction/multi_table_update_transaction/test_sdv_cluster_multi_table_update_001--框架问题,/storage/transaction/xa---未定位出原因,  [Agile_L2_cluster_yasft_cluster_case_arm #4502 [Jenkins] (yasdb.com)    lastfail已绿](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_cluster_case_arm/4502/)  ||
|2|  [Agile_L2_cluster_yasft_yfs_arm #3734 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3734/)  |/yfs/yfs_mem_set_online/online_parameters---启动ycs超时,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002---用例并发影响，无需求无关||
|3|  [Agile_L2_cluster_backup_arm_3 #2236 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/2236/)  |ha/ha_cluster/testcase/backup/backup_yasrman/test_cluster_yasrman_11.py---用例并发影响，与需求无关,![WXWorkLocalPro_1735896632492.png](https://pingcode.yasdb.com/atlas/files/public/6777ae40a1ad9a3311de5f14/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE)||
|4|  [Agile_L2_cluster_FT_ha_arm #1443 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1443/)  |环境搭建失败，重跑已绿,  [Agile_L2_cluster_FT_ha_arm #1446 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1446/)  ||
|5|  [Agile_L2_cluster_yasft_code_sensitive_arm #419 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/419/)  |环境搭建失败，重跑已绿,  [Agile_L2_cluster_yasft_code_sensitive_arm #422 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/422/)  ||
|分布式||||
|1|  [Agile_L2_dst_tac_yasft_32K_arm #3085 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/3085/)  |/DDL_01/alter/tac/anc/test_sdv_anc_altertb_47---快照过期，lastfail已绿,  [Agile_L2_dst_tac_yasft_32K_arm #3088 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/3088/)  ||
|2|  [Agile_L2_dst_tac_yasft_arm #3560 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3560/)  |/DDL_03/refresh_force_view/tac---预期落后,/DML6/limit/tac---空间不足,/function2/test_sdv_dml_base/tac---空间不足,/function2/test_sdv_dml_date/tac---预期落后,/function4/test_sdv_split/tac/test_sdv_split_09--预期落后,![WXWorkLocalPro_17358970332996.png](https://pingcode.yasdb.com/atlas/files/public/6777afcfa1ad9a3311de5f19/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFRQ0FBZ0FBQUFnQUFBQUFBQUFBQUFnQWlBQ0FBQUFFQUFBQkJBRUFBQUVBQUFBQUFnQUFnQUFBQkFBZ0FBQUFCQUFBQUFBQUFBQVFBZ0FRQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBSUFBQUFBQUFTSUFBSUFBQUFBQUFBQUFBQkFBQWdnQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk0MTksImV4cCI6MTc4MjQ3MDIxOX0.uok6IYIrqJQ40u8KCFxL_8M8Bd8MX7QDurx6I7A57OE),  [Agile_L2_dst_tac_yasft_arm #3563 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3563/)  ,/DML6/limit/tac---空间不足,/function2/test_sdv_dml_base/tac---空间不足,  [Agile_L2_dst_tac_yasft_arm #3581 [Jenkins] (yasdb.com)   lastfail已绿](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/Agile_L2_dst_tac_yasft_arm/3581/)  ||
|3|  [Agile_L2_dst_FT_yasboot_load #4467 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasboot_load/4467/)  |ColumnarVmBuffer不足导致的报错，lastfail已绿,  [Agile_L2_dst_FT_yasboot_load #4470 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasboot_load/4470/)  ||
|4|  [Agile_L2_dst_lsc_yasft_arm #3846 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3846/)  |重跑,  [Agile_L2_dst_lsc_yasft_arm #3850 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3850/)  ,已知core问题影响YDBRD-37184||
|5|  [Agile_L2_dst_lsc_yaskt_arm #439 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/439/)  |已知core问题影响YDBRD-37184||
|6|  [Agile_L2_dst_lsc_yasct_arm #428 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasct_arm/428/)  |已知core问题影响YDBRD-37184||
|7|  [Agile_L2_dst_pn_yasft_arm #319 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/319/)  |超时，已知卡住问题YDBRD-37184||
|8|  [Agile_L2_dst_heap_yasft_arm #85 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_heap_yasft_arm/85/)  |/DDL_03/refresh_force_view/heap/test_dis_ydbrd22904_force_view_08--预期不是最新,/DML3/cte/heap/test_sdv_cte_func_01_heap---未定位出原因,/datatype/clob/heap/clob_base---未定位出原因,/function2/test_sdv_dml_date/heap---预期不是最新,/function4/test_sdv_split/heap---预期不是最新,lastfail已绿   [Agile_L2_dst_heap_yasft_arm #89 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_heap_yasft_arm/89/)  ||
|9|  [Agile_L2_dst_yasft_code_sensitive_arm #416 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/416/)  |/tac/system_view/test_sdv_ydbrd_15210/tac---同名对象报错，lastfail已绿,  [Agile_L2_dst_yasft_code_sensitive_arm #419 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/419/)  ||
|10|  [Agile_L2_dst_HA_Switch_docker #4653 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4653/)  |工程没跑起来,  [Agile_L2_dst_HA_Switch_docker #4657 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4657/)  ||
|11|  [Agile_L2_dst_tac_driver_jdbc_arm #3288 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/3288/)  |gis问题，rebase最新版本后跑lastfail，与需求无关||


