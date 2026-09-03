Created by 牛亚娜, last modified on 三月 27, 2024



-   [1. 概述](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-1.概述)  
-   [2. 需求分析  ](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-2.需求分析)  
-   [3. 测试设计方法](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-3.测试设计方法)  
-   [4. 详细测试设计   ](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-4.详细测试设计)  
    -   [4.1 读写ycs盘的操作](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-4.1读写ycs盘的操作)  
    -   [4.2 读写ycs盘的基本场景](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-4.2读写ycs盘的基本场景)  
    -   [4.3 读写ycs盘的并发场景](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-4.3读写ycs盘的并发场景)  
-   [5. 测试框架设计](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-5.测试框架设计)  
-   [6. 测试用例](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-6.测试用例)  
-   [7. 测试环境说明](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-7.测试环境说明)  
-   [8. 上车工程分析](#id-【YDBRD15222】【共享集群】增加ycs的校验机制和冗余设计测试设计-8.上车工程分析)  




## 1.   **概述**

集群增加ycs的校验机制和冗余设计 测试设计

## 2.   **需求分析**

SR：    [YDBRD-15222](https://jira.yasdb.com/browse/YDBRD-15222?src=confmacro)    -  【共享集群】增加ycs的校验机制和冗余设计  完成

设计文档：    [崖山集群注册ycr设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=109576975)  

原理：在磁盘中开辟一个临时存储区域，写数据时，先将数据写到临时区域，待临时区域写成功后，再写到最终存储区域，读取ycr数据时，先检查临时存储区是否有效，如果有效或者CRC校验失败，则用临时存储区的数据覆盖最终存储区。

1、写入时：计算CRC，并依次将CRC写入到临时区域和持久化区域中

2、读取时：校验CRC，如果CRC有问题，校验临时区的CRC并用临时区数据来恢复持久化区域

## 3.   **测试设计方法**

主要采用场景法，罗列ycs操作的相关场景，通过ycsycrdump工具构造故障，再进行ycs盘的读写

## 4.   **详细测试设计**

### 4.1 读写ycs盘的操作

|  
|操作|备注|
|---|---|---|
|1|ycs启动|  
|
|2|ycs+db启动|  
|
|3|kill节点（当前不可测）|  
|


### 4.2 读写ycs盘的基本场景

|  
|场景|预期|
|---|---|---|
|1|双写区异常，双写区数据有效，此时读ycs盘|读取失败|
|2|双写区异常，双写区数据已写入最终存储区，此时读ycs盘|ycs盘数据可正常读取|
|3|最终存储区异常，双写区数据有效，此时读ycs盘|读取成功，最终存储区被双写区覆盖|
|4|最终存储区异常，双写区数据已写入最终存储区，此时读ycs盘|读取成功，最终存储区被双写区覆盖|
|5|双写区和最终存储区都异常，双写区数据有效，此时读ycs盘|读取失败|
|6|双写区和最终存储区都异常，双写区数据已写入最终存储区，此时读ycs盘|读取失败|
|7|双写区和最终存储区都正常，双写区数据有效，此时读ycs盘|读取成功，最终存储区被双写区覆盖|
|8|双写区和最终存储区都正常，双写区数据已写入最终存储区，此时读ycs盘|读取成功|


### 4.3   读写ycs盘的并发场景

|  
|  
|分类|
|---|---|---|
|1|场景|最终存储区异常，双写区数据有效，此时读ycs盘|
|2|  
|最终存储区异常，双写区数据已写入最终存储区，此时读ycs盘|
|3|读写ycs盘并发操作|ycs启动+ycs启动|
|4|读写ycs盘的实例|同一实例|
|5|  
|不同实例|
|6|读写ycs盘的实例角色|主实例|
|7|  
|备实例|


## 5.   **测试框架设计**

测试工具：

## 6.   **测试用例**

[【YDBRD-15222】增加ycs的校验机制和冗余设计-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzZhMWFkOWEzMzExZGM3OGVmIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.izMKk3FHHE0kCS3Qg_20IA9B010MlBU0xnNH05F4X4Y)

[【YDBRD-15222】增加ycs的校验机制和冗余设计-文本用例_新.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzZhMWFkOWEzMzExZGM3OGYwIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.EYZLJd_nzLpPZEBD5wW9peB6wHmxvfXScGgwzN7Wl48)

## 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## 8.   **上车工程分析**

工程链接：    [Agile_master_L2_Build #2396 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/2396/)  

![](https://pingcode.yasdb.com/atlas/files/public/673969c6a1ad9a3311dc78f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBSUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBa0FBQUFnQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg5NDksImV4cCI6MTc4MjIxOTc0OX0.Fp6CBDG5ReUxu3eVu7RpjgImUG5Ke4FmxzFXXVYNTrc)

![](https://pingcode.yasdb.com/atlas/files/public/673969c68970c2af4f51fa7e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBSUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBa0FBQUFnQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg5NDksImV4cCI6MTc4MjIxOTc0OX0.Fp6CBDG5ReUxu3eVu7RpjgImUG5Ke4FmxzFXXVYNTrc)

|工程链接|失败用例|失败原因|解决方案|
|---|---|---|---|
|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/48/)  |/dml4/predicate_optimization/and_merge_interval/lsc/test_sdv_and_im_lsc_03.sql     
  /dml4/predicate_optimization/reverse_operation/filter_lsc/tb_ydbrd_5223_filter_001_lsc.sql     
  /dml4/inlist/inlist/lsc/test_sdv_in_optimizer_lsc.sql|"YAS-02011 no free blocks in large pool"报错，跑last fail，70，71，75|pass|
|  [Agile_L2_sa_lsc_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/2217/)  |/var/lib/jenkins/yasbuild/Agile_L2_sa_lsc_HA_2_docker/anchor_test/ha_LSC/testcase/ha_schedule1/test_yasminer_lsc.py    
  /var/lib/jenkins/yasbuild/Agile_L2_sa_lsc_HA_2_docker/anchor_test/ha_LSC/testcase/ha_schedule_common/path/test_sdv_relative_path_yasminer.py|大境已提单--YDBRD-17375|忽略|
|  [Agile_L2_sa_heap_HA_6_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1731/)  |anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_01.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_02.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_03.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_04.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_06.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_09.py,anchor_test/ha/testcase/ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_10.py|其他上车工程共性问题,上车消息流返回中文问题，CI解决后跑last fail,  [Agile_L2_sa_heap_HA_6_docker #1780 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/1780/console)  |last fail  通过|
|  [Agile_L2_sa_heap_HA_4_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/1725/)  |anchor_test/ha/testcase/ha_schedule_common/db_Privilege/system_Privilege/test_sdv_sysPrivilege_role_001.py,anchor_test/ha/testcase/ha_schedule_common/db_Privilege/system_Privilege/test_sdv_sysPrivilege_user_001.py,anchor_test/ha/testcase/ha_schedule/DB_objects/ha_role.py|regress用户创建失败，  大境已统一修改，重新构建 #1759,  [Agile_L2_sa_heap_HA_4_docker #1759 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/1759/)  |last fail  通过|
|  [Agile_L2_sa_heap_HA_5_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1672/)  |anchor_test/ha/testcase/ha_schedule/basic_trigger.py|主机未open,  [Agile_L2_sa_heap_HA_5_docker #1699 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1699/console)  ,再次构建后用例失败,anchor_test/ha/testcase/ha_schedule/DB_objects/ha_histogram.py|忽略|
|  [Agile_L2_cluster_CT_gcs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_CT_gcs_arm/103/)  |  
|超时,  [Agile_L2_cluster_CT_gcs_arm #117 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_CT_gcs_arm/117/console)  ,再次构建偶现core“grcRecoverBlockOwnerInfo”，已知问题，实例异常退出|忽略|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/108/)  |  
|超时,  [Agile_L2_cluster_heap_yasft_sa_case_arm #122 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/122/console)  |再次构建，成功|
|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/120/)  |/dfx/cluster_audit/cluster_syn_audit/test_sdv_ydbrd_13352_cluster_audit_08.sql,/system_view/dynamic_view/v_view/GRC_RESOURCE/test_sdv_ydbrd_13415_gls_resource_scene_007.sql|用例不稳定,  [Agile_L2_cluster_yasft_cluster_case_arm #143 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/143/console)  |last fail  通过|
|  [Agile_L2_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/111/)  |/ycsNodeStartStop001/NodeStartStop_ByMaster/test_sdv_cluster_ycs_NodeStartStop_Bymaster_scen7_tablespace_006.sql|超时,  [Agile_L2_cluster_yasft_ycs_arm #125 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/125/console)  ,  [Agile_L2_cluster_yasft_ycs_arm #148 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/148/)    --  启停失败，不稳定|忽略|
|  [Agile_L2_dst_tac_FT_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_FT_docker/1140/)  |  
|超时,  [Agile_L2_dst_tac_FT_docker #1157 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_FT_docker/1157/console)  |再次构建，成功|
|  [Agile_L2_dst_FT_yasldr_expimp](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_expimp/840/)  |  
|构建失败，部署失败,  [Agile_L2_dst_FT_yasldr_expimp #868 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_expimp/868/console)  |再次构建，成功|
|  [Agile_L2_dst_lsc_FT_1_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_1_docker/1138/)  |  
|超时,  [Agile_L2_dst_lsc_FT_1_docker #1155 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_1_docker/1155/console)  |再次构建，成功|


## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzY4OTcwYzJhZjRmNTFmYTdjIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.izTMXBRSmBKxkGAzD-Q3yu6MTgKyKNIDGZ8dznzwOMw)

 (image/svg+xml)    


[image2023-7-10_9-20-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzZhMWFkOWEzMzExZGM3OGYxIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.HCFt-1FgDNgBUhxRnocDR_YymxZqQEVHZsJvVLrqEek)

 (image/png)    


[image2023-6-1_9-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzZhMWFkOWEzMzExZGM3OGYyIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.rVsZl4XDmb5EAdM30BSOIsOR9p_yagJHe0t2Qyjmjwg)

 (image/png)    


 (application/octet-stream)    


 (application/octet-stream)    


[【YDBRD-15222】增加ycs的校验机制和冗余设计-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzZhMWFkOWEzMzExZGM3OGVmIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.izMKk3FHHE0kCS3Qg_20IA9B010MlBU0xnNH05F4X4Y)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[【YDBRD-15222】增加ycs的校验机制和冗余设计-文本用例_新.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzZhMWFkOWEzMzExZGM3OGYwIiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ5LCJleHAiOjE3ODIyOTUzNDl9.EYZLJd_nzLpPZEBD5wW9peB6wHmxvfXScGgwzN7Wl48)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
