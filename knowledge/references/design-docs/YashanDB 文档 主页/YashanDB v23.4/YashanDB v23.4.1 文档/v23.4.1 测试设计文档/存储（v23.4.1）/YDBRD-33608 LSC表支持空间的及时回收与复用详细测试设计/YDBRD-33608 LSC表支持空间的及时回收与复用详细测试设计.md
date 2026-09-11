Created by 马爽, last modified on 十一月 12, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66d57d924283cf23d4f439f4](https://pingcode.yasdb.com/ship/ideas/66d57d924283cf23d4f439f4)    ?    
  #YASHAN-3264 LSC表支持空间的及时回收与复用

SR链接：    [https://pingcode.yasdb.com/pjm/items/6706446fe489dd0868f2e85c](https://pingcode.yasdb.com/pjm/items/6706446fe489dd0868f2e85c)    ?    
  #YDBRD-33608 LSC表支持空间的及时回收与复用

开发设计文档：    [【SpearFish】LSC表支持空间的及时回收与复用详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171067029)  

# 1. 概述

当前lsc表存在因clean任务不及时、调度频率低、清理粒度小导致的空间膨胀高问题，因此需要优化lsc表空间清理策略。

本文档描述lsc表支持空间的及时回收与复用测试设计。

# 2. 需求分析

## 2.1 功能点分析

该SR对lsc表空间回收及复用机制的优化表现在以下几点：

- 后台任务中的clean任务独立出来，统一到gbpg线程中，进行空间回收，提高调度频率。
- gbpg线程由原来的仅启库时启动改为常驻后台线程。
- 当lsc表插入热数据tablespace空间不足、热转冷databucket表空间不足时，会在一个循环内强制回收废弃空间，直至能申请出足够的空间/没有可回收空间。
- 当空间不足时，空间分配优先级：已有空间分配>>回收空间分配>>空间扩展分配，减少空间膨胀（已有机制）。


## 2.2 应用场景

- lsc表热数据转冷后tablespace空间回收
- lsc表冷数据compact合并后databucket空间回收
- lsc表truncate/drop后tablespace和databucket空间回收


## 2.3 规格约束

- 部署形态：单机、单机ha、分布式
- 无新增接口，  主备（单机），分布式部署模式下，后台GBPG线程由原先的启库执行一次变为常驻后台线程


# 3. 详细测试设计

## 3.1 测试设计方法

功能验证主要使用场景法测试，重点验证空间用满的情况下，空间是否可以正常回收。

## 3.2 详细测试设计

**3.2.1 使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式**

|序号|测试项|测试场景|预期结果|备注|
|---|---|---|---|---|
|1|tablespace空间回收及扩展|lsc表插入少量热数据（空间未用满），热转冷后，继续插入数据（  并发的分配空间少于已有空间）|插入数据成功，查看视图，废弃空间被回收（时间概率），空间未膨胀|  
|
|2|  
|lsc表插入少量热数据（空间未用满），热转冷后，继续插入数据（  并发的分配空间大于已有空间，少于已有空间+回收空间）|插入数据成功，查看视图，废弃空间被回收，空间未膨胀|  
|
|3|  
|lsc表插入少量热数据（空间未用满），热转冷后，继续插入数据（  并发的分配空间大于已有空间+回收空间）|插入数据成功，查看视图，废弃空间被回收，空间膨胀|  
|
|4|  
|lsc表插入热数据构造空间用满，热转冷后，继续插入数据（  并发的分配空间少于回收空间）|插入数据成功，查看视图，废弃空间被回收，空间未膨胀|  
|
|5|  
|lsc表插入热数据构造空间用满，热转冷后，继续插入数据（  并发的分配空间大于回收空间）|插入数据成功，查看视图，废弃空间被回收，空间膨胀|  
|
|6|  
|lsc表插入热数据后执行truncate操作，继续插入热数据|插入数据成功，查看视图，废弃空间被回收|  
|
|7|  
|lsc表插入热数据后执行drop操作|查看视图，废弃空间被回收|  
|
|8|databucket空间回收及扩展|lsc表热转冷构造少量slice（空间未用满），执行compact操作，继续插入数据热转冷（  并发的分配空间少于已有空间）|热转冷成功，查看视图，废弃空间被回收（时间概率）|  
|
|9|  
|lsc表热转冷构造少量slice（空间未用满），执行compact操作，继续插入数据热转冷（  并发的分配空间大于已有空间，少于已有空间+回收空间）|热转冷成功，查看视图，废弃空间被回收|  
|
|10|  
|~~lsc表热转冷构造大量slice空间用满，执行compact操作，继续插入数据热转冷（~~  ~~并发的分配空间少于回收空间~~  ~~）~~|~~热转冷成功，查看视图，废弃空间被回收~~|  
|
|11|  
|~~lsc表热转冷构造大量slice空间用满，执行compact操作，继续插入数据热转冷（~~  ~~并发的分配空间大于回收空间~~  ~~）~~|~~部分热转冷成功，查看视图，废弃空间被回收~~|databucket空间用满情况下无法执行compact操作|
|12|  
|lsc表热转冷后执行truncate操作，继续插入热数据执行热转冷|热转冷成功，查看视图，废弃空间被回收|  
|
|13|  
|lsc表热转冷后执行drop操作|查看视图，废弃空间被回收|  
|
|14|大数据量场景|向lsc表中插入大量热数据，调小ttl加快后台转换和清理任务|查看  空间使用情况（预期不会膨胀）|  
|
|15|主备HA场景|主备场景下，lsc表插入热数据构造tablespace空间用满，主备切换后，新主执行热转冷，继续插入热数据|插入数据成功，查看视图，tablespace废弃空间被回收|  
  切换方式switchover和failover都需要涉及|
|16|  
|主备场景下，lsc表热转冷构造databucket空间用满，主备切换后，新主执行compact操作，继续插入数据热转冷|热转冷成功，查看视图，databucket废弃空间被回收||
|17|  
|主备场景下，lsc表热转冷构造tablesapce空间用满，修改参数导致主failover失败，主执行热转冷，继续插入热数据|插入数据成功，查看视图，tablespace废弃空间被回收||
|18|  
|主备场景下，lsc表热转冷构造databucket空间用满，修改参数导致主failover失败，主执行热转冷，继续插入热数据|热转冷成功，查看视图，databucket废弃空间被回收||


**3.2.2 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，对原有工程不造成影响，复用已有CT工程|
|KT|涉及，对原有工程不造成影响，复用已有KT工程|
|长稳|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|涉及，后台clean任务效率无变化或降低，关注导数工程性能变化|
|可维护性|/|


# 4. 测试用例

文本用例

# 5. 测试框架设计

|框架|目录|个数|
|---|---|---|
|YTP|单机：/storage_object/tablespace/space_reclaim,分布式：/DDL_02/tablespace/space_reclaim|18+18|
|ha_regress|单机ha：,  [ha/ha_LSC/testcase/ha_schedule_common/tablespace/space_reclaim · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_LSC/testcase/ha_schedule_common/tablespace/space_reclaim)  |7|


# 6. 测试环境说明

linux arm环境

# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2024/11/08

实际测试完成事件：2024/11/11

# 8. 上车工程分析

上车构建工程链接：    [Agile_master_L2_Build #5600 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5600/)  

|部署形态|工程链接|失败用例及原因|lastfail结果|备注|
|---|---|---|---|---|
|单机|  [Agile_L2_sa_lsc_HA_4_docker #4364 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/4364/)  |yasft/ha/ha_LSC/testcase/ha_schedule_common/slice/test_sdv_slice_clean_04.py,在等待过程中有新的archive文件生成，用例不稳定|  [Agile_L2_sa_lsc_HA_4_docker #4365 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/4365/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396eff8970c2af4f521d00/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_sa_heap_HA_9_docker #502 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/502/)  |yasft/ha/ha_heap/testcase/ha_schedule/open_readonly/test_sdv_ydbrd_26538_readonly_023.py,用例不稳定导致|  [Agile_L2_sa_heap_HA_9_docker #504 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/504/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396eff8970c2af4f521d01/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_sa_tac_yasft_arm #3869 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3869/)  |/ddl_02/access_constraint/tac—回收站需求影响，忽略,/dml1/cte/cte_tac/test_sdv_cte03—用例并发影响,/dml3/test_sdv_update/tac/multi_table_update/test_sdv_multi_table_update_sub---,YAS-02161 no free space in global temporary table cache空间资源不足,/dml4/filter_in_exists/tac/test_sdv_filter_in_78---资源不足,![](https://pingcode.yasdb.com/atlas/files/public/67396eff8970c2af4f521d02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA),/dml4/filter_in_exists/tac/test_sdv_filter_in_78---同名对象报错|  [Agile_L2_sa_tac_yasft_arm #3873 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3873/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396effa1ad9a3311dc9b72/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_sa_heap_yasft_arm #4538 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4538/)  |/dml3/test_sdv_update/heap/multi_table_update—同名对象报错,/dml5/batch_hashjoin/test_ydbrd_26180_incline_02—字段长度不稳定？,/function2/dbms_stats/histograms/ydbrd_33484_histogram_opt_db_sa—未rebase相关代码,/function6/func_char2/heap/test_sdv_quality_func_regexp_count_comm_001—lastfail,/storage_object/profile/test_sdv_profile_idle_time_02_01—延迟，lastfail|  [Agile_L2_sa_heap_yasft_arm #4542 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4542/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d03/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_sa_yasft_code_sensitive_arm #25 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/25/)  |工程问题，忽略|  
|  
|
|  
|  [Agile_L2_sa_lsc_yasft_arm #4078 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4078/)  |/dml4/filter_in_exists/lsc—用例并发影响,/function2/math_func/lsc/test_sdv_func_acos_lsc–不稳定,/storage_object/tablespace/space_reclaim/test_sdv_ydbrd_33608_tablespace_009---新增用例影响，修改用例|  [Agile_L2_sa_lsc_yasft_arm [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_lsc_yasft_arm/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b73/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|分布式|  [Agile_L2_dst_tac_driver_jdbc_arm #2912 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/2912/)  |无关忽略|  
|  
|
|  
|  [Agile_L2_dst_lsc_yasft_arm #3382 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3382/)  |/DDL_02/tablespace/space_reclaim---新增用例失败，待确定|  [Agile_L2_dst_lsc_yasft_arm #3390 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/Agile_L2_dst_lsc_yasft_arm/3390/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d04/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_dst_yasft_code_sensitive_arm #23 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/23/)  |工程问题，忽略|  
|  
|
|  
|  [Agile_L2_dst_lsc_yaskt_arm #72 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/72/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b74/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA),om导致|  [Agile_L2_dst_lsc_yaskt_arm #74 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yaskt_arm/74/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b75/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|集群|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3750 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3750/)  |/CBO/left_join/data_type/test_sdv_cboGoo_dT_left_012,/ddl_01/constraint/fk/heap/test_sdv_constraint_fk_109,/ddl_01/create_alter_tb_with_constraints/using_index/heap/test_constraint_using_index_04,/dml1/cte/cte_svt/test_sdv_cte_name_01,/plsql_cursor/test_svt_opencur/test_svt_opencur_001—数据库重启导致,![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b76/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3753 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3753/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b77/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_cluster_yasft_cluster_case_arm #3996 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3996/)  |/plsql01/test_sdv_ydbrd29064/test_sdv_ydbrd29064_166---YAS-00103 no free block in application pool空间资源不足,/plsql_DBMS_external/dbms_metadata/getddl_view/test_sdv_getddl_view_07_heap—回收站需求影响，忽略,/plsql_DBMS_external_01/DBMS_LOB/heap/CREATE_FREETEMPORARY/test_sdv_YDBRD_13360_034,![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b78/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA),/storage/transaction/xa/test_sdv_ydbrd_26120_xa_021,![](https://pingcode.yasdb.com/atlas/files/public/67396f00a1ad9a3311dc9b79/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA),  [https://pingcode.yasdb.com/pjm/items/67288f55e489dd0868037ef8](https://pingcode.yasdb.com/pjm/items/67288f55e489dd0868037ef8)    ?    
  #YDBRD-34955 【长稳】集群4实例tpcc长稳运行12小时core在boDetachObject|  
|  
|
|  
|  [Agile_L2_cluster_yasft_ycs_arm #3453 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3453/)  |/ycs_common/ycs_monitor_db/ycs_parameter_RESTART_TIMES–超时,/ycs_common/ycs_monitor_db/ycs_parameter_STOP_STEP–超时,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  [Agile_L2_cluster_yasft_ycs_arm #3455 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3455/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_cluster_yasft_yfs_arm #3343 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3343/)  |/yfs/yfs_mem_set_online/online_parameters—start ycs超时,/yfs/yfscmd/multi/dirmanager/test_sdv_cluster_yfscmd_dirmanager_002,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  [Agile_L2_cluster_yasft_yfs_arm #3345 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3345/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d08/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_cluster_backup_arm_3 #1865 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1865/)  |yasft/ha/ha_cluster/testcase/backup/backup_yasrman/test_cluster_yasrman_11.py---用例不稳定|  [Agile_L2_cluster_backup_arm_3 #1867 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1867/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d09/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_cluster_jdbc_arm #1497 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1497/)  |跑lastfail|  [Agile_L2_cluster_jdbc_arm #1499 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1499/)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d0a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|  
|
|  
|  [Agile_L2_cluster_yasft_code_sensitive_arm #24 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/24/)  |工程问题，忽略|  
|  
|
|  
|  [Agile_L2_cluster_FT_ha_arm #1052 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1052/)  |common/dml/insert_into_select_para/test_sdv_YASHAN_2817_para_insert_select_ha_03.py—用例不稳定,![](https://pingcode.yasdb.com/atlas/files/public/67396f008970c2af4f521d0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUJBQUFJQUFBRUFRQmdBQUlJUUFBa0FBQUFnQUFnQUFBTUFJQ0FRQUNBQUFBZ0JBZ0FCQmtBd2hBZ0lBQ0lBSUtBUUFJQUlBQ0FBQUFBQUJJQUNBQUJBSUFBQUFBQXdBb1FJQUVJQUtVQW9BQUFBUWdBSUFDQUpSQ0FBQkNnRUFFQUFFZ0FnQUFRQUFwQUJBRUFBQUlBUUVEUkFRZ0VBQUFBQkFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg4MDksImV4cCI6MTc4MjQ2OTYwOX0.CHmm5ZcE-sAdlU9aRVEpQyIPkCD6WGQOZlA2PNQAhqA)|不影响，忽略|  
|


## Attachments:

[lsc表空间回收与复用文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmVhMWFkOWEzMzExZGM5YjY0IiwicmVmX2lkIjoiNjczOTZlZmU3MjgyMDZlZmI5MmYyZjY3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODA5LCJleHAiOjE3ODI1NDUyMDl9.1E0kR3-Q601OPKlyC75EURtedf9MCyyZJbpohIXrJI8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[lsc表空间回收与复用文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmU4OTcwYzJhZjRmNTIxY2Y0IiwicmVmX2lkIjoiNjczOTZlZmU3MjgyMDZlZmI5MmYyZjY3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODA5LCJleHAiOjE3ODI1NDUyMDl9.Z0kfKdR_FsE0PpwljpkbBhLlcZ-7D9SwbELikHmvZL4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-11-11_18-45-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZmZhMWFkOWEzMzExZGM5YjY4IiwicmVmX2lkIjoiNjczOTZlZmU3MjgyMDZlZmI5MmYyZjY3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODA5LCJleHAiOjE3ODI1NDUyMDl9.ScYgzDxfO3viizi85wNynjDH2b0HsW7QWF4uVLYhsLU)

 (image/png)    


## Comments:

|  [](null)  ,LSC表支持空间的及时回收与复用测试设计评审会议纪要    
  会议时间：2024.10.23 11:30-12:00    
  会议地点：1002会议室    
  参会人员：马爽、易文亮、谢锐、黄文早、陈晓晴    
  会议纪要：    
  1、跟开发对齐空间回收的观测手段，tablespace空间可以查看v$datafiles，slice待定,2、开发需要确定lsc表的truncate/drop操作后空间是否立即释放,3、主备模式下开启归档后，空间回收存在延迟，先备份后清理？,4、构造场景时使用定长字符构造稳定数据（char类型不超过32字节）,Posted by mashuang at 十月 23, 2024 14:40|
|---|
