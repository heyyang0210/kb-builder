Created by 董灵林, last modified on 六月 11, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

内部技术需求。

SR链接：    [https://pingcode.yasdb.com/pjm/items/66385367c36a3d30a8619084](https://pingcode.yasdb.com/pjm/items/66385367c36a3d30a8619084)    ?#YDBRD-26829 GroupDesc结构优化

开发设计文档：    [groupDesc重构方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153024622)  

# 2. 需求分析

本次需求主要是重构  GroupDesc数据结构，本次修改影响到分布式计划的下发，用户无法感知。

  


# 3. 详细测试设计

## 3.1 测试设计方法

- 功能验证：边界值、等价类划分，正交法
- 性能验证：典型场景设计


## 3.2 详细测试设计

### 3.2.1 功能验证：

执行所有二层CI工程（包括单机、集群、分布式，可以通过上车工程执行），保证本次修改不影响现有功能

对比合入前后分布式tpch、tpcds执行计划，看计划是否改变（预期不会改变）

### 3.2.2 并发、性能、dfX验证：

分布式三层CI工程选择执行以下工程（或者复制工程）：

|序号|测试项|工程|备注|
|---|---|---|---|
|1|FT|  [dev_L3_dst_lsc_sqltest](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_sqltest/)  |  
|
|2|  
|  [dev_L3_dst_lsc_yasft](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_yasft/)  |执行时间较长的功能用例|
|3|  
|  [dev_L3_dst_tac_yasft](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_yasft/)  |执行时间较长的功能用例|
|4|  
|  [dev_L3_dst_HA_03](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_HA_03/)  |大并发下倒换|
|5|分布式并发|  [dev_L3_dst_lsc_CT_1](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_CT_1/)  |  
|
|6||  [dev_L3_dst_lsc_CT_2](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_CT_2/)  |  
|
|7||  [dev_L3_dst_tac_CT_1](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_CT_1/)  |  
|
|8||  [dev_L3_dst_tac_CT_2](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_CT_2/)  |  
|
|9||  [dev_L3_dst_lsc_KT_1_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_KT_1_arm/)  |  
|
|10||  [dev_L3_dst_lsc_KT_2_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_KT_2_arm/)  |  
|
|11||  [dev_L3_dst_lsc_KT_3_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_KT_3_arm/)  |  
|
|12||  [dev_L3_dst_lsc_KT_4_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_KT_4_arm/)  |  
|
|13||  [dev_L3_dst_tac_KT_1_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_KT_1_arm/)  |  
|
|14||  [dev_L3_dst_tac_KT_2_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_KT_2_arm/)  |  
|
|15||  [dev_L3_dst_tac_KT_3_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_KT_3_arm/)  |  
|
|16||  [dev_L3_dst_tac_KT_4_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_KT_4_arm/)  |  
|
|17|分布式一致性|  [dev_L3_dst_lsc_TX_1](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_TX_1/)  |  
|
|18||  [dev_L3_dst_lsc_TX_2](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_TX_2/)  |  
|
|19||  [dev_L3_dst_tac_TX_1](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_TX_1/)  |  
|
|20||  [dev_L3_dst_tac_TX_2](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_TX_2/)  |  
|
|21||  [dev_L3_dst_TX_kill_1](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_TX_kill_1/)  |  
|
|22||  [dev_L3_dst_TX_kill_2](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_TX_kill_2/)  |  
|
|23|内存泄漏|  [dev_L3_dst_lsc_yasft_debug_asan](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_yasft_debug_asan/)  |  
|
|24||  [dev_L3_dst_tac_yasft_debug_asan](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_yasft_debug_asan/)  |  
|
|25|分布式并行|  [dev_L3_dst_lsc_yasft_parallel_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_yasft_parallel_arm/)  |  
|
|26||  [dev_L3_dst_tac_yasft_parallel_arm](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_tac_yasft_parallel_arm/)  |  
|
|27|分布式性能|  [dev_L3_dst_lsc_Perf_tpch_SF100_1C3D_hash](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_Perf_tpch_SF100_1C3D_hash/)  |  
|
|28||  [dev_L3_dst_lsc_Perf_tpch_SF1000_1C3D_hash](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_Perf_tpch_SF1000_1C3D_hash/)  |  
|
|29||  [dev_L3_dst_lsc_Perf_Scalability_tpch_SF100_hash](https://jenkins.yasdb.com/view/dev/view/dev_L3_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/dev_L3_dst_lsc_Perf_Scalability_tpch_SF100_hash/)  |  
|
|30||  [master_L3_dst_lsc_Perf_tpcds_SF1000_1C3D_hash](https://jenkins.yasdb.com/job/master_L3_dst_lsc_Perf_tpcds_SF1000_1C3D_hash/)  |tpcds工程未上线，可以用master工程跑dev包|


  


# 4. 测试用例

无新增用例

# 5. 测试框架设计

|验证项|框架|
|:---|:---|
|FT|yasft|
|性能|tpch、tpcds|
|并发|CT/KT|
|dfx|一致性|
