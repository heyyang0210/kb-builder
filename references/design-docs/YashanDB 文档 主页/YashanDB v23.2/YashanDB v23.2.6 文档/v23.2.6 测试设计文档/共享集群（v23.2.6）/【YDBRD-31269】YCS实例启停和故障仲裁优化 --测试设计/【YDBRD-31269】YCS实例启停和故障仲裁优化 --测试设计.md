Created by 张茜, last modified on 九月 11, 2024

# 1. 概述

本文描述共享集群YCS实例启停和故障仲裁优化  的测试设计。

  [https://pingcode.yasdb.com/pjm/items/66b329568f5ee191734b1c62](https://pingcode.yasdb.com/pjm/items/66b329568f5ee191734b1c62)    *?*    
  *#YDBRD-31269 YCS实例启停和故障仲裁优化*

开发设计文档：    [YCS实例启停和故障仲裁优化详细设计文档 - 杜宇轩 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163016692)  

# 2. 需求分析

## 2.1 功能点分析

本需求主要为内部优化需求，之前  ycs启动流程、停止流程、故障处理流程同属于一个线程处理；但启停与故障处理属于两个完全独立的功能，不应该耦合到一起。因此需要优化此逻辑。

针对现有逻辑发生变化的点：

1）新增一个线程处理集群管理子模块的投票消息以在实例启停期间也能更新主备关系

投票结果处理--新增线程处理

## 2.2 应用场景

集群正常启停、并发启停、网络故障（断网卡、丢包、延迟等）、混合故障场景。

## 2.3 规格约束

1、部署形态：集群、主备集群

2、节点数目：4

3、支持基本故障类型: 磁盘故障，网络故障，进程故障，资源使用不足

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用场景法、错误推测法、正交组合法进行测试设计。

- 对于各种类型故障发生的阶段以及预期判定，主要采用场景法、错误推测法进行设计；
- 对于叠加故障、连续故障、多点故障等复杂场景，主要通过错误推测法、正交组合发进行设计覆盖。


## 3.2 详细测试设计

1、本SR主要针对性地补充测试，以及复制现有的并发启停，启停+故障、故障工程，观察不影响现有用例逻辑，再针对性的补充RTO自动化执行，不影响现有RTO数据

|  
|场景|备注|
|---|---|---|
|1|节点1，2，3在线，4不在线；,停止节点1&&kill 节点2的ycs && kill 节点3的db &&启动节点4并发执行|  
|
|2|4节点1，2，3，4在线；,kill 节点1，2 的ycs && 停止节点3 && kill 节点4 并发执行|  
|
|3|节点1，2，3在线，4不在线；,停止节点1&&kill 节点2的ycs && kill 节点3的db &&启动节点4并发执行|  
|
|4|停节点的同时断节点2的网卡，起节点的同时断网卡，此类已在之前的SR中覆盖了自动化（已涵盖2节点和4节点，涵盖了网络延迟，丢包、断网卡、kill_ycs、killycs+db、资源不足场景）,![](https://pingcode.yasdb.com/atlas/files/public/67396df88970c2af4f521628/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlnQUFBQUJBQUFBQUFBQUFBQUVBQUJBUUFBQUFBQUFBQUFDQUFBQWdBQUFBQUFBQUJBQUFBQUNBQVFBQUFVQUFBQUFBSUFBQUVBQkFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFDQVFBQUFBQUFBQUFBQUFBQUFBQUVBQ0FBQUFBQUFBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNzEsImV4cCI6MTc4MjMyMzk3MX0.-DBPqvOKfwMI6C0X11OyMsqmo0eEIptpv_nZZa9EUsA),![](https://pingcode.yasdb.com/atlas/files/public/67396df88970c2af4f521629/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlnQUFBQUJBQUFBQUFBQUFBQUVBQUJBUUFBQUFBQUFBQUFDQUFBQWdBQUFBQUFBQUJBQUFBQUNBQVFBQUFVQUFBQUFBSUFBQUVBQkFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFDQVFBQUFBQUFBQUFBQUFBQUFBQUVBQ0FBQUFBQUFBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNzEsImV4cCI6MTc4MjMyMzk3MX0.-DBPqvOKfwMI6C0X11OyMsqmo0eEIptpv_nZZa9EUsA),![](https://pingcode.yasdb.com/atlas/files/public/67396df8a1ad9a3311dc949d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlnQUFBQUJBQUFBQUFBQUFBQUVBQUJBUUFBQUFBQUFBQUFDQUFBQWdBQUFBQUFBQUJBQUFBQUNBQVFBQUFVQUFBQUFBSUFBQUVBQkFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFDQVFBQUFBQUFBQUFBQUFBQUFBQUVBQ0FBQUFBQUFBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNzEsImV4cCI6MTc4MjMyMzk3MX0.-DBPqvOKfwMI6C0X11OyMsqmo0eEIptpv_nZZa9EUsA),![](https://pingcode.yasdb.com/atlas/files/public/67396df88970c2af4f52162a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlnQUFBQUJBQUFBQUFBQUFBQUVBQUJBUUFBQUFBQUFBQUFDQUFBQWdBQUFBQUFBQUJBQUFBQUNBQVFBQUFVQUFBQUFBSUFBQUVBQkFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFDQVFBQUFBQUFBQUFBQUFBQUFBQUVBQ0FBQUFBQUFBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNzEsImV4cCI6MTc4MjMyMzk3MX0.-DBPqvOKfwMI6C0X11OyMsqmo0eEIptpv_nZZa9EUsA)|  [master_L3_cluster_network_fault [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_network_fault/)     --2节点,  [master_L3_cluster_ycs_4nodes_network_fault_1_copy_zq [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/master_L3_cluster_ycs_4nodes_network_fault_1_copy_zq/)      --4节点|
|5|2节点并发启停和4节点并发启停，启停+kill 操作也均涵盖了自动化,![](https://pingcode.yasdb.com/atlas/files/public/67396df88970c2af4f52162b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlnQUFBQUJBQUFBQUFBQUFBQUVBQUJBUUFBQUFBQUFBQUFDQUFBQWdBQUFBQUFBQUJBQUFBQUNBQVFBQUFVQUFBQUFBSUFBQUVBQkFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFDQVFBQUFBQUFBQUFBQUFBQUFBQUVBQ0FBQUFBQUFBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMxNzEsImV4cCI6MTc4MjMyMzk3MX0.-DBPqvOKfwMI6C0X11OyMsqmo0eEIptpv_nZZa9EUsA)|#   [master_L3_cluster_para_startstop_arm_1 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_para_startstop_arm_1/)      --2节点,#   [master_L3_cluster_ycs_4nodes_fault_1 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_ycs_4nodes_fault_1/)      --4节点|


2、复制工程调用观察：

  [zq_copy [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/)       --列表中所有工程（3——ycs）

  [Agile_br23.3_L3_cluster_fault_kill_arm_6_copy_zq [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/xufanbo/my-views/view/xfb_ycs_arb/job/Agile_br23.3_L3_cluster_fault_kill_arm_6_copy_zq/)  

  [集群主备故障测试工程 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/luweikang/my-views/view/%E9%9B%86%E7%BE%A4%E4%B8%BB%E5%A4%87%E6%95%85%E9%9A%9C%E6%B5%8B%E8%AF%95%E5%B7%A5%E7%A8%8B/)    ：

  [master_L3_cluster_fault_kill_arm_](https://jenkins.yasdb.com/user/luweikang/my-views/view/%E9%9B%86%E7%BE%A4%E4%B8%BB%E5%A4%87%E6%95%85%E9%9A%9C%E6%B5%8B%E8%AF%95%E5%B7%A5%E7%A8%8B/job/master_L3_cluster_fault_kill_arm_3_copy_0704/)    xx（4，6）

  [master_L3_cluster_para_startstop_arm_1_copy_0704 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/luweikang/my-views/view/%E9%9B%86%E7%BE%A4%E4%B8%BB%E5%A4%87%E6%95%85%E9%9A%9C%E6%B5%8B%E8%AF%95%E5%B7%A5%E7%A8%8B/job/master_L3_cluster_para_startstop_arm_1_copy_0704/)  

  [master_L3_cluster_ycs_4nodes_fault_1_copy_0704 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/luweikang/my-views/view/%E9%9B%86%E7%BE%A4%E4%B8%BB%E5%A4%87%E6%95%85%E9%9A%9C%E6%B5%8B%E8%AF%95%E5%B7%A5%E7%A8%8B/job/master_L3_cluster_ycs_4nodes_fault_1_copy_0704/)  

网络工程需要增加

3、RTO自动化执行

  [Agile_L3_cluster_rto_copy_zq [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_rto_copy_zq/)        --提前申请机器

## 3.3 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|并发测试已经考虑，主要是业务和故障的并发，用HA框架实现|
|KT|本SR主要是故障测试，因此故障场景已经考虑，用HA框架实现|
|长稳|不涉及，本SR不涉及DB业务|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|故障场景已经考虑|
|HA|涉及主备故障|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|本SR所有用例均会自动化看护|


## **4、测试用例**

**开发门槛用例：**    [Agile_L3_cluster_ycs_4nodes_fault_1_copy_zq [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_ycs_4nodes_fault_1_copy_zq/)  

## **5、测试框架设计**

本次测试使用HA框架实现

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## **7. 工作量评估**

工作量：10人天

  


  


## Attachments:

## Comments:

|  [](null)  ,上车分析：,  [Agile_master_L2_Build #5433 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5433/)  ,Posted by zhangqian at 九月 26, 2024 16:53|
|---|
|工程|失败原因|重跑链接|
|  [Agile_L2_sa_upgrade_FT_1_docker #4454 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4454/)  |tag太低，重跑|  [Agile_L2_sa_upgrade_FT_1_docker #4461 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4461/)      已绿|
|  [Agile_L2_sa_lsc_HA_1_docker #5262 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/5262/)  |超时重跑|  [Agile_L2_sa_lsc_HA_1_docker #5269 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/5269/)      已绿|
|  [Agile_L2_sa_tac_yasft_arm #3647 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3647/)  |主线问题，rebase重跑lastfail|  
|
|  [Agile_L2_sa_heap_yasft_arm #4292 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4292/console)  |非sr core，rebase后重跑|  
|
|  [Agile_L2_sa_heap_yasft_profile #867 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/867/console)  |lastfail|  [Agile_L2_sa_heap_yasft_profile #876 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/876/)      已绿|
|  [Agile_L2_sa_upgrade_FT_3_docker #3999 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/3999/)  |tag太低，重跑|  
|
|  [Agile_L2_sa_heap_HA_8_docker #332 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/332/)  |主线旧，rebase重跑|  [Agile_L2_sa_heap_HA_8_docker #339 [Jenkins] (yasdb.com)   已绿](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/339/)  |
|  [Agile_L2_dst_tac_yasft_arm #2919 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2919/)  |主线旧，rebase重跑|  [Agile_L2_dst_tac_yasft_arm #2928 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2928/)       已绿|
|  [Agile_L2_dst_HA_Switch_docker #4101 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4101/)  |tag太低，重跑|  [Agile_L2_dst_HA_Switch_docker #4108 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4108/)     已绿|
|  [Agile_L2_dst_lsc_yasft_arm #3152 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3152/)  |主线旧，rebase重跑|  
|
|  [Agile_L2_dst_FT_yasldr_4 #3758 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_4/3758/)  |tag太低，重跑|  [Agile_L2_dst_FT_yasldr_4 #3766 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_4/3766/)      已绿|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3537 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3537/console)  |主线旧，rebase重跑|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3545 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3545/)        已绿|
|  [Agile_L2_cluster_yasft_cluster_case_arm #3749 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3749/)  |  
|  
|
|  [Agile_L2_cluster_yasft_yfs_arm #3146 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3146/)  |磁阵慢，启动超时|  [Agile_L2_cluster_yasft_yfs_arm #3153 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3153/)     已绿|
|  [Agile_L2_cluster_FT_install_arm #723 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/723/)  |主线已知问题，还没合入|非SR影响|
|  [Agile_L2_cluster_yasft_faultpoint_arm #821 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/821/)  |磁阵慢，启动超时|  [Agile_L2_cluster_yasft_faultpoint_arm #828 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/828/)      已绿|


|工程|失败原因|重跑链接|
|---|---|---|
|  [Agile_L2_sa_upgrade_FT_1_docker #4454 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4454/)  |tag太低，重跑|  [Agile_L2_sa_upgrade_FT_1_docker #4461 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4461/)      已绿|
|  [Agile_L2_sa_lsc_HA_1_docker #5262 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/5262/)  |超时重跑|  [Agile_L2_sa_lsc_HA_1_docker #5269 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/5269/)      已绿|
|  [Agile_L2_sa_tac_yasft_arm #3647 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3647/)  |主线问题，rebase重跑lastfail|  
|
|  [Agile_L2_sa_heap_yasft_arm #4292 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4292/console)  |非sr core，rebase后重跑|  
|
|  [Agile_L2_sa_heap_yasft_profile #867 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/867/console)  |lastfail|  [Agile_L2_sa_heap_yasft_profile #876 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/876/)      已绿|
|  [Agile_L2_sa_upgrade_FT_3_docker #3999 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/3999/)  |tag太低，重跑|  
|
|  [Agile_L2_sa_heap_HA_8_docker #332 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/332/)  |主线旧，rebase重跑|  [Agile_L2_sa_heap_HA_8_docker #339 [Jenkins] (yasdb.com)   已绿](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/339/)  |
|  [Agile_L2_dst_tac_yasft_arm #2919 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2919/)  |主线旧，rebase重跑|  [Agile_L2_dst_tac_yasft_arm #2928 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2928/)       已绿|
|  [Agile_L2_dst_HA_Switch_docker #4101 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4101/)  |tag太低，重跑|  [Agile_L2_dst_HA_Switch_docker #4108 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4108/)     已绿|
|  [Agile_L2_dst_lsc_yasft_arm #3152 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3152/)  |主线旧，rebase重跑|  
|
|  [Agile_L2_dst_FT_yasldr_4 #3758 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_4/3758/)  |tag太低，重跑|  [Agile_L2_dst_FT_yasldr_4 #3766 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_4/3766/)      已绿|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3537 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3537/console)  |主线旧，rebase重跑|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3545 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3545/)        已绿|
|  [Agile_L2_cluster_yasft_cluster_case_arm #3749 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3749/)  |  
|  
|
|  [Agile_L2_cluster_yasft_yfs_arm #3146 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3146/)  |磁阵慢，启动超时|  [Agile_L2_cluster_yasft_yfs_arm #3153 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3153/)     已绿|
|  [Agile_L2_cluster_FT_install_arm #723 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/723/)  |主线已知问题，还没合入|非SR影响|
|  [Agile_L2_cluster_yasft_faultpoint_arm #821 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/821/)  |磁阵慢，启动超时|  [Agile_L2_cluster_yasft_faultpoint_arm #828 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/828/)      已绿|
